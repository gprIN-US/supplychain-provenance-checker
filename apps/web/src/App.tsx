import React, { useMemo, useState } from "react";
import { ethers } from "ethers";

// Minimal ABI to read batch and existence
const ABI = [
  "function getBatch(uint256 batchId) view returns (tuple(bytes32 fileHash,uint256 startRow,uint256 endRow,bytes32 merkleRoot,uint256 anchoredAt))",
  "function batchExists(uint256 batchId) view returns (bool)"
];

type ProofStep = { sibling: string; isLeftSibling: boolean };

function hexToBytes(hex: string): Uint8Array {
  return ethers.getBytes(hex);
}

async function sha256(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return ethers.hexlify(new Uint8Array(digest));
}

async function verifyProof(opts: { leaf: string; proof: ProofStep[]; root: string }): Promise<boolean> {
  let acc = hexToBytes(opts.leaf);

  for (const step of opts.proof) {
    const sib = hexToBytes(step.sibling);
    const merged = step.isLeftSibling
      ? new Uint8Array([...sib, ...acc])
      : new Uint8Array([...acc, ...sib]);
    acc = hexToBytes(await sha256(merged));
  }

  const got = ethers.hexlify(acc).toLowerCase();
  return got === opts.root.toLowerCase();
}

export default function App(): JSX.Element {
  const [status, setStatus] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [batchId, setBatchId] = useState<string>("0");
  const [leaf, setLeaf] = useState<string>("");
  const [proofJson, setProofJson] = useState<string>("");

  const canRun = useMemo(() => contractAddress.length > 0 && batchId.length > 0, [contractAddress, batchId]);

  async function connectAndRead(): Promise<void> {
    setStatus("");
    if (!(window as any).ethereum) {
      setStatus("No wallet found. Install MetaMask or use a compatible browser wallet.");
      return;
    }

    const provider = new ethers.BrowserProvider((window as any).ethereum);
    await provider.send("eth_requestAccounts", []);
    const contract = new ethers.Contract(contractAddress, ABI, provider);

    const id = BigInt(batchId);
    const exists = await contract.batchExists(id);
    if (!exists) {
      setStatus("Batch not found on-chain.");
      return;
    }

    const batch = await contract.getBatch(id);
    setStatus(
      `On-chain batch: rows ${batch.startRow.toString()}..${batch.endRow.toString()}, root ${batch.merkleRoot}`
    );
  }

  async function verifyLocally(): Promise<void> {
    setStatus("");
    let proof: any;
    try {
      proof = JSON.parse(proofJson);
    } catch {
      setStatus("Proof JSON is not valid JSON.");
      return;
    }
    if (!proof?.proof) {
      setStatus("Proof JSON must include a 'proof' array of steps.");
      return;
    }
    if (!leaf || !leaf.startsWith("0x")) {
      setStatus("Leaf must be a 0x-prefixed hex hash.");
      return;
    }

    if (!(window as any).ethereum) {
      setStatus("No wallet found. Install MetaMask or use a compatible browser wallet.");
      return;
    }

    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const contract = new ethers.Contract(contractAddress, ABI, provider);

    const id = BigInt(batchId);
    const exists = await contract.batchExists(id);
    if (!exists) {
      setStatus("Batch not found on-chain.");
      return;
    }
    const batch = await contract.getBatch(id);
    const root = batch.merkleRoot as string;

    const ok = await verifyProof({ leaf, proof: proof.proof as ProofStep[], root });
    setStatus(ok ? "Verified: leaf is valid under the on-chain root." : "Not valid under the on-chain root.");
  }

  return (
    <div className="container">
      <h1>SupplyChain Provenance Checker</h1>
      <p className="small">
        This DApp verifies a row hash against an on-chain Merkle root. It does not upload the dataset.
      </p>

      <div className="card">
        <div className="row">
          <div>
            <label>Contract address</label>
            <input value={contractAddress} onChange={(e) => setContractAddress(e.target.value.trim())} placeholder="0x..." />
            <div className="small">From <span className="badge">artifacts/contract-address.json</span></div>
          </div>
          <div>
            <label>Batch ID</label>
            <input value={batchId} onChange={(e) => setBatchId(e.target.value)} />
            <div className="small">Matches batch id in <span className="badge">artifacts/batches/batches.json</span></div>
          </div>
        </div>

        <hr />

        <button onClick={connectAndRead} disabled={!canRun}>Read batch from chain</button>

        <hr />

        <div className="row">
          <div>
            <label>Leaf hash (row hash)</label>
            <input value={leaf} onChange={(e) => setLeaf(e.target.value.trim())} placeholder="0x... (32 bytes)" />
            <div className="small">Use CLI output or proof file entry.</div>
          </div>
          <div>
            <label>Proof JSON</label>
            <textarea
              rows={6}
              value={proofJson}
              onChange={(e) => setProofJson(e.target.value)}
              placeholder='{"proof":[{"sibling":"0x...","isLeftSibling":true}]}'
            />
            <div className="small">Paste the proof steps for the same leaf.</div>
          </div>
        </div>

        <hr />

        <button onClick={verifyLocally} disabled={!canRun}>Verify leaf against on-chain root</button>

        <p style={{ marginTop: 14 }}>{status}</p>
      </div>

      <p className="small" style={{ marginTop: 16 }}>
        Tip: proofs are generated under <span className="badge">artifacts/proofs</span>. Find the batch file and copy the
        proof step array for the row you want.
      </p>
    </div>
  );
}
