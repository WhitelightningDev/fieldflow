export type ParsedCsv = {
  delimiter: "," | ";";
  rows: string[][];
};

function detectDelimiter(text: string): "," | ";" {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  let inQuotes = false;
  let commas = 0;
  let semicolons = 0;
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') {
      const next = firstLine[i + 1];
      if (inQuotes && next === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (ch === ",") commas++;
    if (ch === ";") semicolons++;
  }
  return semicolons > commas ? ";" : ",";
}

export function parseCsv(text: string): ParsedCsv {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    // Ignore a leading completely empty line
    if (row.length === 1 && row[0].trim() === "" && rows.length === 0) {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      const next = text[i + 1];
      if (inQuotes && next === '"') {
        field += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      pushField();
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      pushField();
      pushRow();
      continue;
    }

    field += ch;
  }

  pushField();
  if (row.some((c) => c.trim() !== "")) pushRow();

  return { delimiter, rows };
}

export function normalizeCsvHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[#/]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
