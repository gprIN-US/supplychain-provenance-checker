import { createHash } from "crypto";

export type Hex = `0x${string}`;

function sha256(data: Buffer | string): Buffer {
  return createHash("sha256").update(data).digest();
}

export function sha256Hex(data: Buffer | string): Hex {
  return (`0x${sha256(data).toString("hex")}`) as Hex;
}

/**
 * A minimal Merkle tree for deterministic verification.
 * - Leaves are expected to be 32-byte hashes (0x...).
 * - Internal nodes are SHA256(left || right).
 * - If odd number of nodes at a level, the last node is duplicated.
 */
export class MerkleTree {
  private levels: Buffer[][];

  constructor(leafHexes: Hex[]) {
    if (leafHexes.length === 0) {
      throw new Error("MerkleTree: empty leaf set");
    }
    const leaves = leafHexes.map((h) => Buffer.from(h.slice(2), "hex"));
    for (const b of leaves) {
      if (b.length !== 32) {
        throw new Error("MerkleTree: each leaf must be 32 bytes");
      }
    }
    this.levels = [leaves];
    this.build();
  }

  private build(): void {
    while (this.levels[this.levels.length - 1].length > 1) {
      const prev = this.levels[this.levels.length - 1];
      const next: Buffer[] = [];
      for (let i = 0; i < prev.length; i += 2) {
        const left = prev[i];
        const right = prev[i + 1] ?? prev[i]; // duplicate if odd
        next.push(sha256(Buffer.concat([left, right])));
      }
      this.levels.push(next);
    }
  }

  rootHex(): Hex {
    const top = this.levels[this.levels.length - 1][0];
    return (`0x${top.toString("hex")}`) as Hex;
  }

  /**
   * Returns a Merkle proof for leaf at index.
   * Proof is an array of sibling hashes with direction.
   */
  proof(index: number): Array<{ sibling: Hex; isLeftSibling: boolean }> {
    if (index < 0 || index >= this.levels[0].length) {
      throw new Error("MerkleTree: index out of range");
    }

    const proof: Array<{ sibling: Hex; isLeftSibling: boolean }> = [];
    let idx = index;

    for (let level = 0; level < this.levels.length - 1; level++) {
      const nodes = this.levels[level];
      const isRightNode = idx % 2 === 1;
      const siblingIndex = isRightNode ? idx - 1 : idx + 1;
      const siblingNode = nodes[siblingIndex] ?? nodes[idx]; // duplicate rule

      proof.push({
        sibling: (`0x${siblingNode.toString("hex")}`) as Hex,
        isLeftSibling: isRightNode // if current is right, sibling is left
      });

      idx = Math.floor(idx / 2);
    }

    return proof;
  }

  static verifyProof(params: {
    leaf: Hex;
    proof: Array<{ sibling: Hex; isLeftSibling: boolean }>;
    root: Hex;
  }): boolean {
    let acc: Buffer = Buffer.from(params.leaf.slice(2), "hex");
    for (const step of params.proof) {
      const sib = Buffer.from(step.sibling.slice(2), "hex");
      acc = step.isLeftSibling
        ? sha256(Buffer.concat([sib, acc]))
        : sha256(Buffer.concat([acc, sib]));
    }
    const got = (`0x${acc.toString("hex")}`) as Hex;
    return got.toLowerCase() === params.root.toLowerCase();
  }
}
