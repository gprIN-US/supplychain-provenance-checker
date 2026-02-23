// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * SupplyChainProvenance
 *
 * Stores Merkle roots for sanitized dataset batches.
 * Goal: prove that a specific row hash existed within a published batch.
 *
 * What is stored on-chain:
 * - fileHash: hash of the cleaned CSV used to generate leaves (SHA-256, 32 bytes)
 * - batchId + row range + Merkle root
 *
 * What is NOT stored on-chain:
 * - raw CSV rows
 * - any customer personal fields
 */
contract SupplyChainProvenance {
    struct Batch {
        bytes32 fileHash;
        uint256 startRow;
        uint256 endRow;
        bytes32 merkleRoot;
        uint256 anchoredAt;
    }

    address public owner;
    mapping(uint256 => Batch) private batches;
    mapping(uint256 => bool) private exists;

    event BatchAnchored(
        uint256 indexed batchId,
        bytes32 indexed fileHash,
        uint256 startRow,
        uint256 endRow,
        bytes32 merkleRoot,
        uint256 anchoredAt
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function anchorBatch(
        uint256 batchId,
        bytes32 fileHash,
        uint256 startRow,
        uint256 endRow,
        bytes32 merkleRoot
    ) external onlyOwner {
        require(!exists[batchId], "batch already exists");
        require(endRow > startRow, "invalid range");
        require(merkleRoot != bytes32(0), "invalid root");

        batches[batchId] = Batch({
            fileHash: fileHash,
            startRow: startRow,
            endRow: endRow,
            merkleRoot: merkleRoot,
            anchoredAt: block.timestamp
        });
        exists[batchId] = true;

        emit BatchAnchored(batchId, fileHash, startRow, endRow, merkleRoot, block.timestamp);
    }

    function getBatch(uint256 batchId) external view returns (Batch memory) {
        require(exists[batchId], "batch not found");
        return batches[batchId];
    }

    function batchExists(uint256 batchId) external view returns (bool) {
        return exists[batchId];
    }
}
