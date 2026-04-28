const PROJECTS_KEY = "memostudy:projects";
const PLATFORM_SETTINGS_KEY = "memostudy:platform-settings";
const ACTIVE_VIEW_KEY = "memostudy:active-view";

const REVIEW_INTERVALS = [0, 1, 3, 7, 14, 30];

export const MATERIAL_CATEGORIES = [
  "textbook",
  "vocabulary",
  "knowledge",
  "speech",
  "exam"
];

export const APP_SECTIONS = [
  "home",
  "studio",
  "materials",
  "review",
  "history",
  "auth",
  "settings"
];

export const DEFAULT_PLATFORM_SETTINGS = {
  dailyGoal: 6,
  preferredSessionMinutes: 20,
  autoPlayPreview: false,
  defaultCategory: "knowledge"
};

function readJson(key, fallback) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw);
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

function writeJson(key, value) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function createReviewCards(optimized) {
  return (optimized?.paragraphs ?? []).map((paragraph, index) => ({
    id: paragraph.id,
    title: paragraph.title,
    prompt: paragraph.focus || paragraph.sourceText,
    answer: paragraph.speechText,
    sourceText: paragraph.sourceText,
    focusSentences: paragraph.focusSentences ?? [],
    favorite: false,
    difficult: false,
    reviewCount: 0,
    completedCount: 0,
    intervalIndex: 0,
    nextReviewAt: new Date().toISOString(),
    lastReviewedAt: null,
    lastRating: null,
    order: index
  }));
}

function getProjectSummary(text, optimized) {
  const firstLine = text.split(/\n/).find(Boolean)?.trim() ?? "Untitled study material";
  return {
    title: firstLine.slice(0, 36),
    excerpt: firstLine.slice(0, 80),
    blockCount: optimized?.paragraphs?.length ?? 0,
    keywordCount: optimized?.keywords?.length ?? 0
  };
}

