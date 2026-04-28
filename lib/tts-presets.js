export const TEMPLATE_PRESETS = [
  {
    id: "recite",
    settings: {
      language: "zh-CN",
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      speed: 0.84,
      mode: "recitation",
      repeatKeywords: true,
      keywordRepeatCount: 2,
      repeatFocusSentences: true,
      focusSentenceRepeatCount: 2,
      repeatCount: 2,
      browserVoiceName: "",
      paragraphAudio: true,
      bilingualMode: "off",
      emphasis: "balanced",
      pauseStrength: "strong"
    }
  },
  {
    id: "vocabulary",
    settings: {
      language: "en-US",
      model: "gpt-4o-mini-tts",
      voice: "sage",
      speed: 0.78,
      mode: "cloze",
      repeatKeywords: true,
      keywordRepeatCount: 3,
      repeatFocusSentences: true,
      focusSentenceRepeatCount: 2,
      repeatCount: 3,
      browserVoiceName: "",
      paragraphAudio: true,
      bilingualMode: "word-translation",
      emphasis: "strong",
      pauseStrength: "strong"
    }
  },
  {
    id: "speech",
    settings: {
      language: "en-US",
      model: "gpt-4o-mini-tts",
      voice: "coral",
      speed: 0.92,
      mode: "speech",
      repeatKeywords: false,
      keywordRepeatCount: 1,
      repeatFocusSentences: false,
      focusSentenceRepeatCount: 1,
      repeatCount: 1,
      browserVoiceName: "",
      paragraphAudio: true,
      bilingualMode: "off",
      emphasis: "light",
      pauseStrength: "medium"
    }
  },
  {
    id: "review",
    settings: {
      language: "zh-CN",
      model: "tts-1-hd",
      voice: "nova",
      speed: 0.88,
      mode: "review",
      repeatKeywords: true,
      keywordRepeatCount: 2,
      repeatFocusSentences: true,
      focusSentenceRepeatCount: 2,
      repeatCount: 2,
      browserVoiceName: "",
      paragraphAudio: true,
      bilingualMode: "off",
      emphasis: "strong",
      pauseStrength: "medium"
    }
  }
];

export const LANGUAGE_OPTIONS = ["zh-CN", "en-US", "zh-CN|en-US"];

export const MODEL_OPTIONS = ["gpt-4o-mini-tts", "tts-1-hd", "tts-1"];

export const VOICE_OPTIONS = ["alloy", "sage", "coral", "nova", "onyx", "shimmer"];

export const BILINGUAL_OPTIONS = ["off", "line-translation", "english-only", "word-translation"];

export const MODE_OPTIONS = ["normal", "recitation", "review", "cloze", "speech"];

export const EMPHASIS_OPTIONS = ["light", "balanced", "strong"];

export const PAUSE_OPTIONS = ["soft", "medium", "strong"];

export const DEFAULT_SETTINGS = {
  language: "en-US",
  model: "gpt-4o-mini-tts",
  voice: "sage",
  speed: 0.88,
  mode: "review",
  repeatKeywords: true,
  keywordRepeatCount: 2,
  repeatFocusSentences: true,
  focusSentenceRepeatCount: 2,
  repeatCount: 2,
  browserVoiceName: "",
  paragraphAudio: true,
  bilingualMode: "off",
  emphasis: "balanced",
  pauseStrength: "medium"
};
