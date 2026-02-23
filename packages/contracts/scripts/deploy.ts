import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main(): Promise<void> {
  const Factory = await ethers.getContractFactory("SupplyChainProvenance");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("SupplyChainProvenance deployed to:", address);

  const out = {
    address,
    network: (await ethers.provider.getNetwork()).name
  };

  const outPath = path.join(__dirname, "../../..", "artifacts", "contract-address.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
  console.log("Wrote:", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
