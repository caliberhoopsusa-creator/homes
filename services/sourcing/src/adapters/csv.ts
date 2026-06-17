// CSV → CountyRecord[] adapter. County treasurer / clerk lists (tax-delinquent,
// probate, code-violation) are most often published as CSV. This turns one into
// the normalized shape the CountyRecordsProvider consumes — so wiring a new county
// is a config step (a column map), not new code. Pure + dependency-free.
import type { CountyRecord } from "../providers/county.js";

/** Maps CountyRecord fields → the source CSV's column headers. `address` is required. */
export interface CsvColumnMap {
  address: string;
  record_id?: string;
  city?: string;
  state?: string;
  zip?: string;
  beds?: string;
  baths?: string;
  sqft?: string;
  year_built?: string;
  est_value?: string;
}

/** Parse a CSV string into a 2D array of cells (RFC4180-ish: quotes, escaped "", CRLF). */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Parse a CSV string into objects keyed by (trimmed) header. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return [];
  const headers = rows[0]!.map((h) => h.trim());
  return rows
    .slice(1)
    .filter((cells) => cells.some((c) => c.trim() !== ""))
    .map((cells) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = (cells[i] ?? "").trim();
      });
      return obj;
    });
}

function num(v: string | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number(v.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Map a county CSV → CountyRecord[] using a column map. Rows without an address are dropped. */
export function csvToCountyRecords(csv: string, map: CsvColumnMap): CountyRecord[] {
  const pick = (r: Record<string, string>, col?: string) =>
    col ? r[col] : undefined;
  const str = (v: string | undefined) => {
    const t = (v ?? "").trim();
    return t === "" ? null : t;
  };

  return parseCsv(csv)
    .map((r): CountyRecord | null => {
      const address = (r[map.address] ?? "").trim();
      if (!address) return null;
      return {
        record_id: pick(r, map.record_id) || undefined,
        address,
        city: str(pick(r, map.city)),
        state: str(pick(r, map.state)),
        zip: str(pick(r, map.zip)),
        beds: num(pick(r, map.beds)),
        baths: num(pick(r, map.baths)),
        sqft: num(pick(r, map.sqft)),
        year_built: num(pick(r, map.year_built)),
        est_value: num(pick(r, map.est_value)),
      };
    })
    .filter((r): r is CountyRecord => r !== null);
}
