const Diff = require("diff");

function diffText(oldText, newText, mode = "words") {
  const fn = mode === "lines" ? Diff.diffLines : Diff.diffWordsWithSpace;
  const parts = fn(oldText || "", newText || "");
  return parts.map((p) => ({
    value: p.value,
    added: !!p.added,
    removed: !!p.removed,
  }));
}

function summarize(parts) {
  let added = 0;
  let removed = 0;
  for (const p of parts) {
    if (p.added) added += p.value.length;
    else if (p.removed) removed += p.value.length;
  }
  return { added, removed };
}

module.exports = { diffText, summarize };