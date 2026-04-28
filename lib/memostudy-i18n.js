import { defaultLocale } from "@/lib/i18n";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeMessages(base, override) {
  if (!isObject(base)) {
    return override ?? base;
  }

  const result = { ...base };
  for (const key of Object.keys(override ?? {})) {
    result[key] =
      isObject(base[key]) && isObject(override[key])
        ? mergeMessages(base[key], override[key])
        : override[key];
  }

  return result;
}

export function interpolate(template, variables = {}) {
  if (typeof template !== "string") {
    return "";
  }

  return template.replace(/\{(\w+)\}/g, (_, key) => `${variables[key] ?? ""}`);
}

const englishMessages = {
  brand: {
    name: "MemoStudy",
    tagline: "AI memory learning platform",
    description:
      "MemoStudy turns notes, textbooks, speeches, and vocabulary into chunked study projects with listening practice, active recall, spaced repetition, and review tracking."
  },
  language: {
    label: "Interface language"
  },
  nav: {
    home: "Home",
    studio: "Studio",
    materials: "My Materials",
    review: "Review",
    history: "History",
    auth: "Auth",
    settings: "Settings",
    start: "Start learning"
  },
  home: {
    badge: "AI memory learning platform",
    title: "Study with structure, recall rhythm, and review that actually sticks.",
    description:
      "Build learning projects, reinforce difficult blocks, review at the right time, and keep reading, listening, speaking, and answering connected in one place.",
    primary: "Open study studio",
    secondary: "See today's review",
    dailyTitle: "Today's focus",
    dailyDescription:
      "Use one workspace for recitation, vocabulary memory, review, speech practice, and follow-reading.",
    todayReview: "Today's review",
    recentSessions: "Recent learning activity",
    recommendedModes: "Recommended study modes",
    methodsTitle: "Built around real learning methods",
    methods: {
      spaced: {
        title: "Spaced repetition",
        description: "Schedule review at increasing intervals so memory fades more slowly."
      },
      recall: {
        title: "Active recall",
        description: "Try to answer first, then reveal prompts, answers, and focus cues."
      },
      chunking: {
        title: "Chunked learning",
        description: "Break long materials into smaller blocks with focus lines and recap rhythm."
      },
      multimodal: {
        title: "Multi-channel memory",
        description: "Read, listen, shadow, and answer from the same study project."
      },
      difficult: {
        title: "Difficult-point reinforcement",
        description: "Mark weak lines and send them back into the review queue more often."
      }
    }
  },
  dashboard: {
    todayDue: "Due today",
    reviewCount: "Total reviews",
    streak: "Learning streak",
    studyMinutes: "Study minutes",
    difficultCount: "Difficult items",
    materials: "Saved materials",
    favorites: "Favorites",
    unit: {
      days: "days",
      mins: "mins",
      items: "items"
    }
  },
  sections: {
    home: { kicker: "Home", title: "Learning dashboard" },
    studio: { kicker: "Studio", title: "Learning workspace" },
    materials: { kicker: "My Materials", title: "Saved study projects" },
    review: { kicker: "Review", title: "Review center" },
    history: { kicker: "History", title: "Learning history" },
    auth: { kicker: "Auth", title: "Account and sync" },
    settings: { kicker: "Settings", title: "Study preferences" }
  },
  studio: {
    projectTitle: "Project title",
    projectTitlePlaceholder: "e.g. Biology chapter 3 / Speech outline / TOEFL vocabulary",
    projectCategory: "Category",
    saveProject: "Save as study project",
    updateProject: "Update current project",
    openProject: "Open in studio",
    createNew: "New study material",
    contentInput: "Text input and file parsing",
    contentPlaceholder: "Paste the material you want to memorize, review, recite, or practice aloud...",
    uploadTitle: "Upload materials",
    uploadDescription: "Import TXT, DOCX, or PDF and fill the workspace automatically.",
    uploadIdle: "Upload study file",
    uploadBusy: "Parsing file...",
    uploadNotes: [
      "TXT, DOCX, and PDF are supported.",
      "Extracted text fills the study editor automatically.",
      "Unreadable files will show a clear error message."
    ],
    templatesTitle: "Study modes",
    optimizeTitle: "Memory optimization",
    optimizeDescription:
      "Chunk the material, extract focus points, reinforce keywords, add review pauses, and prepare recall-friendly study text.",
    optimizeIdle: "Optimize for memory",
    optimizeBusy: "Optimizing...",
    previewIdle: "Generate study preview",
    previewBusy: "Preparing preview...",
    clear: "Clear text",
    sample: "Load sample",
    saveHint: "Save the current workspace as a reusable study project and continue later.",
    methodsTitle: "How this material will be studied",
    methodsDescription:
      "Use recitation, vocabulary memory, knowledge review, speech practice, and follow-reading without leaving the same workspace.",
    outputScript: "Optimized study script",
    outputAudio: "Listening practice",
    outputPreviewOnly:
      "This static build keeps browser preview, local review logic, uploads, and study project management. Server-generated MP3 can be reconnected later.",
    stopPreview: "Stop preview",
    pausePreview: "Pause preview",
    resumePreview: "Resume preview",
    browserPreview: "Browser preview",
    previewFull: "Preview full script",
    playBlock: "Play block",
    loopThis: "Loop this block",
    stopLoop: "Stop loop",
    abLoopTitle: "A-B review range",
    abLoopDescription: "Pick a start and end block for repeated listening practice.",
    startBlock: "Start block",
    endBlock: "End block",
    previewRange: "Preview A-B range",
    loopRange: "Loop A-B range",
    stopRange: "Stop A-B loop",
    followPause: "Follow-reading pause",
    favoriteLine: "Add to favorites",
    difficultLine: "Mark difficult",
    removeFavoriteLine: "Remove favorite",
    removeDifficultLine: "Remove difficult",
    empty: "Optimize the current material to generate study blocks, listening text, and review-ready cues.",
    blockKeywords: "Keywords: {value}",
    blockFocus: "Focus: {value}",
    reviewCue: "Review cue",
    blockCount: "{count} study blocks",
    currentPlayback: "Current playback",
    currentPlaybackIdle: "Nothing is playing right now.",
    currentPlaybackPlaying: "Now playing",
    currentPlaybackPaused: "Playback paused",
    playbackProgress: "Chunk {current} / {total}",
    browserVoiceTitle: "Browser preview voice",
    browserVoiceDescription: "Browser preview uses the voices installed on this device.",
    browserVoiceAuto: "Auto match by language",
    browserVoiceUnavailable:
      "No matching browser voice is available yet. Try Auto or refresh once the browser finishes loading voices.",
    browserVoiceReady: "{count} voices available for the current preview language.",
    refreshVoices: "Refresh voices",
    speechUnsupported: "This browser doesn't support Speech Synthesis preview.",
    sampleText: `Spaced repetition works best when a long note is divided into smaller study blocks and reviewed again at the right time.

If you are memorizing a speech, start with clear chunks, highlight the key phrases, and repeat the most important lines with stronger pauses.

If you are learning vocabulary, combine the word, a short example, and a recall prompt so listening, speaking, and answering stay connected.`
  },
  materials: {
    search: "Search materials",
    searchPlaceholder: "Search by title, excerpt, or category",
    all: "All categories",
    empty: "No saved study projects yet. Save something from Studio to continue later.",
    continue: "Continue studying",
    favorite: "Favorite",
    unfavorite: "Remove favorite",
    dueSoon: "due",
    blocks: "{count} blocks",
    keywords: "{count} keywords",
    difficult: "{count} difficult",
    delete: "Delete",
    lastStudied: "Last studied {date}",
    neverStudied: "Not studied yet"
  },
  review: {
    dueTitle: "Today's review queue",
    dueEmpty: "No due items right now. Start a new study project or deepen difficult lines.",
    showAnswer: "Show answer",
    hideAnswer: "Hide answer",
    again: "Again",
    hard: "Hard",
    good: "Good",
    easy: "Easy",
    completedToday: "Completed today",
    favoritesTitle: "Favorite review items",
    difficultTitle: "Difficult review items",
    suggestionsTitle: "Review suggestions",
    queueLabel: "Queue",
    answerLabel: "Answer",
    sourceLabel: "Source text",
    openProject: "Open project",
    suggestionDifficult: "Start with difficult items first so weak points get reinforced earlier.",
    suggestionBatch: "You have a healthy review queue. Complete one focused batch today.",
    suggestionNew: "Your review queue is light. Add a new project or deepen current notes."
  },
  history: {
    empty: "No recent study sessions yet.",
    restore: "Restore session",
    replay: "Replay preview",
    download: "Download again",
    delete: "Delete",
    previewOnly: "Preview session",
    hasAudio: "Audio ready"
  },
  auth: {
    title: "Create an account, sync your study data, and keep learning across devices.",
    description:
      "MemoStudy uses client-side Supabase Auth so Netlify static deployment stays simple while saved materials and review snapshots can still sync.",
    signIn: "Sign in",
    signUp: "Create account",
    forgot: "Forgot password",
    updatePassword: "Update password",
    signOut: "Sign out",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm password",
    fullName: "Display name",
    remember: "Session is kept by Supabase in the browser.",
    signInDescription: "Use your email and password to reopen your synced study workspace.",
    signUpDescription: "Create your MemoStudy account and start saving learning data per user.",
    forgotDescription: "Send a password reset email. The recovery link can return to this site.",
    updatePasswordDescription: "Choose a new password after the recovery link opens MemoStudy.",
    accountReady: "Account connected",
    accountGuest: "Guest mode",
    accountGuestDescription: "You can keep using local study mode even without an account.",
    signedInAs: "Signed in as {email}",
    syncReady: "Cloud snapshot sync is available.",
    syncPending: "Syncing account data...",
    syncOff: "Cloud sync is not configured yet for this deployment.",
    notConfigured:
      "Supabase Auth is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY on Netlify and locally.",
    submitIdle: "Continue",
    submitBusy: "Working...",
    validation: {
      emailRequired: "Please enter your email address.",
      passwordRequired: "Please enter your password.",
      passwordShort: "Use at least 8 characters.",
      nameRequired: "Please enter your display name.",
      passwordMismatch: "The passwords do not match."
    },
    success: {
      signedIn: "Signed in successfully.",
      signedUp: "Account created. Check your inbox if email confirmation is enabled.",
      signedOut: "Signed out.",
      resetSent: "Password reset email sent.",
      passwordUpdated: "Password updated."
    }
  },
  settings: {
    language: "Interface language",
    dailyGoal: "Daily review goal",
    preferredSessionMinutes: "Preferred session length",
    autoPlayPreview: "Auto-play browser preview after generating",
    defaultCategory: "Default material category",
    cloudSync: "Cloud sync",
    account: "Account system",
    aiQuiz: "AI quiz and Q&A reserved"
  },
  categories: {
    textbook: "Textbook",
    vocabulary: "Vocabulary",
    knowledge: "Knowledge",
    speech: "Speech",
    exam: "Exam review"
  },
  modes: {
    normal: "Normal mode",
    recitation: "Recitation mode",
    review: "Knowledge review mode",
    cloze: "Active recall mode",
    speech: "Speech practice mode"
  },
  templates: {
    recite: {
      name: "Recitation mode",
      summary: "Slower rhythm, stronger pauses, and more deliberate repetition."
    },
    vocabulary: {
      name: "Vocabulary memory mode",
      summary: "Great for words, examples, meanings, and repeated listening."
    },
    speech: {
      name: "Speech practice mode",
      summary: "Keep a natural speaking flow with pause windows for shadowing."
    },
    review: {
      name: "Knowledge review mode",
      summary: "Extract focus lines and recap each block for exam-style review."
    }
  },
  options: {
    speechLanguage: "Speech language",
    model: "Voice model",
    voice: "Voice",
    browserVoice: "Browser preview voice",
    bilingual: "Bilingual mode",
    emphasis: "Emphasis",
    pause: "Pause strength",
    repeatKeywords: "Repeat keywords",
    repeatFocus: "Repeat focus sentences",
    paragraphAudio: "Generate by chunk",
    sentenceRepeat: "Sentence repeat count",
    keywordRepeat: "Keyword repeat count",
    focusRepeat: "Difficult sentence repeat count",
    speed: "Speed"
  },
  optionValues: {
    speechLanguage: {
      "zh-CN": "Chinese",
      "en-US": "English",
      "zh-CN|en-US": "Bilingual"
    },
    model: {
      "gpt-4o-mini-tts": "gpt-4o-mini-tts",
      "tts-1-hd": "tts-1-hd",
      "tts-1": "tts-1"
    },
    voice: {
      alloy: "Alloy / neutral",
      sage: "Sage / grounded",
      coral: "Coral / warm",
      nova: "Nova / bright",
      onyx: "Onyx / low",
      shimmer: "Shimmer / light"
    },
    bilingual: {
      off: "Off",
      "line-translation": "Line + cue",
      "english-only": "English only",
      "word-translation": "Word + example + meaning"
    },
    emphasis: {
      light: "Light",
      balanced: "Balanced",
      strong: "Strong"
    },
    pause: {
      soft: "Soft",
      medium: "Medium",
      strong: "Strong"
    }
  },
  api: {
    uploadMissingFile: "Please choose a file first.",
    uploadEmptyFile: "This file is empty.",
    uploadTooLarge: "Files larger than 15 MB are not supported yet.",
    uploadUnsupported: "Only TXT, DOCX, and PDF are supported right now.",
    uploadNoText: "No readable text was found in this file."
  },
  statuses: {
    ready: "Ready to build a new study session.",
    projectSaved: 'Saved "{title}" as a study project.',
    projectUpdated: 'Updated "{title}".',
    optimizeDone: "Memory optimization completed.",
    optimizeFail: "Memory optimization failed. Please check the text and try again.",
    uploadParsing: 'Parsing "{name}"...',
    uploadDone: 'Extracted text from "{name}" and inserted it into the workspace.',
    uploadFail: "File parsing failed. Please try another file.",
    historyInitFail: "History could not be loaded, but the current workspace still works.",
    reviewDone: "Review feedback recorded.",
    materialOpened: 'Opened "{title}" in Studio.',
    materialDeleted: "Study project deleted.",
    favoriteUpdated: "Favorite status updated.",
    difficultUpdated: "Difficult status updated.",
    previewReady: "Browser preview is ready.",
    previewStopped: "Preview stopped.",
    previewPaused: "Preview paused.",
    previewResumed: "Preview resumed.",
    previewFailed: "Browser preview failed. Try another browser voice or shorter text.",
    loopOn: "Block loop enabled.",
    loopOff: "Block loop disabled.",
    rangePreview: "Previewing the selected A-B range.",
    rangeLoopOn: "A-B loop enabled.",
    rangeLoopOff: "A-B loop stopped.",
    authSignedIn: "Account signed in successfully.",
    authSignedUp: "Account created successfully.",
    authSignedOut: "Signed out successfully.",
    authResetSent: "Password reset email sent.",
    authPasswordUpdated: "Password updated.",
    authRecovery: "Recovery session detected. You can set a new password now.",
    authSyncReady: "Cloud study snapshot is in sync.",
    authSyncFail: "Cloud sync could not be completed. Local study mode still works."
  },
  reviewFeedback: {
    queue: "{count} due now",
    completed: "{count} completed today",
    favorites: "{count} favorite items",
    difficult: "{count} difficult items"
  },
  misc: {
    autosave: "Draft autosaved",
    uploadedFile: "Current upload: {name}",
    noAnswerYet: "Try to recall it before revealing the answer.",
    today: "Today",
    continueWhereLeftOff: "Continue where you left off",
    learningModes: "Learning modes",
    studyProject: "Study project",
    reviewQueue: "Review queue",
    notes: "Notes",
    untitled: "Untitled study material",
    previewOnly: "Preview only",
    noProjects: "No projects yet",
    currentProject: "Current project",
    todaysPriority: "Today's priority",
    chars: "chars",
    words: "words",
    sessions: "sessions"
  }
};

