import { DEFAULT_SETTINGS } from "@/lib/tts-presets";

export function getLocalizedDefaultSettings(locale) {
  if (locale === "zh") {
    return {
      ...DEFAULT_SETTINGS,
      language: "zh-CN",
      mode: "recitation",
      voice: "alloy",
      speed: 0.84,
      repeatKeywords: true,
      keywordRepeatCount: 2,
      repeatFocusSentences: true,
      focusSentenceRepeatCount: 2,
      repeatCount: 2,
      emphasis: "strong",
      pauseStrength: "strong"
    };
  }

  return {
    ...DEFAULT_SETTINGS,
    language: "en-US",
    mode: "cloze",
    voice: "sage",
    speed: 0.8,
    repeatKeywords: true,
    keywordRepeatCount: 2,
    repeatFocusSentences: true,
    focusSentenceRepeatCount: 2,
    repeatCount: 2,
    emphasis: "strong",
    pauseStrength: "strong"
  };
}

export function getLocalizedSampleText(messages) {
  return messages?.studio?.sampleText ?? "";
}
