# SupplyChain Provenance Ledger: https://supplychain-provenance-checker-web.vercel.app

A practical, end-to-end blockchain project that anchors supply-chain order batches on-chain and lets you verify individual rows from the dataset against the blockchain record.

This repo is organized to follow a learning/build path:

1. Programming Language (TypeScript)
2. Version Control System (Git)
3. Data Structures & Algorithms (Merkle Tree)
4. Smart Contracts (Solidity + Hardhat)
5. DApp (React + Vite)
6. Web3 Libraries (ethers)

## What this project does

- Reads `DataCoSupplyChainDataset.csv`
- Removes high-risk personal fields (email, password, street, etc.)
- Canonicalizes each row into a stable string and hashes it (SHA-256)
- Builds Merkle trees over fixed-size batches (default: 1024 rows per batch)
- Stores only the Merkle root + metadata on-chain
- Generates Merkle proofs for rows so you can verify a row locally or in the browser DApp

You get integrity (tamper detection) without putting the raw dataset on-chain.

## Repo structure

- `data/` (kept out of git)  
  Place the dataset file here as: `data/DataCoSupplyChainDataset.csv`

- `packages/data-pipeline/`  
  CSV sanitization, row hashing, Merkle tree building, proof generation, local verification

- `packages/contracts/`  
  Solidity contract + Hardhat scripts to deploy and anchor batch roots

- `apps/web/`  
  Browser DApp to check: (a) whether a batch root is on-chain, and (b) whether a given row hash is valid under that root

## Quick start

### 0) Requirements
- Node.js 18+ (recommended 20+)
- Git
- A local Ethereum dev node (Hardhat) or Sepolia/Amoy testnet RPC + funded test wallet

### 1) Install
From repo root:

```bash
npm install
```

### 2) Put the dataset in place
Copy your dataset to:

```bash
data/DataCoSupplyChainDataset.csv
```

On macOS, your current location looks like:

`/Users/user-name/blockchain-supply-chain-project/data/DataCoSupplyChainDataset.csv`

You can either copy it into this repo's `data/` folder, or update paths in commands below using `--csv`.

### 3) Sanitize + build batches (Merkle roots + proofs)
```bash
npm run pipeline:build
```

Outputs:
- `artifacts/clean/cleaned.csv`
- `artifacts/batches/batches.json` (batch metadata + roots)
- `artifacts/proofs/` (Merkle proofs per batch)

### 4) Deploy contract (local)
Terminal A:
```bash
npm run chain:node
```

Terminal B:
```bash
npm run chain:deploy:local
```

### 5) Anchor roots on-chain (local)
```bash
npm run chain:anchor:local
```

### 6) Verify a row (CLI)
```bash
npm run pipeline:verify -- --batch 0 --row 10
```

### 7) Run the DApp
```bash
npm run web:dev
```

Open the site, connect your wallet to the same network, and verify a row hash/proof against the on-chain root.

## Notes on privacy

The source dataset includes personal fields (e.g., customer email, password, street address). This repo **never** sends those raw values on-chain and, by default, removes them during sanitization.

If you want to keep additional columns, edit:
`packages/data-pipeline/src/sanitize.ts`

## License
MIT
