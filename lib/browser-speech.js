const CHINESE_SENTENCE_SPLITTER = /(?<=[\u3002\uff01\uff1f\uff1b\uff1a])/u;
const ENGLISH_SENTENCE_SPLITTER = /(?<=[.!?;:])/;

function normalizeText(text = "") {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function splitLongSentence(sentence, language, maxLength) {
  if (!sentence || sentence.length <= maxLength) {
    return [sentence].filter(Boolean);
  }

  const separator = language.startsWith("en") ? /(?<=[,])/ : /(?<=[\uff0c\u3001])/u;
  const parts = sentence
    .split(separator)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return sentence.match(new RegExp(`.{1,${maxLength}}`, "g")) ?? [sentence];
  }

  const chunks = [];
  let current = "";

  for (const part of parts) {
    const next = current
      ? language.startsWith("en")
        ? `${current} ${part}`
        : `${current}${part}`
      : part;

    if (next.length <= maxLength) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    current = part;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function splitIntoSentences(text, language) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }

  const splitter = language.startsWith("en") ? ENGLISH_SENTENCE_SPLITTER : CHINESE_SENTENCE_SPLITTER;

  const sentences = normalized
    .split(/\n{2,}/)
    .flatMap((paragraph) =>
      paragraph
        .split(splitter)
        .map((sentence) => sentence.trim())
        .filter(Boolean)
    );

  return sentences.length ? sentences : [normalized];
}

export function resolvePreviewLanguage(preferredLanguage, optimizedLanguage) {
  if (optimizedLanguage) {
    return optimizedLanguage;
  }

  if (!preferredLanguage || preferredLanguage === "zh-CN|en-US") {
    return "zh-CN";
  }

  return preferredLanguage;
}

export function chunkSpeechText(text, language, maxLength = 220) {
  const sentences = splitIntoSentences(text, language);
  if (!sentences.length) {
    return [];
  }

  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    const safePieces = splitLongSentence(sentence, language, maxLength);

    for (const piece of safePieces) {
      const next = current ? `${current}\n${piece}` : piece;

      if (next.length <= maxLength) {
        current = next;
        continue;
      }

      if (current) {
        chunks.push(current);
      }

      current = piece;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function languageMatches(voice, targetLanguage) {
  const voiceLanguage = (voice?.lang ?? "").toLowerCase();
  const normalizedTarget = targetLanguage.toLowerCase();

  if (!voiceLanguage) {
    return false;
  }

  if (normalizedTarget === "zh-cn|en-us") {
    return voiceLanguage.startsWith("zh") || voiceLanguage.startsWith("en");
  }

  const primaryLanguage = normalizedTarget.split("-")[0];
  return (
    voiceLanguage === normalizedTarget ||
    voiceLanguage.startsWith(`${primaryLanguage}-`) ||
    voiceLanguage === primaryLanguage
  );
}

export function getVoicesForLanguage(voices, targetLanguage) {
  return (voices ?? []).filter((voice) => languageMatches(voice, targetLanguage));
}

export function pickBrowserVoice({ voices, browserVoiceName, targetLanguage }) {
  const allVoices = voices ?? [];

  if (browserVoiceName) {
    const exactMatch = allVoices.find((voice) => voice.name === browserVoiceName);
    if (exactMatch) {
      return exactMatch;
    }
  }

  const localizedVoices = getVoicesForLanguage(allVoices, targetLanguage);
  const candidates = localizedVoices.length ? localizedVoices : allVoices;

  if (!candidates.length) {
    return null;
  }

  return candidates.find((voice) => voice.default) ?? candidates[0];
}

export function getBrowserSpeechSupport() {
  return typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";
}
