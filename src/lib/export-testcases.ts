/**
 * Parse a GFM markdown table into headers + row arrays.
 * Handles escaped pipes (\|) inside cells.
 */
function parseMarkdownTable(markdown: string): {
  headers: string[];
  rows: string[][];
} {
  const lines = markdown.split("\n");
  const tableLines = lines.filter((l) => l.trim().startsWith("|"));

  if (tableLines.length < 2) return { headers: [], rows: [] };

  const splitRow = (line: string): string[] =>
    line
      .replace(/^\||\|$/g, "") // strip leading/trailing pipes
      .split(/(?<!\\)\|/)      // split on unescaped pipes
      .map((c) => c.replace(/\\\|/g, "|").trim());

  const headers = splitRow(tableLines[0]);
  // tableLines[1] is the separator row — skip it
  const rows = tableLines.slice(2).map(splitRow);

  return { headers, rows };
}

/** Trigger a file download in the browser. */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Download the test case content as a Markdown (.md) file.
 * `featureName` is used to derive the file name.
 */
export function exportAsMarkdown(content: string, featureName: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  triggerDownload(blob, `${featureName}-testcases.md`);
}
