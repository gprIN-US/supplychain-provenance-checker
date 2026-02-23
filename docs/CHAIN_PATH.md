# Build Path (matches your roadmap screenshot)

## 1) Programming Language: TypeScript
- Data pipeline code in `packages/data-pipeline/`
- DApp code in `apps/web/`
Why TypeScript:
- predictable types for hashes/proofs
- clean CLI + browser reuse

## 2) Version Control System: Git
- `.gitignore` keeps `data/` and `artifacts/` out of git
- recommended branch flow:
  - `main` for stable
  - `dev` for experiments
  - feature branches for contract/DApp changes

## 3) Data Structures & Algorithms: Merkle Tree
- `packages/data-pipeline/src/merkle.ts`
- Leaves: SHA-256(canonical row string)
- Internal nodes: SHA-256(left || right)
- Odd node count rule: duplicate last node (deterministic)

## 4) Smart Contracts: Solidity
- `packages/contracts/contracts/SupplyChainProvenance.sol`
Stores only:
- cleaned file hash
- row range
- Merkle root
Never stores the dataset.

## 5) DApp: React + Vite
- `apps/web/`
Reads the batch root on-chain and verifies a Merkle proof in the browser.

## 6) Web3 Libraries: ethers
- Used by contract deploy scripts and the DApp.
