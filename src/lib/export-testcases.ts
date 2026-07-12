import * as XLSX from "xlsx";

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

/**
 * Download the test case content as an Excel (.xlsx) file.
 * Parses the markdown table and writes it into a worksheet.
 */
export function exportAsExcel(content: string, featureName: string) {
  const { headers, rows } = parseMarkdownTable(content);

  if (!headers.length) {
    throw new Error("No table found in test case content.");
  }

  const worksheetData = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Auto-fit column widths (capped at 60 chars)
  worksheet["!cols"] = headers.map((_, colIdx) => {
    const maxLen = worksheetData.reduce((max, row) => {
      const cell = row[colIdx] ?? "";
      return Math.max(max, cell.length);
    }, 10);
    return { wch: Math.min(maxLen, 60) };
  });

  // Style header row bold by adding a range ref
  worksheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: worksheetData.length - 1, c: headers.length - 1 },
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Test Cases");

  const xlsxBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([xlsxBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, `${featureName}-testcases.xlsx`);
}
