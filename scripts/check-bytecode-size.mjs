import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const EVM_LIMIT_BYTES = 24_576;
const CREATION_CODE_CHUNK_BYTES = 24_000;

const contracts = [
  {
    name: "DealLockMultiAssetV2",
    artifact: "artifacts/contracts/DealLockMultiAssetV2.sol/DealLockMultiAssetV2.json",
  },
  {
    name: "DealLockBytecodeChunk template",
    artifact: "artifacts/contracts/DealLockMultiAssetV2Deployer.sol/DealLockBytecodeChunk.json",
  },
  {
    name: "DealLockMultiAssetV2Deployer",
    artifact: "artifacts/contracts/DealLockMultiAssetV2Deployer.sol/DealLockMultiAssetV2Deployer.json",
  },
  {
    name: "DealLockFactoryV3",
    artifact: "artifacts/contracts/DealLockFactoryV3.sol/DealLockFactoryV3.json",
  },
];

let failed = false;

for (const contract of contracts) {
  const artifactPath = resolve(contract.artifact);
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const deployedBytecode = artifact.deployedBytecode ?? "";
  const byteCount = deployedBytecode.startsWith("0x")
    ? (deployedBytecode.length - 2) / 2
    : deployedBytecode.length / 2;
  const remaining = EVM_LIMIT_BYTES - byteCount;
  const status = remaining >= 0 ? "OK" : "TOO LARGE";
  console.log(`${contract.name}: ${byteCount} bytes (${remaining} bytes under limit) ${status}`);
  if (remaining < 0) failed = true;
}

const v6Artifact = JSON.parse(readFileSync(resolve("artifacts/contracts/DealLockMultiAssetV2.sol/DealLockMultiAssetV2.json"), "utf8"));
const v6CreationByteCount = (v6Artifact.bytecode.length - 2) / 2;
const creationChunks = [
  Math.min(v6CreationByteCount, CREATION_CODE_CHUNK_BYTES),
  Math.max(v6CreationByteCount - CREATION_CODE_CHUNK_BYTES, 0),
].filter((size) => size > 0);
for (const [index, size] of creationChunks.entries()) {
  const remaining = EVM_LIMIT_BYTES - size;
  const status = remaining >= 0 ? "OK" : "TOO LARGE";
  console.log(`DealLockMultiAssetV2 creation chunk ${index + 1}: ${size} bytes (${remaining} bytes under limit) ${status}`);
  if (remaining < 0) failed = true;
}

if (failed) {
  console.error(`One or more deployed bytecodes exceed the ${EVM_LIMIT_BYTES}-byte EVM contract size limit.`);
  process.exit(1);
}
