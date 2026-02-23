import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { MerkleTree, sha256Hex, type Hex } from "./merkle";
import { canonicalizeRow, hashRow, type SanitizedRow } from "./sanitize";

export type BatchMeta = {
  batchId: number;
  startRow: number; // inclusive (0-based)
  endRow: number;   // exclusive
  leafCount: number;
  root: Hex;
};

export function loadCleanCsv(cleanCsvPath: string): { headers: string[]; rows: SanitizedRow[] } {
  const buf = fs.readFileSync(cleanCsvPath);
  const records = parse(buf, { columns: true, skip_empty_lines: true });
  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  const rows = records as SanitizedRow[];
  return { headers, rows };
}

export function buildBatches(params: {
  cleanCsvPath: string;
  batchesOutPath: string;
  proofsOutDir: string;
  batchSize: number;
}): { fileHash: Hex; headers: string[]; batches: BatchMeta[] } {
  const { headers, rows } = loadCleanCsv(params.cleanCsvPath);
  if (rows.length === 0) throw new Error("No rows found in cleaned CSV");

  const fileHash = sha256Hex(fs.readFileSync(params.cleanCsvPath));

  fs.mkdirSync(path.dirname(params.batchesOutPath), { recursive: true });
  fs.mkdirSync(params.proofsOutDir, { recursive: true });

  const batches: BatchMeta[] = [];

  for (let start = 0, batchId = 0; start < rows.length; start += params.batchSize, batchId++) {
    const end = Math.min(rows.length, start + params.batchSize);
    const leafHexes: Hex[] = [];
    const canonicals: string[] = [];

    for (let i = start; i < end; i++) {
      const c = canonicalizeRow(rows[i], headers);
      canonicals.push(c);
      leafHexes.push(hashRow(c));
    }

    const tree = new MerkleTree(leafHexes);
    const root = tree.rootHex();

    const meta: BatchMeta = {
      batchId,
      startRow: start,
      endRow: end,
      leafCount: leafHexes.length,
      root
    };
    batches.push(meta);

    // Save proofs for this batch
    const proofs: Record<string, unknown> = {
      batch: meta,
      fileHash,
      headers,
      leaves: leafHexes,
      // Proofs are indexed by row offset within the batch
      proofs: leafHexes.map((leaf, idx) => ({
        idx,
        leaf,
        proof: tree.proof(idx)
      }))
    };

    fs.writeFileSync(path.join(params.proofsOutDir, `batch_${batchId}.json`), JSON.stringify(proofs, null, 2), "utf-8");
  }

  fs.writeFileSync(params.batchesOutPath, JSON.stringify({ fileHash, headers, batchSize: params.batchSize, batches }, null, 2), "utf-8");
  return { fileHash, headers, batches };
}

export function verifyRow(params: {
  proofFile: string;
  rowOffsetInBatch: number;
}): { ok: boolean; root: Hex; leaf: Hex; computed: boolean } {
  const doc = JSON.parse(fs.readFileSync(params.proofFile, "utf-8"));
  const root: Hex = doc.batch.root;
  const entry = doc.proofs.find((p: any) => p.idx === params.rowOffsetInBatch);
  if (!entry) throw new Error("Row offset not found in proof file");
  const leaf: Hex = entry.leaf;
  const ok = MerkleTree.verifyProof({ leaf, proof: entry.proof, root });
  return { ok, root, leaf, computed: ok };
}
