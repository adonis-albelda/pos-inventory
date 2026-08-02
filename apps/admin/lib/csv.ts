/**
 * One CSV writer and one CSV reader for the whole dashboard, so an export the
 * owner downloads and an import they hand back read the same way.
 *
 * No dependency: the format is small enough to get right here, and a parser
 * that silently disagrees with the writer is worse than no parser.
 */

export type CsvValue = string | number | boolean | null | undefined;

const NEEDS_QUOTES = /["\n\r,]/;

/**
 * Excel and Sheets execute a cell that opens with one of these. A plain
 * number is exempt so "-4" stays a number the owner can add up, rather than
 * arriving as the text '-4.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";

  const text = typeof value === "boolean" ? (value ? "true" : "false") : String(value);
  const safe = FORMULA_LEAD.test(text) && !PLAIN_NUMBER.test(text) ? `'${text}` : text;

  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

/**
 * Fields may be quoted, quotes inside a quoted field are doubled, and a quoted
 * field may run over several lines. Rows are returned exactly as found —
 * trimming and blank-row handling belong to the caller.
 */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];

  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let index = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (index < text.length) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }

    if (char === '"' && field === "") {
      inQuotes = true;
      index += 1;
      continue;
    }
    if (char === ",") {
      endField();
      index += 1;
      continue;
    }
    if (char === "\r" || char === "\n") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      endRow();
      index += 1;
      continue;
    }

    field += char;
    index += 1;
  }

  if (field !== "" || row.length > 0) endRow();
  return rows;
}

export interface CsvRow {
  /** Position in the file, counting the header as 1, so an error can name it. */
  line: number;
  cells: Record<string, string>;
}

export interface CsvTable {
  /** Lower-cased and trimmed, so `Cost Price` and `cost_price` both land. */
  headers: string[];
  rows: CsvRow[];
}

export function parseCsvTable(input: string): CsvTable {
  const [headerRow, ...body] = parseCsv(input);
  if (!headerRow) return { headers: [], rows: [] };

  const headers = headerRow.map((header) =>
    header.trim().toLowerCase().replace(/\s+/g, "_"),
  );
  const rows: CsvRow[] = [];

  body.forEach((cells, index) => {
    if (cells.every((cell) => cell.trim() === "")) return;

    const record: Record<string, string> = {};
    headers.forEach((header, column) => {
      record[header] = (cells[column] ?? "").trim();
    });

    rows.push({ line: index + 2, cells: record });
  });

  return { headers, rows };
}