const chineseOverrides = {};

const localeOverrides = {
  zh: chineseOverrides,
  ja: {
    brand: { tagline: "AI memory learning platform" },
    language: { label: "Interface language" }
  },
  ko: {
    brand: { tagline: "AI memory learning platform" },
    language: { label: "Interface language" }
  },
  fr: {
    brand: { tagline: "AI memory learning platform" },
    language: { label: "Interface language" }
  },
  de: {
    brand: { tagline: "AI memory learning platform" },
    language: { label: "Interface language" }
  },
  es: {
    brand: { tagline: "AI memory learning platform" },
    language: { label: "Interface language" }
  },
  pt: {
    brand: { tagline: "AI memory learning platform" },
    language: { label: "Interface language" }
  },
  ru: {
    brand: { tagline: "AI memory learning platform" },
    language: { label: "Interface language" }
  },
  ar: {
    brand: { tagline: "AI memory learning platform" },
    language: { label: "Interface language" }
  }
};

const memoStudyMessages = {
  en: englishMessages,
  zh: mergeMessages(englishMessages, localeOverrides.zh),
  ja: mergeMessages(englishMessages, localeOverrides.ja),
  ko: mergeMessages(englishMessages, localeOverrides.ko),
  fr: mergeMessages(englishMessages, localeOverrides.fr),
  de: mergeMessages(englishMessages, localeOverrides.de),
  es: mergeMessages(englishMessages, localeOverrides.es),
  pt: mergeMessages(englishMessages, localeOverrides.pt),
  ru: mergeMessages(englishMessages, localeOverrides.ru),
  ar: mergeMessages(englishMessages, localeOverrides.ar)
};

export function getMemoStudyMessages(locale = defaultLocale) {
  return memoStudyMessages[locale] ?? memoStudyMessages[defaultLocale];
}
