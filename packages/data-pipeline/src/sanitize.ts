import fs from "fs";
import path from "path";
import { parse } from "csv-parse";
import { stringify } from "csv-stringify";
import { sha256Hex, type Hex } from "./merkle";

/**
 * Columns removed by default to reduce risk:
 * - direct identifiers (email, password, street)
 * - free-form fields that may contain PII
 *
 * You can adjust this list, but be thoughtful about what you keep.
 */
const DROP_COLUMNS = new Set<string>([
  "Customer Email",
  "Customer Password",
  "Customer Street"
]);

export type SanitizedRow = Record<string, string>;

export function canonicalizeRow(row: SanitizedRow, headers: string[]): string {
  // Stable key order using headers list; trim; normalize whitespace
  const parts: string[] = [];
  for (const h of headers) {
    const raw = row[h] ?? "";
    const v = raw.toString().replace(/\s+/g, " ").trim();
    parts.push(`${h}=${v}`);
  }
  return parts.join("|");
}

export function hashRow(canonical: string): Hex {
  return sha256Hex(canonical);
}

export async function sanitizeCsv(params: {
  csvPath: string;
  outCsvPath: string;
  outMetaPath: string;
}): Promise<{ headers: string[]; rowCount: number; fileHash: Hex }> {
  const input = fs.createReadStream(params.csvPath);
  const parser = parse({ columns: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true });

  const rows: SanitizedRow[] = [];
  let headers: string[] = [];
  let rowCount = 0;

  parser.on("readable", () => {
    let record: Record<string, unknown> | null;
    while ((record = parser.read()) !== null) {
      if (headers.length === 0) {
        headers = Object.keys(record);
        headers = headers.filter((h) => !DROP_COLUMNS.has(h));
      }

      const clean: SanitizedRow = {};
      for (const h of headers) {
        const val = record[h];
        clean[h] = val === null || val === undefined ? "" : String(val);
      }
      rows.push(clean);
      rowCount += 1;
    }
  });

  await new Promise<void>((resolve, reject) => {
    input.pipe(parser);
    parser.on("end", () => resolve());
    parser.on("error", (e) => reject(e));
  });

  // Write cleaned CSV
  await new Promise<void>((resolve, reject) => {
    const outDir = path.dirname(params.outCsvPath);
    fs.mkdirSync(outDir, { recursive: true });

    const out = fs.createWriteStream(params.outCsvPath);
    const s = stringify({ header: true, columns: headers });

    s.on("error", reject);
    out.on("error", reject);
    out.on("finish", () => resolve());

    s.pipe(out);
    for (const r of rows) s.write(r);
    s.end();
  });

  // Hash the cleaned file (integrity of input to Merkle pipeline)
  const cleanedBuf = fs.readFileSync(params.outCsvPath);
  const fileHash = sha256Hex(cleanedBuf);

  fs.mkdirSync(path.dirname(params.outMetaPath), { recursive: true });
  fs.writeFileSync(
    params.outMetaPath,
    JSON.stringify({ headers, rowCount, droppedColumns: Array.from(DROP_COLUMNS), fileHash }, null, 2),
    "utf-8"
  );

  return { headers, rowCount, fileHash };
}
