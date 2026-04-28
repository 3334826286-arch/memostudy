function normalizeExtractedText(text) {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

const PDF_PARSE_WORKER_URL =
  "https://cdn.jsdelivr.net/npm/pdf-parse@2.4.5/dist/pdf-parse/web/pdf.worker.mjs";

export async function parseUploadedFile(file, copy) {
  if (!file) {
    throw new Error(copy.api.uploadMissingFile);
  }

  if (file.size === 0) {
    throw new Error(copy.api.uploadEmptyFile);
  }

  if (file.size > 15 * 1024 * 1024) {
    throw new Error(copy.api.uploadTooLarge);
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  const mimeType = file.type;

  if (!["txt", "docx", "pdf"].includes(extension ?? "")) {
    throw new Error(copy.api.uploadUnsupported);
  }

  let extractedText = "";

  if (extension === "txt" || mimeType === "text/plain") {
    extractedText = await file.text();
  } else if (extension === "docx") {
    const mammothModule = await import("mammoth/mammoth.browser");
    const mammoth = mammothModule.default ?? mammothModule;
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    extractedText = result.value;
  } else if (extension === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    PDFParse.setWorker(PDF_PARSE_WORKER_URL);
    const parser = new PDFParse({ data: await file.arrayBuffer() });
    const result = await parser.getText();
    if (typeof parser.destroy === "function") {
      await parser.destroy();
    }
    extractedText = result.text;
  }

  const normalizedText = normalizeExtractedText(extractedText);
  if (!normalizedText) {
    throw new Error(copy.api.uploadNoText);
  }

  return {
    fileName: file.name,
    fileType: extension ?? mimeType,
    text: normalizedText
  };
}
