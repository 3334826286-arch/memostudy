const CHINESE_SENTENCE_SPLITTER = /(?<=[\u3002\uff01\uff1f\uff1b\uff1a])/u;
const ENGLISH_SENTENCE_SPLITTER = /(?<=[.!?;:])/;

const CHINESE_BLACKLIST = new Set([
  "\u6211\u4eec",
  "\u4f60\u4eec",
  "\u4ee5\u53ca",
  "\u5982\u679c",
  "\u56e0\u4e3a",
  "\u6240\u4ee5",
  "\u53ef\u4ee5",
  "\u8fd9\u4e2a",
  "\u4e00\u4e2a",
  "\u7136\u540e",
  "\u73b0\u5728",
  "\u9700\u8981",
  "\u8fdb\u884c",
  "\u81ea\u5df1",
  "\u5df2\u7ecf",
  "\u6216\u8005"
]);

const ENGLISH_BLACKLIST = new Set([
  "this",
  "that",
  "with",
  "from",
  "your",
  "their",
  "there",
  "which",
  "about",
  "into",
  "have",
  "when",
  "them",
  "will"
]);

function normalizeText(text = "") {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function detectLanguage(text, preferredLanguage = "zh-CN") {
  if (preferredLanguage && preferredLanguage !== "zh-CN|en-US") {
    return preferredLanguage.startsWith("en") ? "en-US" : "zh-CN";
  }

  const chineseMatches = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const englishMatches = text.match(/[A-Za-z]/g)?.length ?? 0;

  return englishMatches > chineseMatches ? "en-US" : "zh-CN";
}

function splitParagraphs(text) {
  return normalizeText(text)
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitLongSentence(sentence, language, maxLength = 140) {
  if (!sentence || sentence.length <= maxLength) {
    return [sentence].filter(Boolean);
  }

  const separator = language.startsWith("en") ? /(?<=[,])/ : /(?<=[\uff0c\u3001])/u;
  const parts = sentence
    .split(separator)
    .map((item) => item.trim())
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

function splitSentences(paragraph, language) {
  const splitter = language.startsWith("en") ? ENGLISH_SENTENCE_SPLITTER : CHINESE_SENTENCE_SPLITTER;

  return paragraph
    .split(splitter)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((sentence) => splitLongSentence(sentence, language));
}

function extractKeywords(text, language, limit = 6) {
  const matches = language.startsWith("en")
    ? text.toLowerCase().match(/[a-z]{4,}/g) ?? []
    : text.match(/[\u4e00-\u9fff]{2,}/g) ?? [];

  const blacklist = language.startsWith("en") ? ENGLISH_BLACKLIST : CHINESE_BLACKLIST;
  const frequency = new Map();

  for (const match of matches) {
    if (blacklist.has(match)) {
      continue;
    }

    frequency.set(match, (frequency.get(match) ?? 0) + 1);
  }

  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([word]) => word);
}

function buildPauseCue(pauseStrength, level = "sentence", language = "zh-CN") {
  const secondsMap = {
    soft: { sentence: "0.6", paragraph: "1.2" },
    medium: { sentence: "1.0", paragraph: "2.0" },
    strong: { sentence: "1.4", paragraph: "2.8" }
  };

  const seconds = secondsMap[pauseStrength]?.[level] ?? secondsMap.medium[level];
  return language.startsWith("en") ? `[Pause ${seconds}s]` : `[\u505c\u987f ${seconds} \u79d2]`;
}

function buildFocusIntro(language) {
  return language.startsWith("en") ? "Focus points:" : "\u91cd\u70b9\u63d0\u793a\uff1a";
}

function buildReviewLabel(language) {
  return language.startsWith("en") ? "Review recap:" : "\u56de\u987e\u63d0\u793a\uff1a";
}

function buildKeywordLabel(language) {
  return language.startsWith("en") ? "Keywords:" : "\u5173\u952e\u8bcd\uff1a";
}

function buildRecallPrompt(language) {
  return language.startsWith("en") ? "Recall from memory:" : "\u8bf7\u5148\u5728\u8111\u4e2d\u8865\u5168\uff1a";
}

function buildAnswerPrompt(language) {
  return language.startsWith("en") ? "Answer:" : "\u6b63\u786e\u7b54\u6848\uff1a";
}

function buildShadowingPrompt(language) {
  return language.startsWith("en") ? "Shadowing cue:" : "\u8ddf\u8bfb\u63d0\u793a\uff1a";
}

function buildMeaningCue(language) {
  return language.startsWith("en")
    ? "Meaning cue: explain the line in your own words."
    : "\u7406\u89e3\u63d0\u793a\uff1a\u5148\u56de\u5fc6\u8fd9\u53e5\u8bdd\u7684\u610f\u601d\uff0c\u518d\u7ee7\u7eed\u3002";
}

function buildKeywordMeaningCue(language) {
  return language.startsWith("en")
    ? "Meaning cue: recall the meaning before checking."
    : "\u7406\u89e3\u63d0\u793a\uff1a\u5148\u60f3\u610f\u601d\uff0c\u518d\u6838\u5bf9\u7b54\u6848\u3002";
}

function buildSpeechCue(language) {
  return language.startsWith("en")
    ? "match the pace, stress, and pause."
    : "\u6a21\u4eff\u8bed\u6c14\u3001\u91cd\u97f3\u548c\u505c\u987f\u3002";
}

function scoreSentence(sentence, keywords) {
  const keywordHits = keywords.reduce((sum, keyword) => sum + (sentence.includes(keyword) ? 2 : 0), 0);
  return keywordHits + Math.min(sentence.length / 14, 3);
}

function selectFocusSentences(sentences, keywords, limit = 2) {
  return [...sentences]
    .sort((a, b) => scoreSentence(b, keywords) - scoreSentence(a, keywords))
    .slice(0, Math.min(limit, sentences.length));
}

function createClozeSentence(sentence, keywords) {
  for (const keyword of keywords) {
    if (keyword.length < 2) {
      continue;
    }

    if (sentence.includes(keyword)) {
      return sentence.replace(keyword, "____");
    }
  }

  return sentence;
}

function summarizeParagraph(sentences, focusSentences) {
  if (!focusSentences.length) {
    return sentences[0] ?? "";
  }

  return focusSentences.join(" / ");
}

function joinSegmentLines(lines) {
  return lines.filter(Boolean).join("\n");
}

function createSegmentCopy(sentence, context) {
  const { settings, keywords, language, isFocusSentence } = context;
  const sentencePause = buildPauseCue(settings.pauseStrength, "sentence", language);
  const bilingualMode = settings.bilingualMode ?? "off";

  if (bilingualMode === "line-translation") {
    return joinSegmentLines([sentence, sentencePause, buildMeaningCue(language), sentencePause]);
  }

  if (bilingualMode === "english-only") {
    return joinSegmentLines([sentence, sentencePause]);
  }

  if (bilingualMode === "word-translation") {
    const focusWords = keywords.slice(0, 3).join(" / ");
    return joinSegmentLines([
      sentence,
      sentencePause,
      focusWords ? `${buildKeywordLabel(language)} ${focusWords}` : "",
      buildKeywordMeaningCue(language),
      sentencePause
    ]);
  }

  if (settings.mode === "cloze") {
    const clozeSentence = createClozeSentence(sentence, keywords);
    return joinSegmentLines([
      sentence,
      sentencePause,
      `${buildRecallPrompt(language)} ${clozeSentence}`,
      sentencePause,
      `${buildAnswerPrompt(language)} ${sentence}`
    ]);
  }

  if (settings.mode === "speech") {
    return joinSegmentLines([
      sentence,
      sentencePause,
      `${buildShadowingPrompt(language)} ${buildSpeechCue(language)}`,
      sentencePause
    ]);
  }

  const lines = [sentence];

  if (settings.repeatKeywords && keywords.length > 0) {
    const repeatedKeywords = Array.from(
      { length: Math.max(1, settings.keywordRepeatCount ?? 1) },
      () => keywords.slice(0, 3).join(" / ")
    )
      .filter(Boolean)
      .join(" / ");

    if (repeatedKeywords) {
      lines.push(`${buildKeywordLabel(language)} ${repeatedKeywords}`);
    }
  }

  if (settings.repeatCount > 1) {
    lines.push(...Array.from({ length: settings.repeatCount - 1 }, () => sentence));
  }

  if (isFocusSentence && settings.repeatFocusSentences) {
    lines.push(
      ...Array.from({ length: Math.max(1, (settings.focusSentenceRepeatCount ?? 2) - 1) }, () => sentence)
    );
  }

  lines.push(sentencePause);
  return joinSegmentLines(lines);
}

export function optimizeForMemory(inputText, settings = {}) {
  const text = normalizeText(inputText);
  if (!text) {
    return {
      language: settings.language?.startsWith("en") ? "en-US" : "zh-CN",
      keywords: [],
      optimizedText: "",
      paragraphs: [],
      stats: {
        characterCount: 0,
        wordCount: 0,
        paragraphCount: 0,
        sentenceCount: 0
      }
    };
  }

  const language = detectLanguage(text, settings.language);
  const paragraphs = splitParagraphs(text);
  const paragraphPause = buildPauseCue(settings.pauseStrength ?? "medium", "paragraph", language);

  const optimizedParagraphs = paragraphs.map((paragraph, paragraphIndex) => {
    const sentences = splitSentences(paragraph, language);
    const keywordLimit = settings.emphasis === "strong" ? 6 : 4;
    const keywords = extractKeywords(paragraph, language, keywordLimit);
    const focusLimit = settings.mode === "normal" ? 1 : 2;
    const focusSentences = selectFocusSentences(sentences, keywords, focusLimit);
    const focus = summarizeParagraph(sentences, focusSentences);

    const items = sentences.map((sentence, sentenceIndex) => ({
      id: `p${paragraphIndex + 1}-s${sentenceIndex + 1}`,
      paragraphIndex,
      sentenceIndex,
      text: sentence,
      keywords,
      isFocusSentence: focusSentences.includes(sentence),
      speechText: createSegmentCopy(sentence, {
        settings,
        keywords,
        language,
        isFocusSentence: focusSentences.includes(sentence)
      })
    }));

    const reviewLine =
      settings.mode === "review" || settings.mode === "recitation"
        ? `${buildReviewLabel(language)} ${focus}`
        : "";

    return {
      id: `paragraph-${paragraphIndex + 1}`,
      title: language.startsWith("en") ? `Block ${paragraphIndex + 1}` : `\u7b2c ${paragraphIndex + 1} \u6bb5`,
      sourceText: paragraph,
      focus,
      focusSentences,
      keywords,
      reviewLine,
      speechText: joinSegmentLines([
        ...items.map((item) => item.speechText),
        reviewLine,
        paragraphPause
      ]),
      items
    };
  });

  const optimizedText = optimizedParagraphs
    .map((paragraph) => {
      const focusLine = paragraph.focus ? `${buildFocusIntro(language)} ${paragraph.focus}` : "";
      return joinSegmentLines([paragraph.title, focusLine, paragraph.speechText]);
    })
    .join("\n\n");

  const keywords = extractKeywords(text, language, 8);
  const stats = {
    characterCount: text.length,
    wordCount: language.startsWith("en")
      ? text.split(/\s+/).filter(Boolean).length
      : (text.match(/[\u4e00-\u9fff]/g) ?? []).length,
    paragraphCount: optimizedParagraphs.length,
    sentenceCount: optimizedParagraphs.reduce((sum, paragraph) => sum + paragraph.items.length, 0)
  };

  return {
    language,
    keywords,
    optimizedText,
    paragraphs: optimizedParagraphs,
    stats
  };
}
