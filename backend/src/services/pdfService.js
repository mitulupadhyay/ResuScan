const { PDFParse } = require("pdf-parse");
const ApiError = require("../utils/ApiError");

async function extractText(buffer) {
  let parser;
  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText({ parseHyperlinks: true });

    const text = (result.text || "")
      .replace(/^\s*-- \d+ of \d+ --\s*$/gm, "") // page markers added by pdf-parse
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!text || text.length < 50) {
      throw ApiError.badRequest(
        "Could not extract readable text. This looks like a scanned/image-only PDF, and OCR is not supported yet. Please upload a text-based PDF (export from Word/Docs) or start from scratch."
      );
    }

    return {
      text,
      meta: {
        numPages: result.pages?.length ?? result.numpages ?? null,
      },
    };
  } catch (err) {
    if (err.isOperational) throw err;
    throw ApiError.badRequest("Failed to parse PDF: " + err.message);
  } finally {
    try {
      await parser?.destroy?.();
    } catch {
      /* noop */
    }
  }
}

<<<<<<< HEAD
module.exports = { extractText };
=======
/** Plain text + page count, no hyperlink markup and no minimum length (used to verify our own exports). */
async function extractPlain(buffer) {
  let parser;
  try {
    parser = new PDFParse({ data: buffer });
    const r = await parser.getText();
    return { text: (r.text || "").replace(/^\s*-- \d+ of \d+ --\s*$/gm, ""), numPages: r.pages?.length ?? r.numpages ?? null };
  } catch (err) {
    throw ApiError.badRequest("Failed to read PDF: " + err.message);
  } finally {
    try { await parser?.destroy?.(); } catch { /* noop */ }
  }
}

module.exports = { extractText, extractPlain };
>>>>>>> 12ed780 (feat: custom section order, security headers, frontend unit tests)
