import path from "path";
import fs from "fs";
import { sanitizeCsv } from "./sanitize";
import { buildBatches, verifyRow } from "./build";

type Args = Record<string, string | boolean>;

function parseArgs(argv: string[]): { cmd: string; args: Args } {
  const [cmd = "help", ...rest] = argv;
  const args: Args = {};
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const val = rest[i + 1];
    if (!val || val.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = val;
      i++;
    }
  }
  return { cmd, args };
}

function req(args: Args, key: string): string {
  const v = args[key];
  if (!v || typeof v !== "string") throw new Error(`Missing --${key}`);
  return v;
}

async function main(): Promise<void> {
  const { cmd, args } = parseArgs(process.argv.slice(2));

  if (cmd === "build") {
    const csvPath = (args["csv"] as string) || "data/DataCoSupplyChainDataset.csv";
    const outClean = "artifacts/clean/cleaned.csv";
    const outMeta = "artifacts/clean/meta.json";
    const batchesOut = "artifacts/batches/batches.json";
    const proofsDir = "artifacts/proofs";
    const batchSize = args["batchSize"] ? Number(args["batchSize"]) : 1024;

    console.log("Sanitizing CSV...");
    const s = await sanitizeCsv({ csvPath, outCsvPath: outClean, outMetaPath: outMeta });

    console.log(`Clean CSV: ${outClean}`);
    console.log(`Rows: ${s.rowCount}`);
    console.log(`File hash (cleaned): ${s.fileHash}`);

    console.log("Building Merkle batches...");
    const b = buildBatches({ cleanCsvPath: outClean, batchesOutPath: batchesOut, proofsOutDir: proofsDir, batchSize });

    console.log(`Batches written: ${batchesOut}`);
    console.log(`Proofs folder: ${proofsDir}`);
    console.log(`Total batches: ${b.batches.length}`);
    return;
  }

  if (cmd === "verify") {
    const batch = Number(req(args, "batch"));
    const row = Number(req(args, "row"));
    const proofFile = path.join("artifacts/proofs", `batch_${batch}.json`);
    if (!fs.existsSync(proofFile)) {
      throw new Error(`Proof file not found: ${proofFile}. Run build first.`);
    }
    const res = verifyRow({ proofFile, rowOffsetInBatch: row });
    console.log(JSON.stringify({ ok: res.ok, root: res.root, leaf: res.leaf }, null, 2));
    return;
  }

  console.log(`Usage:
  node dist/cli.js build --csv data/DataCoSupplyChainDataset.csv --batchSize 1024
  node dist/cli.js verify --batch 0 --row 10
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
