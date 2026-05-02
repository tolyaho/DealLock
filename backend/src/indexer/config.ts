export interface FactoryContractConfig {
  chainId: number;
  address: string;
  factoryVersion: 1 | 2 | 3;
}

export interface IndexerConfig {
  enabled: boolean;
  pollMs: number;
  confirmations: bigint;
  blockBatchSize: bigint;
  lookbackBlocks: bigint;
  maxAgreementsPerTick: number;
  logLevel: "silent" | "error" | "info" | "debug";
  rpcUrls: Map<number, string>;
  factoryContracts: FactoryContractConfig[];
  factoryIndexerEnabled: boolean;
}

function intEnv(name: string, fallback: number, min = 0): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min) return fallback;
  return parsed;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw === "true";
}

function logLevel(): IndexerConfig["logLevel"] {
  const raw = (process.env.INDEXER_LOG_LEVEL ?? "info").toLowerCase();
  if (raw === "silent" || raw === "error" || raw === "debug") return raw;
  return "info";
}

/**
 * Parse FACTORY_CONTRACTS / FACTORY_V2_CONTRACTS / FACTORY_V3_CONTRACTS env vars.
 * Format: "11155111:0xFactoryAddress,31337:0xLocalFactory"
 */
export function parseFactoryContracts(raw: string | undefined, factoryVersion: 1 | 2 | 3 = 1): FactoryContractConfig[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const [chainPart, addrPart] = entry.split(":");
      const chainId = Number(chainPart);
      const address = addrPart?.trim().toLowerCase();
      if (!Number.isInteger(chainId) || chainId <= 0) return [];
      if (!address || !/^0x[0-9a-f]{40}$/.test(address)) return [];
      return [{ chainId, address, factoryVersion }];
    });
}

function mergeFactoryContracts(
  v1: FactoryContractConfig[],
  v2: FactoryContractConfig[],
  v3: FactoryContractConfig[],
): FactoryContractConfig[] {
  const seen = new Set<string>();
  return [...v3, ...v2, ...v1].filter((factory) => {
    const key = `${factory.chainId}:${factory.address}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function indexerConfig(): IndexerConfig {
  const rpcUrls = new Map<number, string>();
  if (process.env.SEPOLIA_RPC_URL) rpcUrls.set(11155111, process.env.SEPOLIA_RPC_URL);
  if (process.env.HARDHAT_RPC_URL) rpcUrls.set(31337, process.env.HARDHAT_RPC_URL);

  return {
    enabled: boolEnv("INDEXER_ENABLED", false),
    pollMs: intEnv("INDEXER_POLL_MS", 15_000, 1000),
    confirmations: BigInt(intEnv("INDEXER_CONFIRMATIONS", 2, 0)),
    blockBatchSize: BigInt(intEnv("INDEXER_BLOCK_BATCH_SIZE", 1000, 1)),
    lookbackBlocks: BigInt(intEnv("INDEXER_LOOKBACK_BLOCKS", 250_000, 0)),
    maxAgreementsPerTick: intEnv("INDEXER_MAX_AGREEMENTS_PER_TICK", 25, 1),
    logLevel: logLevel(),
    rpcUrls,
    factoryContracts: mergeFactoryContracts(
      parseFactoryContracts(process.env.FACTORY_CONTRACTS, 1),
      parseFactoryContracts(process.env.FACTORY_V2_CONTRACTS, 2),
      parseFactoryContracts(process.env.FACTORY_V3_CONTRACTS, 3),
    ),
    factoryIndexerEnabled: boolEnv("FACTORY_INDEXER_ENABLED", false),
  };
}

export function indexerEnabled(): boolean {
  return indexerConfig().enabled;
}
