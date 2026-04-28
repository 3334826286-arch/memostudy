"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  chunkSpeechText,
  getBrowserSpeechSupport,
  getVoicesForLanguage,
  pickBrowserVoice,
  resolvePreviewLanguage
} from "@/lib/browser-speech";
import { parseUploadedFile } from "@/lib/client-file-parser";
import { deleteHistoryEntry, listHistoryEntries, saveHistoryEntry } from "@/lib/history-store";
import { localeMeta } from "@/lib/i18n";
import {
  buildCloudSnapshot,
  ensureUserProfile,
  loadUserSnapshot,
  saveUserSnapshot
} from "@/lib/memostudy-cloud";
import { getLocalizedDefaultSettings, getLocalizedSampleText } from "@/lib/memostudy-defaults";
import { getMemoStudyMessages, interpolate } from "@/lib/memostudy-i18n";
import {
  APP_SECTIONS,
  DEFAULT_PLATFORM_SETTINGS,
  MATERIAL_CATEGORIES,
  buildStudyProject,
  deleteProject,
  getCompletedReviewItemsToday,
  getDifficultReviewItems,
  getDueReviewItems,
  getFavoriteReviewItems,
  getLearningStats,
  getProjectsByCategory,
  getRecommendedModes,
  getReviewSuggestions,
  loadActiveView,
  loadPlatformSettings,
  loadProjects,
  markProjectStudied,
  reviewProjectCard,
  saveActiveView,
  savePlatformSettings,
  saveProjects,
  toggleCardFlag,
  toggleProjectFavorite,
  upsertProject
} from "@/lib/memostudy-store";
import { optimizeForMemory } from "@/lib/memory-optimizer";
import {
  BILINGUAL_OPTIONS,
  EMPHASIS_OPTIONS,
  LANGUAGE_OPTIONS,
  MODEL_OPTIONS,
  MODE_OPTIONS,
  PAUSE_OPTIONS,
  TEMPLATE_PRESETS,
  VOICE_OPTIONS
} from "@/lib/tts-presets";

const DRAFT_TEXT_KEY = "memostudy:draft:text";
const DRAFT_META_KEY = "memostudy:draft:meta";
const DRAFT_SETTINGS_KEY = "memostudy:draft:settings";

function countWords(text, language) {
  if (!text.trim()) {
    return 0;
  }

  if (language.startsWith("en")) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  return (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
}

function formatSpeed(value) {
  return `${Number(value).toFixed(2)}x`;
}

function formatDate(dateString, locale) {
  if (!dateString) {
    return "";
  }

  return new Intl.DateTimeFormat(localeMeta[locale]?.bcp47 ?? "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateString));
}

function getReviewKey(item) {
  return `${item.projectId}:${item.id}`;
}

function buildHistoryTitle(text, title, fallback) {
  if (title?.trim()) {
    return title.trim();
  }

  return text.split(/\n/).find(Boolean)?.trim().slice(0, 56) || fallback;
}

function mergeReviewCards(nextCards = [], previousCards = []) {
  const previousById = new Map(previousCards.map((card) => [card.id, card]));

  return nextCards.map((card) => {
    const previous = previousById.get(card.id);
    if (!previous) {
      return card;
    }

    return {
      ...card,
      favorite: previous.favorite ?? card.favorite,
      difficult: previous.difficult ?? card.difficult,
      reviewCount: previous.reviewCount ?? card.reviewCount,
      completedCount: previous.completedCount ?? card.completedCount,
      intervalIndex: previous.intervalIndex ?? card.intervalIndex,
      nextReviewAt: previous.nextReviewAt ?? card.nextReviewAt,
      lastReviewedAt: previous.lastReviewedAt ?? card.lastReviewedAt,
      lastRating: previous.lastRating ?? card.lastRating
    };
  });
}

function pushViewToUrl(view) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("view", view);
  window.history.replaceState(null, "", url.toString());
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-[24px] border border-slate-900/8 bg-white/78 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-3 font-display text-3xl font-semibold text-slate-950">{value}</p>
      {hint ? <p className="mt-2 text-sm leading-6 text-slate-500">{hint}</p> : null}
    </div>
  );
}