export function buildStudyProject({
  title,
  category,
  text,
  settings,
  optimized,
  mode,
  existingId
}) {
  const now = new Date().toISOString();
  const summary = getProjectSummary(text, optimized);
  return {
    id: existingId ?? `project-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: title?.trim() || summary.title,
    category,
    mode,
    text,
    settings,
    optimized,
    excerpt: summary.excerpt,
    blockCount: summary.blockCount,
    keywordCount: summary.keywordCount,
    favorite: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    lastStudiedAt: null,
    reviewCards: createReviewCards(optimized)
  };
}

export function loadProjects() {
  return readJson(PROJECTS_KEY, []);
}

export function saveProjects(projects) {
  writeJson(PROJECTS_KEY, projects);
}

export function loadPlatformSettings() {
  return { ...DEFAULT_PLATFORM_SETTINGS, ...readJson(PLATFORM_SETTINGS_KEY, {}) };
}

export function savePlatformSettings(settings) {
  writeJson(PLATFORM_SETTINGS_KEY, settings);
}

export function loadActiveView() {
  return readJson(ACTIVE_VIEW_KEY, "home");
}

export function saveActiveView(view) {
  writeJson(ACTIVE_VIEW_KEY, view);
}

export function upsertProject(projects, project) {
  const existing = projects.find((item) => item.id === project.id);

  if (!existing) {
    return [project, ...projects];
  }

  return projects.map((item) => (item.id === project.id ? { ...project, createdAt: item.createdAt } : item));
}

export function deleteProject(projects, projectId) {
  return projects.filter((project) => project.id !== projectId);
}

export function toggleProjectFavorite(projects, projectId) {
  return projects.map((project) =>
    project.id === projectId ? { ...project, favorite: !project.favorite, updatedAt: new Date().toISOString() } : project
  );
}

export function toggleCardFlag(projects, projectId, cardId, key) {
  return projects.map((project) => {
    if (project.id !== projectId) {
      return project;
    }

    return {
      ...project,
      updatedAt: new Date().toISOString(),
      reviewCards: project.reviewCards.map((card) =>
        card.id === cardId ? { ...card, [key]: !card[key] } : card
      )
    };
  });
}

export function markProjectStudied(projects, projectId) {
  const now = new Date().toISOString();

  return projects.map((project) =>
    project.id === projectId
      ? {
          ...project,
          updatedAt: now,
          lastStudiedAt: now
        }
      : project
  );
}

function scheduleCard(card, rating) {
  const currentIndex = card.intervalIndex ?? 0;
  let nextIndex = currentIndex;

  if (rating === "again") {
    nextIndex = 0;
  } else if (rating === "hard") {
    nextIndex = Math.min(currentIndex + 1, REVIEW_INTERVALS.length - 2);
  } else if (rating === "good") {
    nextIndex = Math.min(currentIndex + 1, REVIEW_INTERVALS.length - 1);
  } else if (rating === "easy") {
    nextIndex = Math.min(currentIndex + 2, REVIEW_INTERVALS.length - 1);
  }

  const difficultBoost = card.difficult ? -1 : 0;
  const intervalDays = Math.max(0, REVIEW_INTERVALS[Math.max(0, nextIndex + difficultBoost)]);
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);

  return {
    ...card,
    lastRating: rating,
    lastReviewedAt: new Date().toISOString(),
    reviewCount: (card.reviewCount ?? 0) + 1,
    completedCount: (card.completedCount ?? 0) + (rating === "again" ? 0 : 1),
    intervalIndex: nextIndex,
    nextReviewAt: nextReviewDate.toISOString()
  };
}

export function reviewProjectCard(projects, projectId, cardId, rating) {
  const now = new Date().toISOString();

  return projects.map((project) => {
    if (project.id !== projectId) {
      return project;
    }

    return {
      ...project,
      updatedAt: now,
      lastStudiedAt: now,
      reviewCards: project.reviewCards.map((card) =>
        card.id === cardId ? scheduleCard(card, rating) : card
      )
    };
  });
}

export function getReviewDeck(projects) {
  const now = new Date();

  return projects.flatMap((project) =>
    (project.reviewCards ?? []).map((card) => ({
      ...card,
      projectId: project.id,
      projectTitle: project.title,
      projectCategory: project.category,
      due:
        !card.nextReviewAt ||
        new Date(card.nextReviewAt).getTime() <= now.getTime()
    }))
  );
}

export function getDueReviewItems(projects) {
  return getReviewDeck(projects)
    .filter((item) => item.due)
    .sort((a, b) => {
      if (a.difficult !== b.difficult) {
        return a.difficult ? -1 : 1;
      }

      const timeA = a.nextReviewAt ? new Date(a.nextReviewAt).getTime() : 0;
      const timeB = b.nextReviewAt ? new Date(b.nextReviewAt).getTime() : 0;
      if (timeA !== timeB) {
        return timeA - timeB;
      }

      return (a.order ?? 0) - (b.order ?? 0);
    });
}

export function getFavoriteReviewItems(projects) {
  return getReviewDeck(projects).filter((item) => item.favorite);
}

export function getDifficultReviewItems(projects) {
  return getReviewDeck(projects).filter((item) => item.difficult);
}

export function getCompletedReviewItemsToday(projects) {
  const today = new Date();
  const dayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  return getReviewDeck(projects).filter((item) => {
    if (!item.lastReviewedAt) {
      return false;
    }

    const reviewed = new Date(item.lastReviewedAt);
    return `${reviewed.getFullYear()}-${reviewed.getMonth()}-${reviewed.getDate()}` === dayKey;
  });
}

export function getLearningStats(projects, sessions = []) {
  const reviewDeck = getReviewDeck(projects);
  const dueItems = reviewDeck.filter((item) => item.due);
  const completedCards = reviewDeck.filter((item) => item.completedCount > 0);
  const difficultItems = reviewDeck.filter((item) => item.difficult);
  const favoriteItems = reviewDeck.filter((item) => item.favorite);
  const lastStudyDates = projects
    .map((project) => project.lastStudiedAt)
    .filter(Boolean)
    .map((value) => new Date(value))
    .sort((a, b) => b.getTime() - a.getTime());

  let streak = 0;
  if (lastStudyDates.length > 0) {
    const seen = new Set(lastStudyDates.map((date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`));
    const cursor = new Date();

    while (seen.has(`${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  return {
    totalProjects: projects.length,
    dueCount: dueItems.length,
    completedReviewCount: completedCards.reduce((sum, item) => sum + (item.completedCount ?? 0), 0),
    streak,
    studyMinutes: sessions.length * 12,
    difficultCount: difficultItems.length,
    favoriteCount: favoriteItems.length
  };
}

export function getRecommendedModes(projects) {
  const modeCount = new Map();

  for (const project of projects) {
    const key = project.mode ?? "recitation";
    modeCount.set(key, (modeCount.get(key) ?? 0) + 1);
  }

  return [...modeCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([mode]) => mode);
}

export function getProjectsByCategory(projects, category) {
  if (!category || category === "all") {
    return projects;
  }

  return projects.filter((project) => project.category === category);
}

export function getReviewSuggestions(projects) {
  const dueItems = getDueReviewItems(projects);
  const difficultItems = getDifficultReviewItems(projects);

  return {
    dueHeadline: dueItems[0]?.projectTitle ?? null,
    difficultHeadline: difficultItems[0]?.projectTitle ?? null,
    recommendation:
      difficultItems.length > 0
        ? "difficult-first"
        : dueItems.length > 4
          ? "review-batch"
          : "start-new-material"
  };
}
