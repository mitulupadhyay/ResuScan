const mammoth = require("mammoth");
const ApiError = require("../utils/ApiError");

const ENT = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

/** Word -> plain text. Hyperlinks become [label](url) so URLs survive, like PDF extraction. */
async function extractDocxText(buffer) {
  let html;
  try {
    ({ value: html } = await mammoth.convertToHtml({ buffer }));
  } catch (err) {
    throw ApiError.badRequest("Failed to read the Word document. It may be corrupted or not a real .docx file.");
  }
  const text = html
    .replace(/<a [^>]*href="(https?:\/\/[^"]+)"[^>]*>(.*?)<\/a>/gis, (_, url, label) => `[${label.replace(/<[^>]+>/g, "").trim()}](${url})`)
    .replace(/<\/(p|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENT[m])
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length < 50) {
    throw ApiError.badRequest("The Word document contains no readable text (it may be empty or only images).");
  }
  return { text, meta: { numPages: null } };
}

module.exports = { extractDocxText };