function SectionIntro({ kicker, title, description, action }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <p className="text-sm uppercase tracking-[0.22em] text-slate-500">{kicker}</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-slate-950 sm:text-3xl">{title}</h2>
        {description ? <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

function Pill({ children, muted = false }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs ${
        muted ? "border-slate-200 bg-white/72 text-slate-500" : "border-slate-900/8 bg-slate-950 text-white"
      }`}
    >
      {children}
    </span>
  );
}

function NavButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm transition ${
        active
          ? "bg-slate-950 text-white shadow-[0_10px_22px_rgba(15,23,42,0.12)]"
          : "bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );
}

function ToggleRow({ title, description, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-[22px] border border-slate-900/8 bg-white/76 p-4">
      <span>
        <span className="block font-medium text-slate-900">{title}</span>
        {description ? <span className="mt-1 block text-sm leading-6 text-slate-500">{description}</span> : null}
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function SettingField({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-slate-500">{label}</span>
      {children}
      {hint ? <span className="mt-2 block text-xs leading-5 text-slate-400">{hint}</span> : null}
    </label>
  );
}

function MaterialCard({ project, copy, locale, onOpen, onDelete, onFavorite }) {
  return (
    <div className="panel rounded-[26px] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-semibold text-slate-950">{project.title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{project.excerpt}</p>
        </div>
        <Pill muted>{copy.categories[project.category] ?? project.category}</Pill>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Pill>{interpolate(copy.materials.blocks, { count: project.blockCount ?? 0 })}</Pill>
        <Pill muted>{interpolate(copy.materials.keywords, { count: project.keywordCount ?? 0 })}</Pill>
        <Pill muted>{interpolate(copy.materials.difficult, { count: project.reviewCards?.filter((card) => card.difficult).length ?? 0 })}</Pill>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-500">
        {project.lastStudiedAt
          ? interpolate(copy.materials.lastStudied, { date: formatDate(project.lastStudiedAt, locale) })
          : copy.materials.neverStudied}
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className="btn-primary" onClick={() => onOpen(project)}>
          {copy.materials.continue}
        </button>
        <button type="button" className="btn-secondary" onClick={() => onFavorite(project.id)}>
          {project.favorite ? copy.materials.unfavorite : copy.materials.favorite}
        </button>
        <button type="button" className="btn-secondary" onClick={() => onDelete(project.id)}>
          {copy.materials.delete}
        </button>
      </div>
    </div>
  );
}

function ReviewMiniCard({ item }) {
  return (
    <div className="rounded-[22px] border border-slate-900/8 bg-white/76 p-4">
      <p className="font-medium text-slate-900">{item.projectTitle}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{item.prompt}</p>
    </div>
  );
}

export function MemoStudyApp() {
  const { locale, direction } = useLanguage();
  const copy = useMemo(() => getMemoStudyMessages(locale), [locale]);
  const localizedDefaults = useMemo(() => getLocalizedDefaultSettings(locale), [locale]);
  const sampleText = useMemo(() => getLocalizedSampleText(copy), [copy]);
  const {
    client: supabaseClient,
    isConfigured: isAuthConfigured,
    isReady: isAuthReady,
    user,
    displayName,
    lastAuthEvent,
    clearLastAuthEvent,
    signIn,
    signUp,
    signOut,
    sendPasswordReset,
    updatePassword
  } = useAuth();

  const fileInputRef = useRef(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(false);
  const cloudLoadedRef = useRef(false);
  const cloudTimerRef = useRef(null);

  const [activeView, setActiveView] = useState("home");
  const [projectTitle, setProjectTitle] = useState("");
  const [projectCategory, setProjectCategory] = useState(DEFAULT_PLATFORM_SETTINGS.defaultCategory);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [text, setText] = useState(sampleText);
  const [settings, setSettings] = useState(localizedDefaults);
  const [platformSettings, setPlatformSettingsState] = useState(DEFAULT_PLATFORM_SETTINGS);
  const [projects, setProjects] = useState([]);
  const [history, setHistory] = useState([]);
  const [optimized, setOptimized] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [status, setStatus] = useState(copy.statuses.ready);
  const [error, setError] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isHistoryReady, setIsHistoryReady] = useState(false);
  const [activeLoopSegmentId, setActiveLoopSegmentId] = useState("");
  const [abStartId, setAbStartId] = useState("");
  const [abEndId, setAbEndId] = useState("");
  const [isRangeLooping, setIsRangeLooping] = useState(false);
  const [materialsQuery, setMaterialsQuery] = useState("");
  const [materialsCategory, setMaterialsCategory] = useState("all");
  const [activeReviewKey, setActiveReviewKey] = useState("");
  const [reviewAnswerVisible, setReviewAnswerVisible] = useState(false);
  const [authMode, setAuthMode] = useState("sign-in");
  const [authForm, setAuthForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [cloudStatus, setCloudStatus] = useState(isAuthConfigured ? copy.auth.syncPending : copy.auth.syncOff);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [browserVoices, setBrowserVoices] = useState([]);
  const [playback, setPlayback] = useState({
    state: "idle",
    label: "",
    chunkIndex: 0,
    chunkCount: 0
  });

  const deferredMaterialsQuery = useDeferredValue(materialsQuery);
  const effectiveLanguage = resolvePreviewLanguage(settings.language, optimized?.language);
  const browserVoiceOptions = useMemo(
    () => getVoicesForLanguage(browserVoices, effectiveLanguage),
    [browserVoices, effectiveLanguage]
  );
  const browserVoice = useMemo(
    () =>
      pickBrowserVoice({
        voices: browserVoices,
        browserVoiceName: settings.browserVoiceName,
        targetLanguage: effectiveLanguage
      }),
    [browserVoices, settings.browserVoiceName, effectiveLanguage]
  );
  const filteredProjects = useMemo(() => {
    const byCategory = getProjectsByCategory(projects, materialsCategory);
    const query = deferredMaterialsQuery.trim().toLowerCase();

    if (!query) {
      return byCategory;
    }

    return byCategory.filter((project) =>
      [project.title, project.excerpt, copy.categories[project.category] ?? project.category]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [projects, materialsCategory, deferredMaterialsQuery, copy.categories]);

  const stats = useMemo(() => getLearningStats(projects, history), [projects, history]);
  const dueItems = useMemo(() => getDueReviewItems(projects), [projects]);
  const completedToday = useMemo(() => getCompletedReviewItemsToday(projects), [projects]);
  const favoriteReviewItems = useMemo(() => getFavoriteReviewItems(projects), [projects]);
  const difficultReviewItems = useMemo(() => getDifficultReviewItems(projects), [projects]);
  const reviewSuggestions = useMemo(() => getReviewSuggestions(projects), [projects]);
  const recommendedModes = useMemo(() => {
    const modes = getRecommendedModes(projects);
    return modes.length ? modes : ["recitation", "cloze", "review"];
  }, [projects]);
  const currentReviewItem = useMemo(() => {
    if (!dueItems.length) {
      return null;
    }

    return dueItems.find((item) => getReviewKey(item) === activeReviewKey) ?? dueItems[0];
  }, [dueItems, activeReviewKey]);

  const suggestionText =
    reviewSuggestions.recommendation === "difficult-first"
      ? copy.review.suggestionDifficult
      : reviewSuggestions.recommendation === "review-batch"
        ? copy.review.suggestionBatch
        : copy.review.suggestionNew;

  const paragraphs = optimized?.paragraphs ?? [];
  const characterCount = text.length;
  const wordCount = countWords(text, effectiveLanguage);
  const canPausePreview = playback.state === "playing" || playback.state === "paused";

  useEffect(() => {
    setIsSpeechSupported(getBrowserSpeechSupport());
  }, []);

  useEffect(() => {
    if (!isSpeechSupported) {
      setBrowserVoices([]);
      return undefined;
    }

    const synth = window.speechSynthesis;
    const updateVoices = () => setBrowserVoices(synth.getVoices());

    updateVoices();
    synth.addEventListener?.("voiceschanged", updateVoices);

    return () => {
      synth.removeEventListener?.("voiceschanged", updateVoices);
    };
  }, [isSpeechSupported]);

  useEffect(() => {
    let mounted = true;
    const savedText = window.localStorage.getItem(DRAFT_TEXT_KEY);
    const savedMeta = window.localStorage.getItem(DRAFT_META_KEY);
    const savedSettings = window.localStorage.getItem(DRAFT_SETTINGS_KEY);
    const savedProjects = loadProjects();
    const savedPlatformSettings = loadPlatformSettings();
    const savedView = loadActiveView();
    const params = new URLSearchParams(window.location.search);
    const urlView = params.get("view");

    setText(savedText || sampleText);
    setProjects(savedProjects);
    setPlatformSettingsState(savedPlatformSettings);
    setProjectCategory(savedPlatformSettings.defaultCategory);

    if (savedSettings) {
      try {
        setSettings({ ...localizedDefaults, ...JSON.parse(savedSettings) });
      } catch {
        window.localStorage.removeItem(DRAFT_SETTINGS_KEY);
      }
    }

    if (savedMeta) {
      try {
        const parsed = JSON.parse(savedMeta);
        setProjectTitle(parsed.projectTitle ?? "");
        setProjectCategory(parsed.projectCategory ?? savedPlatformSettings.defaultCategory);
      } catch {
        window.localStorage.removeItem(DRAFT_META_KEY);
      }
    }

    if (APP_SECTIONS.includes(urlView)) {
      setActiveView(urlView);
    } else if (APP_SECTIONS.includes(savedView)) {
      setActiveView(savedView);
    }

    listHistoryEntries()
      .then((entries) => {
        if (mounted) {
          setHistory(entries);
        }
      })
      .catch(() => {
        if (mounted) {
          setStatus(copy.statuses.historyInitFail);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsHistoryReady(true);
          mountedRef.current = true;
        }
      });

    return () => {
      mounted = false;
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!mountedRef.current) {
      return;
    }

    window.localStorage.setItem(DRAFT_TEXT_KEY, text);
  }, [text]);

  useEffect(() => {
    if (!mountedRef.current) {
      return;
    }

    window.localStorage.setItem(DRAFT_META_KEY, JSON.stringify({ projectTitle, projectCategory }));
  }, [projectTitle, projectCategory]);

  useEffect(() => {
    if (!mountedRef.current) {
      return;
    }

    window.localStorage.setItem(DRAFT_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!mountedRef.current) {
      return;
    }

    saveProjects(projects);
  }, [projects]);

  useEffect(() => {
    if (!mountedRef.current) {
      return;
    }

    savePlatformSettings(platformSettings);
  }, [platformSettings]);

  useEffect(() => {
    if (!mountedRef.current) {
      return;
    }

    saveActiveView(activeView);
    pushViewToUrl(activeView);
  }, [activeView]);

  useEffect(() => {
    if (!paragraphs.length) {
      setAbStartId("");
      setAbEndId("");
      return;
    }

    if (!paragraphs.some((paragraph) => paragraph.id === abStartId)) {
      setAbStartId(paragraphs[0].id);
    }

    if (!paragraphs.some((paragraph) => paragraph.id === abEndId)) {
      setAbEndId(paragraphs[paragraphs.length - 1].id);
    }
  }, [paragraphs, abStartId, abEndId]);

  useEffect(() => {
    if (!currentReviewItem) {
      setActiveReviewKey("");
      setReviewAnswerVisible(false);
      return;
    }

    const nextKey = getReviewKey(currentReviewItem);
    if (activeReviewKey !== nextKey) {
      setActiveReviewKey(nextKey);
      setReviewAnswerVisible(false);
    }
  }, [currentReviewItem, activeReviewKey]);

  useEffect(() => {
    setCloudStatus(isAuthConfigured ? copy.auth.syncPending : copy.auth.syncOff);
  }, [copy.auth.syncPending, copy.auth.syncOff, isAuthConfigured]);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!user || !supabaseClient) {
      cloudLoadedRef.current = true;
      return;
    }

    let cancelled = false;

    async function hydrate() {
      try {
        setCloudStatus(copy.auth.syncPending);
        await ensureUserProfile(supabaseClient, user, locale);
        const snapshot = await loadUserSnapshot(supabaseClient, user.id);

        if (cancelled) {
          return;
        }

        if (snapshot?.projects) {
          setProjects(snapshot.projects);
          saveProjects(snapshot.projects);
        }

        if (snapshot?.platformSettings) {
          const merged = { ...DEFAULT_PLATFORM_SETTINGS, ...snapshot.platformSettings };
          setPlatformSettingsState(merged);
          savePlatformSettings(merged);
        }

        if (Array.isArray(snapshot?.history)) {
          setHistory(snapshot.history);
        }

        cloudLoadedRef.current = true;
        setCloudStatus(copy.auth.syncReady);
        setStatus(copy.statuses.authSyncReady);
      } catch (cloudError) {
        cloudLoadedRef.current = true;
        setCloudStatus(copy.auth.syncOff);
        setError(cloudError.message);
        setStatus(copy.statuses.authSyncFail);
      }
    }

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [
    copy.auth.syncOff,
    copy.auth.syncPending,
    copy.auth.syncReady,
    copy.statuses.authSyncFail,
    copy.statuses.authSyncReady,
    isAuthReady,
    locale,
    supabaseClient,
    user
  ]);

  useEffect(() => {
    if (!isAuthReady || !user || !supabaseClient || !cloudLoadedRef.current) {
      return;
    }

    if (cloudTimerRef.current) {
      clearTimeout(cloudTimerRef.current);
    }

    cloudTimerRef.current = setTimeout(async () => {
      try {
        await ensureUserProfile(supabaseClient, user, locale);
        await saveUserSnapshot(
          supabaseClient,
          user.id,
          buildCloudSnapshot({ projects, platformSettings, history })
        );
        setCloudStatus(copy.auth.syncReady);
      } catch {
        setCloudStatus(copy.auth.syncOff);
      }
    }, 700);

    return () => {
      if (cloudTimerRef.current) {
        clearTimeout(cloudTimerRef.current);
      }
    };
  }, [
    copy.auth.syncOff,
    copy.auth.syncReady,
    history,
    isAuthReady,
    locale,
    platformSettings,
    projects,
    supabaseClient,
    user
  ]);

  useEffect(() => {
    if (!lastAuthEvent) {
      return;
    }

    if (lastAuthEvent === "PASSWORD_RECOVERY") {
      setAuthMode("update-password");
      setAuthMessage(copy.statuses.authRecovery);
    } else if (lastAuthEvent === "SIGNED_IN") {
      setAuthMessage(copy.statuses.authSignedIn);
    }

    clearLastAuthEvent();
  }, [clearLastAuthEvent, copy.statuses.authRecovery, copy.statuses.authSignedIn, lastAuthEvent]);

  function setView(view) {
    startTransition(() => setActiveView(view));
  }

  function updateSettings(key, value) {
    setSettings((current) => ({
      ...current,
      [key]: value
    }));
  }

  function updatePlatformPreference(key, value) {
    setPlatformSettingsState((current) => ({
      ...current,
      [key]: value
    }));
  }

  function resetWorkspace() {
    setSelectedProjectId("");
    setProjectTitle("");
    setProjectCategory(platformSettings.defaultCategory);
    setText(sampleText);
    setSettings(localizedDefaults);
    setOptimized(null);
    setUploadedFileName("");
    setStatus(copy.statuses.ready);
    setError("");
  }

  function applyTemplate(templateId) {
    const preset = TEMPLATE_PRESETS.find((item) => item.id === templateId);
    if (!preset) {
      return;
    }

    setSettings((current) => ({ ...current, ...preset.settings }));
  }

  async function syncHistoryState(entry) {
    await saveHistoryEntry(entry);
    const entries = await listHistoryEntries();
    setHistory(entries);
  }

  function optimizeCurrentText() {
    return optimizeForMemory(text, settings);
  }

  async function handleOptimize() {
    if (!text.trim()) {
      setError(copy.studio.contentPlaceholder);
      return;
    }

    setError("");
    setIsOptimizing(true);

    try {
      const nextOptimized = optimizeCurrentText();
      setOptimized(nextOptimized);
      setStatus(copy.statuses.optimizeDone);
    } catch (optimizeError) {
      setError(optimizeError.message);
      setStatus(copy.statuses.optimizeFail);
    } finally {
      setIsOptimizing(false);
    }
  }

  function stopPreview() {
    requestIdRef.current += 1;
    setActiveLoopSegmentId("");
    setIsRangeLooping(false);

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setPlayback({
      state: "idle",
      label: "",
      chunkIndex: 0,
      chunkCount: 0
    });
    setStatus(copy.statuses.previewStopped);
  }

  function pauseOrResumePreview() {
    if (!isSpeechSupported || typeof window === "undefined") {
      return;
    }

    if (playback.state === "playing") {
      window.speechSynthesis.pause();
      setPlayback((current) => ({ ...current, state: "paused" }));
      setStatus(copy.statuses.previewPaused);
      return;
    }

    if (playback.state === "paused") {
      window.speechSynthesis.resume();
      setPlayback((current) => ({ ...current, state: "playing" }));
      setStatus(copy.statuses.previewResumed);
    }
  }

  async function playSpeechText(script, label, options = {}) {
    if (!isSpeechSupported || typeof window === "undefined") {
      setError(copy.studio.speechUnsupported);
      return;
    }

    const chunks = chunkSpeechText(script, effectiveLanguage);
    if (!chunks.length) {
      setError(copy.studio.empty);
      return;
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    const loop = Boolean(options.loop);
    const voice = browserVoice;
    const synth = window.speechSynthesis;

    synth.cancel();
    setError("");
    setPlayback({
      state: "playing",
      label,
      chunkIndex: 1,
      chunkCount: chunks.length
    });

    const speakChunk = (index) => {
      if (requestId !== requestIdRef.current) {
        return;
      }

      if (index >= chunks.length) {
        if (loop) {
          speakChunk(0);
          return;
        }

        setPlayback({
          state: "idle",
          label: "",
          chunkIndex: 0,
          chunkCount: 0
        });
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      utterance.lang = effectiveLanguage === "zh-CN|en-US" ? "zh-CN" : effectiveLanguage;
      utterance.rate = Number(settings.speed || 1);
      if (voice) {
        utterance.voice = voice;
      }
      utterance.onstart = () => {
        setPlayback({
          state: "playing",
          label,
          chunkIndex: index + 1,
          chunkCount: chunks.length
        });
      };
      utterance.onerror = () => {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setPlayback({
          state: "idle",
          label: "",
          chunkIndex: 0,
          chunkCount: 0
        });
        setStatus(copy.statuses.previewFailed);
      };
      utterance.onend = () => {
        if (requestId !== requestIdRef.current) {
          return;
        }

        speakChunk(index + 1);
      };
      synth.speak(utterance);
    };

    setStatus(copy.statuses.previewReady);
    speakChunk(0);
  }

  async function previewOptimized(loop = false) {
    const nextOptimized = optimized ?? optimizeCurrentText();
    if (!optimized) {
      setOptimized(nextOptimized);
    }

    const title = buildHistoryTitle(text, projectTitle, copy.misc.untitled);
    await syncHistoryState({
      id: `session-${Date.now()}`,
      createdAt: new Date().toISOString(),
      title,
      text,
      optimized: nextOptimized,
      settings,
      projectCategory
    });

    await playSpeechText(nextOptimized.optimizedText, copy.studio.previewFull, { loop });
  }

  function previewParagraph(paragraph, loop = false) {
    setActiveLoopSegmentId(loop ? paragraph.id : "");
    setIsRangeLooping(false);
    playSpeechText(paragraph.speechText, paragraph.title, { loop });
    setStatus(loop ? copy.statuses.loopOn : copy.statuses.previewReady);
  }

  function previewRange(loop = false) {
    if (!paragraphs.length) {
      return;
    }

    const startIndex = paragraphs.findIndex((paragraph) => paragraph.id === abStartId);
    const endIndex = paragraphs.findIndex((paragraph) => paragraph.id === abEndId);

    if (startIndex === -1 || endIndex === -1) {
      return;
    }

    const from = Math.min(startIndex, endIndex);
    const to = Math.max(startIndex, endIndex);
    const selected = paragraphs.slice(from, to + 1);
    const script = selected.map((paragraph) => paragraph.speechText).join("\n\n");

    setActiveLoopSegmentId("");
    setIsRangeLooping(loop);
    playSpeechText(script, copy.studio.abLoopTitle, { loop });
    setStatus(loop ? copy.statuses.rangeLoopOn : copy.statuses.rangePreview);
  }

  function stopBlockLoop() {
    if (!activeLoopSegmentId && !isRangeLooping) {
      return;
    }

    stopPreview();
    setStatus(activeLoopSegmentId ? copy.statuses.loopOff : copy.statuses.rangeLoopOff);
  }

  function buildCurrentProject(nextOptimized) {
    const existingProject = projects.find((project) => project.id === selectedProjectId);
    const project = buildStudyProject({
      title: projectTitle,
      category: projectCategory,
      text,
      settings,
      optimized: nextOptimized,
      mode: settings.mode,
      existingId: existingProject?.id
    });

    if (!existingProject) {
      return project;
    }

    return {
      ...project,
      createdAt: existingProject.createdAt,
      favorite: existingProject.favorite,
      archived: existingProject.archived,
      reviewCards: mergeReviewCards(project.reviewCards, existingProject.reviewCards)
    };
  }

  function saveCurrentProject() {
    if (!text.trim()) {
      setError(copy.studio.contentPlaceholder);
      return;
    }

    const nextOptimized = optimized ?? optimizeCurrentText();
    if (!optimized) {
      setOptimized(nextOptimized);
    }

    const project = buildCurrentProject(nextOptimized);
    const nextProjects = upsertProject(projects, project);
    setProjects(nextProjects);
    setSelectedProjectId(project.id);
    setProjectTitle(project.title);
    setStatus(
      selectedProjectId
        ? interpolate(copy.statuses.projectUpdated, { title: project.title })
        : interpolate(copy.statuses.projectSaved, { title: project.title })
    );
  }

  function openProject(project) {
    if (!project) {
      return;
    }

    startTransition(() => {
      setSelectedProjectId(project.id);
      setProjectTitle(project.title);
      setProjectCategory(project.category);
      setText(project.text);
      setSettings(project.settings);
      setOptimized(project.optimized);
      setActiveView("studio");
      setStatus(interpolate(copy.statuses.materialOpened, { title: project.title }));
    });

    const nextProjects = markProjectStudied(projects, project.id);
    setProjects(nextProjects);
  }

  function removeProject(projectId) {
    const nextProjects = deleteProject(projects, projectId);
    setProjects(nextProjects);
    if (selectedProjectId === projectId) {
      setSelectedProjectId("");
    }
    setStatus(copy.statuses.materialDeleted);
  }

  function toggleFavorite(projectId) {
    const nextProjects = toggleProjectFavorite(projects, projectId);
    setProjects(nextProjects);
    setStatus(copy.statuses.favoriteUpdated);
  }

  function toggleReviewFlag(projectId, cardId, key) {
    const nextProjects = toggleCardFlag(projects, projectId, cardId, key);
    setProjects(nextProjects);
    setStatus(key === "favorite" ? copy.statuses.favoriteUpdated : copy.statuses.difficultUpdated);
  }

  function handleReviewFeedback(rating) {
    if (!currentReviewItem) {
      return;
    }

    const nextProjects = reviewProjectCard(projects, currentReviewItem.projectId, currentReviewItem.id, rating);
    setProjects(nextProjects);
    setReviewAnswerVisible(false);
    setStatus(copy.statuses.reviewDone);
  }

  async function restoreHistory(entry) {
    setText(entry.text);
    setSettings(entry.settings);
    setOptimized(entry.optimized ?? null);
    setProjectTitle(entry.title);
    setProjectCategory(entry.projectCategory ?? platformSettings.defaultCategory);
    setSelectedProjectId("");
    setActiveView("studio");
  }

  async function replayHistory(entry) {
    if (!entry?.optimized?.optimizedText) {
      return;
    }

    setText(entry.text);
    setSettings(entry.settings);
    setOptimized(entry.optimized);
    await playSpeechText(entry.optimized.optimizedText, copy.history.previewOnly);
  }

  async function removeHistory(historyId) {
    await deleteHistoryEntry(historyId);
    const entries = await listHistoryEntries();
    setHistory(entries);
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploading(true);
    setError("");
    setStatus(interpolate(copy.statuses.uploadParsing, { name: file.name }));

    try {
      const result = await parseUploadedFile(file, copy);
      setText(result.text);
      setUploadedFileName(result.fileName);
      setStatus(interpolate(copy.statuses.uploadDone, { name: result.fileName }));
      setActiveView("studio");
    } catch (uploadError) {
      setError(uploadError.message);
      setStatus(copy.statuses.uploadFail);
    } finally {
      setIsUploading(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  }

  function validateAuthForm() {
    if (!authForm.email.trim()) {
      return copy.auth.validation.emailRequired;
    }

    if (authMode === "forgot") {
      return "";
    }

    if (!authForm.password) {
      return copy.auth.validation.passwordRequired;
    }

    if (authForm.password.length < 8) {
      return copy.auth.validation.passwordShort;
    }

    if (authMode === "sign-up" || authMode === "update-password") {
      if (authMode === "sign-up" && !authForm.fullName.trim()) {
        return copy.auth.validation.nameRequired;
      }

      if (authForm.password !== authForm.confirmPassword) {
        return copy.auth.validation.passwordMismatch;
      }
    }

    return "";
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    const validationError = validateAuthForm();

    if (validationError) {
      setAuthError(validationError);
      return;
    }

    setIsAuthBusy(true);
    setAuthError("");
    setAuthMessage("");

    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/?view=auth` : undefined;

      if (authMode === "sign-in") {
        await signIn({ email: authForm.email.trim(), password: authForm.password });
        setAuthMessage(copy.auth.success.signedIn);
      } else if (authMode === "sign-up") {
        await signUp({
          email: authForm.email.trim(),
          password: authForm.password,
          fullName: authForm.fullName.trim(),
          emailRedirectTo: redirectTo
        });
        setAuthMessage(copy.auth.success.signedUp);
      } else if (authMode === "forgot") {
        await sendPasswordReset(authForm.email.trim(), redirectTo);
        setAuthMessage(copy.auth.success.resetSent);
      } else if (authMode === "update-password") {
        await updatePassword({
          password: authForm.password,
          fullName: authForm.fullName.trim()
        });
        setAuthMessage(copy.auth.success.passwordUpdated);
      }
    } catch (submitError) {
      setAuthError(submitError.message);
    } finally {
      setIsAuthBusy(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      setAuthMessage(copy.auth.success.signedOut);
      setAuthError("");
    } catch (signOutError) {
      setAuthError(signOutError.message);
    }
  }

  const shellHeader = (
    <header className="panel-strong rounded-[34px] px-5 py-5 sm:px-7 lg:px-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap gap-2">
            <Pill muted>{copy.brand.tagline}</Pill>
            <Pill muted>{interpolate(copy.reviewFeedback.queue, { count: dueItems.length })}</Pill>
            <Pill muted>{user ? displayName || user.email : copy.auth.accountGuest}</Pill>
          </div>
          <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            {copy.brand.name}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">{copy.brand.description}</p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <LanguageSwitcher compact />
          <nav className="flex flex-wrap gap-2">
            {[
              { id: "home", label: copy.nav.home },
              { id: "studio", label: copy.nav.studio },
              { id: "materials", label: copy.nav.materials },
              { id: "review", label: copy.nav.review },
              { id: "history", label: copy.nav.history },
              { id: "auth", label: copy.nav.auth },
              { id: "settings", label: copy.nav.settings }
            ].map((item) => (
              <NavButton key={item.id} active={activeView === item.id} label={item.label} onClick={() => setView(item.id)} />
            ))}
          </nav>
        </div>
      </div>
    </header>
  );

  const homeView = (
    <section className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel rounded-[30px] p-5 sm:p-6">
          <SectionIntro
            kicker={copy.home.badge}
            title={copy.home.title}
            description={copy.home.description}
            action={
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-primary" onClick={() => setView("studio")}>
                  {copy.home.primary}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setView("review")}>
                  {copy.home.secondary}
                </button>
              </div>
            }
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label={copy.dashboard.todayDue} value={stats.dueCount} hint={copy.review.dueTitle} />
            <StatCard label={copy.dashboard.materials} value={stats.totalProjects} hint={copy.misc.studyProject} />
            <StatCard label={copy.dashboard.streak} value={stats.streak} hint={copy.dashboard.unit.days} />
          </div>
        </div>

        <div className="panel rounded-[30px] p-5 sm:p-6">
          <SectionIntro
            kicker={copy.home.dailyTitle}
            title={copy.misc.todaysPriority}
            description={copy.home.dailyDescription}
          />

          <div className="mt-6 space-y-3">
            <div className="rounded-[22px] border border-slate-900/8 bg-slate-950 px-4 py-4 text-white">
              {suggestionText}
            </div>
            <div className="rounded-[22px] border border-slate-900/8 bg-white/76 p-4 text-sm leading-6 text-slate-600">
              {uploadedFileName ? interpolate(copy.misc.uploadedFile, { name: uploadedFileName }) : copy.statuses.ready}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="panel rounded-[30px] p-5 sm:p-6">
          <SectionIntro
            kicker={copy.home.todayReview}
            title={copy.review.dueTitle}
            description={interpolate(copy.reviewFeedback.queue, { count: dueItems.length })}
          />
          <div className="mt-5 space-y-3">
            {dueItems.slice(0, 4).map((item) => (
              <ReviewMiniCard key={getReviewKey(item)} item={item} />
            ))}
            {dueItems.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-sm leading-6 text-slate-500">
                {copy.review.dueEmpty}
              </div>
            ) : null}
          </div>
        </div>

        <div className="panel rounded-[30px] p-5 sm:p-6">
          <SectionIntro
            kicker={copy.home.recommendedModes}
            title={copy.home.methodsTitle}
            description={copy.misc.learningModes}
          />
          <div className="mt-5 grid gap-3">
            {recommendedModes.map((mode) => (
              <div key={mode} className="rounded-[22px] border border-slate-900/8 bg-white/76 p-4">
                <p className="font-medium text-slate-900">{copy.modes[mode] ?? mode}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy.home.methods.multimodal.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </section>
  );

  const studioView = (
    <section className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="panel rounded-[30px] p-5 sm:p-6">
          <SectionIntro
            kicker={copy.sections.studio.kicker}
            title={copy.studio.contentInput}
            description={copy.studio.methodsDescription}
          />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <SettingField label={copy.studio.projectTitle}>
              <input
                className="field"
                value={projectTitle}
                onChange={(event) => setProjectTitle(event.target.value)}
                placeholder={copy.studio.projectTitlePlaceholder}
              />
            </SettingField>
            <SettingField label={copy.studio.projectCategory}>
              <select
                className="field"
                value={projectCategory}
                onChange={(event) => setProjectCategory(event.target.value)}
              >
                {MATERIAL_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {copy.categories[category]}
                  </option>
                ))}
              </select>
            </SettingField>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.34fr]">
            <textarea
              className="field min-h-[290px]"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={copy.studio.contentPlaceholder}
            />

            <div className="rounded-[24px] border border-slate-900/8 bg-white/76 p-4">
              <p className="font-medium text-slate-900">{copy.studio.uploadTitle}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{copy.studio.uploadDescription}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.docx,.pdf"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                className="btn-primary mt-4 w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? copy.studio.uploadBusy : copy.studio.uploadIdle}
              </button>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-500">
                {copy.studio.uploadNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" onClick={() => setText(sampleText)}>
              {copy.studio.sample}
            </button>
            <button type="button" className="btn-secondary" onClick={resetWorkspace}>
              {copy.studio.createNew}
            </button>
            <button type="button" className="btn-secondary" onClick={handleOptimize} disabled={isOptimizing}>
              {isOptimizing ? copy.studio.optimizeBusy : copy.studio.optimizeIdle}
            </button>
            <button type="button" className="btn-primary" onClick={saveCurrentProject}>
              {selectedProjectId ? copy.studio.updateProject : copy.studio.saveProject}
            </button>
          </div>

          {status ? (
            <div className="mt-5 rounded-[20px] border border-slate-900/8 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-700">
              {status}
            </div>
          ) : null}

          {error ? (
            <div className="mt-3 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="panel rounded-[30px] p-5 sm:p-6">
          <SectionIntro
            kicker={copy.sections.settings.kicker}
            title={copy.sections.settings.title}
            description={copy.studio.methodsTitle}
          />

          <div className="mt-6 grid gap-4">
            <SettingField label={copy.options.speechLanguage}>
              <select className="field" value={settings.language} onChange={(event) => updateSettings("language", event.target.value)}>
                {LANGUAGE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {copy.optionValues.speechLanguage[item]}
                  </option>
                ))}
              </select>
            </SettingField>
            <SettingField label={copy.options.model}>
              <select className="field" value={settings.model} onChange={(event) => updateSettings("model", event.target.value)}>
                {MODEL_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {copy.optionValues.model[item]}
                  </option>
                ))}
              </select>
            </SettingField>
            <SettingField label={copy.options.voice}>
              <select className="field" value={settings.voice} onChange={(event) => updateSettings("voice", event.target.value)}>
                {VOICE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {copy.optionValues.voice[item]}
                  </option>
                ))}
              </select>
            </SettingField>
            <SettingField label={copy.options.browserVoice} hint={copy.studio.browserVoiceDescription}>
              <select
                className="field"
                value={settings.browserVoiceName}
                onChange={(event) => updateSettings("browserVoiceName", event.target.value)}
              >
                <option value="">{copy.studio.browserVoiceAuto}</option>
                {browserVoiceOptions.map((voice) => (
                  <option key={`${voice.name}:${voice.lang}`} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </SettingField>
            <SettingField label={copy.options.bilingual}>
              <select className="field" value={settings.bilingualMode} onChange={(event) => updateSettings("bilingualMode", event.target.value)}>
                {BILINGUAL_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {copy.optionValues.bilingual[item]}
                  </option>
                ))}
              </select>
            </SettingField>
            <SettingField label={copy.modes[settings.mode] ?? settings.mode}>
              <select className="field" value={settings.mode} onChange={(event) => updateSettings("mode", event.target.value)}>
                {MODE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {copy.modes[item] ?? item}
                  </option>
                ))}
              </select>
            </SettingField>
            <SettingField label={copy.options.pause}>
              <select className="field" value={settings.pauseStrength} onChange={(event) => updateSettings("pauseStrength", event.target.value)}>
                {PAUSE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {copy.optionValues.pause[item]}
                  </option>
                ))}
              </select>
            </SettingField>
            <SettingField label={copy.options.emphasis}>
              <select className="field" value={settings.emphasis} onChange={(event) => updateSettings("emphasis", event.target.value)}>
                {EMPHASIS_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {copy.optionValues.emphasis[item]}
                  </option>
                ))}
              </select>
            </SettingField>
            <SettingField label={copy.options.speed} hint={formatSpeed(settings.speed)}>
              <input
                className="w-full"
                type="range"
                min="0.65"
                max="1.15"
                step="0.01"
                value={settings.speed}
                onChange={(event) => updateSettings("speed", Number(event.target.value))}
              />
            </SettingField>
            <SettingField label={copy.options.sentenceRepeat}>
              <input
                className="w-full"
                type="range"
                min="1"
                max="4"
                step="1"
                value={settings.repeatCount}
                onChange={(event) => updateSettings("repeatCount", Number(event.target.value))}
              />
            </SettingField>
            <SettingField label={copy.options.keywordRepeat}>
              <input
                className="w-full"
                type="range"
                min="1"
                max="4"
                step="1"
                value={settings.keywordRepeatCount}
                onChange={(event) => updateSettings("keywordRepeatCount", Number(event.target.value))}
              />
            </SettingField>
            <SettingField label={copy.options.focusRepeat}>
              <input
                className="w-full"
                type="range"
                min="1"
                max="4"
                step="1"
                value={settings.focusSentenceRepeatCount}
                onChange={(event) => updateSettings("focusSentenceRepeatCount", Number(event.target.value))}
              />
            </SettingField>
            <ToggleRow
              title={copy.options.repeatKeywords}
              checked={settings.repeatKeywords}
              onChange={(value) => updateSettings("repeatKeywords", value)}
            />
            <ToggleRow
              title={copy.options.repeatFocus}
              checked={settings.repeatFocusSentences}
              onChange={(value) => updateSettings("repeatFocusSentences", value)}
            />
            <SettingField label={copy.studio.templatesTitle}>
              <div className="grid gap-2 sm:grid-cols-2">
                {TEMPLATE_PRESETS.map((preset) => (
                  <button key={preset.id} type="button" className="btn-secondary" onClick={() => applyTemplate(preset.id)}>
                    {copy.templates[preset.id]?.name ?? preset.id}
                  </button>
                ))}
              </div>
            </SettingField>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.92fr]">
        <div className="panel rounded-[30px] p-5 sm:p-6">
          <SectionIntro
            kicker={copy.studio.optimizeTitle}
            title={copy.studio.outputScript}
            description={optimized ? copy.studio.blockCount.replace("{count}", `${paragraphs.length}`) : copy.studio.empty}
          />

          {!optimized ? (
            <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-10 text-sm leading-6 text-slate-500">
              {copy.studio.empty}
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {paragraphs.map((paragraph) => (
                <div key={paragraph.id} className="rounded-[24px] border border-slate-900/8 bg-white/76 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{paragraph.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {interpolate(copy.studio.blockFocus, { value: paragraph.focus })}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-secondary" onClick={() => previewParagraph(paragraph, false)}>
                        {copy.studio.playBlock}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          activeLoopSegmentId === paragraph.id ? stopBlockLoop() : previewParagraph(paragraph, true)
                        }
                      >
                        {activeLoopSegmentId === paragraph.id ? copy.studio.stopLoop : copy.studio.loopThis}
                      </button>
                    </div>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{paragraph.speechText}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {paragraph.keywords.map((keyword) => (
                      <Pill key={keyword} muted>
                        {keyword}
                      </Pill>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="panel rounded-[30px] p-5 sm:p-6">
            <SectionIntro
              kicker={copy.studio.outputAudio}
              title={copy.studio.browserPreview}
              description={copy.studio.outputPreviewOnly}
            />

            <div className="mt-5 space-y-4">
              <div className="rounded-[22px] border border-slate-900/8 bg-white/76 p-4 text-sm leading-6 text-slate-600">
                <p className="font-medium text-slate-900">{copy.studio.currentPlayback}</p>
                <p className="mt-2">
                  {playback.state === "idle" ? copy.studio.currentPlaybackIdle : playback.label}
                </p>
                {playback.chunkCount > 0 ? (
                  <p className="mt-2 text-slate-500">
                    {interpolate(copy.studio.playbackProgress, {
                      current: playback.chunkIndex,
                      total: playback.chunkCount
                    })}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-primary" onClick={() => previewOptimized(false)}>
                  {copy.studio.previewFull}
                </button>
                <button type="button" className="btn-secondary" onClick={pauseOrResumePreview} disabled={!canPausePreview}>
                  {playback.state === "paused" ? copy.studio.resumePreview : copy.studio.pausePreview}
                </button>
                <button type="button" className="btn-secondary" onClick={stopPreview}>
                  {copy.studio.stopPreview}
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <SettingField label={copy.studio.startBlock}>
                  <select className="field" value={abStartId} onChange={(event) => setAbStartId(event.target.value)}>
                    {paragraphs.map((paragraph) => (
                      <option key={paragraph.id} value={paragraph.id}>
                        {paragraph.title}
                      </option>
                    ))}
                  </select>
                </SettingField>
                <SettingField label={copy.studio.endBlock}>
                  <select className="field" value={abEndId} onChange={(event) => setAbEndId(event.target.value)}>
                    {paragraphs.map((paragraph) => (
                      <option key={paragraph.id} value={paragraph.id}>
                        {paragraph.title}
                      </option>
                    ))}
                  </select>
                </SettingField>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-secondary" onClick={() => previewRange(false)}>
                  {copy.studio.previewRange}
                </button>
                <button type="button" className="btn-secondary" onClick={() => previewRange(true)}>
                  {copy.studio.loopRange}
                </button>
                <button type="button" className="btn-secondary" onClick={stopBlockLoop}>
                  {copy.studio.stopRange}
                </button>
              </div>
            </div>
          </div>

          <div className="panel rounded-[30px] p-5 sm:p-6">
            <SectionIntro
              kicker={copy.misc.notes}
              title={copy.studio.methodsTitle}
              description={copy.studio.optimizeDescription}
            />
            <div className="mt-5 grid gap-3">
              {TEMPLATE_PRESETS.map((preset) => (
                <div key={preset.id} className="rounded-[22px] border border-slate-900/8 bg-white/76 p-4">
                  <p className="font-medium text-slate-900">{copy.templates[preset.id]?.name ?? preset.id}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{copy.templates[preset.id]?.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </section>
  );

  const materialsView = (
    <section className="space-y-6">
      <div className="panel rounded-[30px] p-5 sm:p-6">
        <SectionIntro
          kicker={copy.sections.materials.kicker}
          title={copy.sections.materials.title}
          description={copy.misc.continueWhereLeftOff}
        />

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_0.34fr]">
          <input
            className="field"
            value={materialsQuery}
            onChange={(event) => setMaterialsQuery(event.target.value)}
            placeholder={copy.materials.searchPlaceholder}
          />
          <select className="field" value={materialsCategory} onChange={(event) => setMaterialsCategory(event.target.value)}>
            <option value="all">{copy.materials.all}</option>
            {MATERIAL_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {copy.categories[category]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredProjects.map((project) => (
          <MaterialCard
            key={project.id}
            project={project}
            copy={copy}
            locale={locale}
            onOpen={openProject}
            onDelete={removeProject}
            onFavorite={toggleFavorite}
          />
        ))}
      </div>

      {filteredProjects.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-10 text-center text-sm leading-6 text-slate-500">
          {copy.materials.empty}
        </div>
      ) : null}
    </section>
  );

  const reviewView = (
    <section className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel rounded-[30px] p-5 sm:p-6">
          <SectionIntro
            kicker={copy.sections.review.kicker}
            title={copy.review.dueTitle}
            description={interpolate(copy.reviewFeedback.queue, { count: dueItems.length })}
          />

          {!currentReviewItem ? (
            <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-10 text-sm leading-6 text-slate-500">
              {copy.review.dueEmpty}
            </div>
          ) : (
            <div className="mt-5 rounded-[26px] border border-slate-900/8 bg-white/78 p-5">
              <div className="flex flex-wrap gap-2">
                <Pill>{currentReviewItem.projectTitle}</Pill>
                {currentReviewItem.difficult ? <Pill muted>{copy.review.difficultTitle}</Pill> : null}
                {currentReviewItem.favorite ? <Pill muted>{copy.materials.favorite}</Pill> : null}
              </div>

              <div className="mt-5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{copy.review.queueLabel}</p>
                <p className="mt-3 text-lg leading-8 text-slate-900">{currentReviewItem.prompt}</p>
              </div>

              <div className="mt-5 rounded-[22px] border border-slate-900/8 bg-slate-50/70 p-4 text-sm leading-7 text-slate-700">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setReviewAnswerVisible((current) => !current)}
                >
                  {reviewAnswerVisible ? copy.review.hideAnswer : copy.review.showAnswer}
                </button>

                <div className="mt-4">
                  {reviewAnswerVisible ? (
                    <>
                      <p className="font-medium text-slate-900">{copy.review.answerLabel}</p>
                      <p className="mt-2 whitespace-pre-wrap">{currentReviewItem.answer}</p>
                      <p className="mt-4 font-medium text-slate-900">{copy.review.sourceLabel}</p>
                      <p className="mt-2">{currentReviewItem.sourceText}</p>
                    </>
                  ) : (
                    copy.misc.noAnswerYet
                  )}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" className="btn-secondary" onClick={() => handleReviewFeedback("again")}>
                  {copy.review.again}
                </button>
                <button type="button" className="btn-secondary" onClick={() => handleReviewFeedback("hard")}>
                  {copy.review.hard}
                </button>
                <button type="button" className="btn-secondary" onClick={() => handleReviewFeedback("good")}>
                  {copy.review.good}
                </button>
                <button type="button" className="btn-primary" onClick={() => handleReviewFeedback("easy")}>
                  {copy.review.easy}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => toggleReviewFlag(currentReviewItem.projectId, currentReviewItem.id, "favorite")}
                >
                  {currentReviewItem.favorite ? copy.studio.removeFavoriteLine : copy.studio.favoriteLine}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => toggleReviewFlag(currentReviewItem.projectId, currentReviewItem.id, "difficult")}
                >
                  {currentReviewItem.difficult ? copy.studio.removeDifficultLine : copy.studio.difficultLine}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="panel rounded-[30px] p-5 sm:p-6">
            <SectionIntro
              kicker={copy.sections.review.kicker}
              title={copy.review.completedToday}
              description={interpolate(copy.reviewFeedback.completed, { count: completedToday.length })}
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-slate-900/8 bg-white/76 p-4 text-sm leading-6 text-slate-600">
                {interpolate(copy.reviewFeedback.favorites, { count: favoriteReviewItems.length })}
              </div>
              <div className="rounded-[22px] border border-slate-900/8 bg-white/76 p-4 text-sm leading-6 text-slate-600">
                {interpolate(copy.reviewFeedback.difficult, { count: difficultReviewItems.length })}
              </div>
            </div>
          </div>

          <div className="panel rounded-[30px] p-5 sm:p-6">
            <SectionIntro
              kicker={copy.sections.review.kicker}
              title={copy.review.suggestionsTitle}
              description={suggestionText}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="panel rounded-[30px] p-5 sm:p-6">
          <SectionIntro
            kicker={copy.review.queueLabel}
            title={copy.review.favoritesTitle}
            description={interpolate(copy.reviewFeedback.favorites, { count: favoriteReviewItems.length })}
          />
          <div className="mt-5 space-y-3">
            {favoriteReviewItems.slice(0, 6).map((item) => (
              <ReviewMiniCard key={getReviewKey(item)} item={item} />
            ))}
          </div>
        </div>

        <div className="panel rounded-[30px] p-5 sm:p-6">
          <SectionIntro
            kicker={copy.review.queueLabel}
            title={copy.review.difficultTitle}
            description={interpolate(copy.reviewFeedback.difficult, { count: difficultReviewItems.length })}
          />
          <div className="mt-5 space-y-3">
            {difficultReviewItems.slice(0, 6).map((item) => (
              <ReviewMiniCard key={getReviewKey(item)} item={item} />
            ))}
          </div>
        </div>
      </section>
    </section>
  );

  const historyView = (
    <section className="space-y-6">
      <div className="panel rounded-[30px] p-5 sm:p-6">
        <SectionIntro
          kicker={copy.sections.history.kicker}
          title={copy.sections.history.title}
          description={isHistoryReady ? `${history.length} ${copy.misc.sessions}` : copy.misc.previewOnly}
        />
      </div>

      <div className="grid gap-4">
        {history.map((entry) => (
          <div key={entry.id} className="panel rounded-[26px] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-2xl font-semibold text-slate-950">{entry.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{formatDate(entry.createdAt, locale)}</p>
              </div>
              <Pill muted>{copy.history.previewOnly}</Pill>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">{entry.text.slice(0, 220)}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" className="btn-primary" onClick={() => restoreHistory(entry)}>
                {copy.history.restore}
              </button>
              <button type="button" className="btn-secondary" onClick={() => replayHistory(entry)}>
                {copy.history.replay}
              </button>
              <button type="button" className="btn-secondary" onClick={() => removeHistory(entry.id)}>
                {copy.history.delete}
              </button>
            </div>
          </div>
        ))}
      </div>

      {history.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-10 text-center text-sm leading-6 text-slate-500">
          {copy.history.empty}
        </div>
      ) : null}
    </section>
  );

  const authView = (
    <section className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="panel rounded-[30px] p-5 sm:p-6">
          <SectionIntro
            kicker={copy.sections.auth.kicker}
            title={copy.sections.auth.title}
            description={copy.auth.description}
          />

          <div className="mt-6 flex flex-wrap gap-2">
            {[
              { id: "sign-in", label: copy.auth.signIn },
              { id: "sign-up", label: copy.auth.signUp },
              { id: "forgot", label: copy.auth.forgot },
              { id: "update-password", label: copy.auth.updatePassword }
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className={`rounded-full px-4 py-2 text-sm transition ${
                  authMode === item.id ? "bg-slate-950 text-white" : "bg-white/78 text-slate-600 hover:bg-white"
                }`}
                onClick={() => {
                  setAuthMode(item.id);
                  setAuthError("");
                  setAuthMessage("");
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleAuthSubmit}>
            {(authMode === "sign-up" || authMode === "update-password") ? (
              <SettingField label={copy.auth.fullName}>
                <input
                  className="field"
                  value={authForm.fullName}
                  onChange={(event) => setAuthForm((current) => ({ ...current, fullName: event.target.value }))}
                  placeholder={copy.auth.fullName}
                />
              </SettingField>
            ) : null}

            <SettingField label={copy.auth.email}>
              <input
                className="field"
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="you@example.com"
              />
            </SettingField>

            {authMode !== "forgot" ? (
              <SettingField label={copy.auth.password}>
                <input
                  className="field"
                  type="password"
                  value={authForm.password}
                  onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="********"
                />
              </SettingField>
            ) : null}

            {(authMode === "sign-up" || authMode === "update-password") ? (
              <SettingField label={copy.auth.confirmPassword}>
                <input
                  className="field"
                  type="password"
                  value={authForm.confirmPassword}
                  onChange={(event) => setAuthForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                  placeholder="********"
                />
              </SettingField>
            ) : null}

            <p className="text-sm leading-6 text-slate-500">
              {{
                "sign-in": copy.auth.signInDescription,
                "sign-up": copy.auth.signUpDescription,
                forgot: copy.auth.forgotDescription,
                "update-password": copy.auth.updatePasswordDescription
              }[authMode]}
            </p>

            {authError ? (
              <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                {authError}
              </div>
            ) : null}

            {authMessage ? (
              <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
                {authMessage}
              </div>
            ) : null}

            <button type="submit" className="btn-primary" disabled={isAuthBusy}>
              {isAuthBusy ? copy.auth.submitBusy : copy.auth.submitIdle}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="panel rounded-[30px] p-5 sm:p-6">
            <SectionIntro
              kicker={copy.sections.auth.kicker}
              title={user ? copy.auth.accountReady : copy.auth.accountGuest}
              description={user ? interpolate(copy.auth.signedInAs, { email: user.email }) : copy.auth.accountGuestDescription}
            />

            <div className="mt-5 space-y-3">
              <div className="rounded-[22px] border border-slate-900/8 bg-white/76 p-4">
                <p className="font-medium text-slate-900">{displayName || user?.email || copy.auth.accountGuest}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{user ? cloudStatus : copy.auth.remember}</p>
              </div>
              <div className="rounded-[22px] border border-slate-900/8 bg-white/76 p-4">
                <p className="font-medium text-slate-900">{copy.settings.cloudSync}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {isAuthConfigured ? cloudStatus : copy.auth.notConfigured}
                </p>
              </div>
            </div>

            {user ? (
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" className="btn-primary" onClick={() => setView("materials")}>
                  {copy.nav.materials}
                </button>
                <button type="button" className="btn-secondary" onClick={handleSignOut}>
                  {copy.auth.signOut}
                </button>
              </div>
            ) : null}
          </div>

          <div className="panel rounded-[30px] p-5 sm:p-6">
            <SectionIntro
              kicker={copy.misc.notes}
              title={copy.settings.account}
              description={copy.auth.title}
            />
          </div>
        </div>
      </section>
    </section>
  );

  const settingsView = (
    <section className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="panel rounded-[30px] p-5 sm:p-6">
          <SectionIntro
            kicker={copy.sections.settings.kicker}
            title={copy.sections.settings.title}
            description={copy.brand.description}
          />

          <div className="mt-6 grid gap-4">
            <SettingField label={copy.settings.dailyGoal} hint={`${platformSettings.dailyGoal}`}>
              <input
                className="w-full"
                type="range"
                min="1"
                max="15"
                step="1"
                value={platformSettings.dailyGoal}
                onChange={(event) => updatePlatformPreference("dailyGoal", Number(event.target.value))}
              />
            </SettingField>
            <SettingField label={copy.settings.preferredSessionMinutes} hint={`${platformSettings.preferredSessionMinutes} min`}>
              <input
                className="w-full"
                type="range"
                min="10"
                max="60"
                step="5"
                value={platformSettings.preferredSessionMinutes}
                onChange={(event) => updatePlatformPreference("preferredSessionMinutes", Number(event.target.value))}
              />
            </SettingField>
            <SettingField label={copy.settings.defaultCategory}>
              <select
                className="field"
                value={platformSettings.defaultCategory}
                onChange={(event) => updatePlatformPreference("defaultCategory", event.target.value)}
              >
                {MATERIAL_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {copy.categories[category]}
                  </option>
                ))}
              </select>
            </SettingField>
            <ToggleRow
              title={copy.settings.autoPlayPreview}
              description={copy.studio.outputPreviewOnly}
              checked={platformSettings.autoPlayPreview}
              onChange={(value) => updatePlatformPreference("autoPlayPreview", value)}
            />
          </div>
        </div>

        <div className="panel rounded-[30px] p-5 sm:p-6">
          <SectionIntro
            kicker={copy.misc.notes}
            title={copy.settings.language}
            description={copy.language.label}
          />

          <div className="mt-6 grid gap-4">
            <div className="rounded-[24px] border border-slate-900/8 bg-white/76 p-4">
              <p className="font-medium text-slate-900">{copy.settings.language}</p>
              <div className="mt-4">
                <LanguageSwitcher variant="light" label={copy.language.label} compact />
              </div>
            </div>
            <div className="rounded-[24px] border border-slate-900/8 bg-white/76 p-4">
              <p className="font-medium text-slate-900">{copy.settings.cloudSync}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {user ? cloudStatus : isAuthConfigured ? copy.auth.accountGuestDescription : copy.auth.notConfigured}
              </p>
            </div>
            <div className="rounded-[24px] border border-slate-900/8 bg-white/76 p-4">
              <p className="font-medium text-slate-900">{copy.settings.aiQuiz}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{copy.brand.tagline}</p>
            </div>
          </div>
        </div>
      </section>
    </section>
  );

  const currentView = {
    home: homeView,
    studio: studioView,
    materials: materialsView,
    review: reviewView,
    history: historyView,
    auth: authView,
    settings: settingsView
  }[activeView];

  return (
    <div className="app-shell" dir={direction}>
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
        {shellHeader}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard label={copy.dashboard.todayDue} value={stats.dueCount} hint={copy.dashboard.unit.items} />
          <StatCard label={copy.dashboard.reviewCount} value={stats.completedReviewCount} hint={copy.dashboard.unit.items} />
          <StatCard label={copy.dashboard.streak} value={stats.streak} hint={copy.dashboard.unit.days} />
          <StatCard label={copy.dashboard.studyMinutes} value={stats.studyMinutes} hint={copy.dashboard.unit.mins} />
          <StatCard label={copy.dashboard.difficultCount} value={stats.difficultCount} hint={copy.dashboard.unit.items} />
          <StatCard label={copy.dashboard.favorites} value={stats.favoriteCount} hint={copy.dashboard.unit.items} />
        </section>

        <section className="rounded-[28px] bg-transparent">{currentView}</section>

        <footer className="pb-4 text-center text-sm leading-6 text-slate-500">
          {characterCount} {copy.misc.chars} · {wordCount} {copy.misc.words}
        </footer>
      </main>
    </div>
  );
}
