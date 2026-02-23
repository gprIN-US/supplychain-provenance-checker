import fs from "fs";
import path from "path";
import { ethers } from "hardhat";

type BatchesDoc = {
  fileHash: string;
  batchSize: number;
  batches: Array<{ batchId: number; startRow: number; endRow: number; root: string }>;
};

function loadJSON(p: string): any {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

async function main(): Promise<void> {
  const rootDir = path.join(__dirname, "../../..");
  const addrPath = path.join(rootDir, "artifacts", "contract-address.json");
  const batchesPath = path.join(rootDir, "artifacts", "batches", "batches.json");

  if (!fs.existsSync(addrPath)) throw new Error("Missing artifacts/contract-address.json. Deploy first.");
  if (!fs.existsSync(batchesPath)) throw new Error("Missing artifacts/batches/batches.json. Run pipeline build first.");

  const { address } = loadJSON(addrPath) as { address: string };
  const batchesDoc = loadJSON(batchesPath) as BatchesDoc;

  const contract = await ethers.getContractAt("SupplyChainProvenance", address);
  const [signer] = await ethers.getSigners();
  console.log("Anchoring as:", await signer.getAddress());

  // Anchor first N batches by default (safe for gas). Override with --limit.
  const limitArg = process.argv.find((x) => x.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 5;

  const toAnchor = batchesDoc.batches.slice(0, limit);
  console.log(`Anchoring ${toAnchor.length} batch roots...`);

  for (const b of toAnchor) {
    const tx = await contract.anchorBatch(
      b.batchId,
      batchesDoc.fileHash,
      b.startRow,
      b.endRow,
      b.root
    );
    const receipt = await tx.wait();
    console.log(`Batch ${b.batchId} anchored in tx ${receipt?.hash}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
