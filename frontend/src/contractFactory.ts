import type { Address } from "viem";

export const DEALLOCK_FACTORY_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "agreement", type: "address" },
      { indexed: true, internalType: "address", name: "client", type: "address" },
      { indexed: true, internalType: "address", name: "provider", type: "address" },
      { indexed: false, internalType: "uint256", name: "chainId", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "contractVersion", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "milestoneCount", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "totalAmount", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "reviewPeriod", type: "uint256" },
      { indexed: false, internalType: "bytes32", name: "metadataHash", type: "bytes32" },
    ],
    name: "AgreementCreated",
    type: "event",
  },
  {
    inputs: [],
    name: "agreementCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "provider", type: "address" },
      { internalType: "string[]", name: "descriptions", type: "string[]" },
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
      { internalType: "uint256[]", name: "deadlines", type: "uint256[]" },
      { internalType: "uint256", name: "reviewPeriod", type: "uint256" },
      { internalType: "bytes32", name: "metadataHash", type: "bytes32" },
    ],
    name: "createAgreement",
    outputs: [{ internalType: "address", name: "agreement", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "factoryVersion",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "index", type: "uint256" }],
    name: "getAgreement",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "offset", type: "uint256" },
      { internalType: "uint256", name: "limit", type: "uint256" },
    ],
    name: "getAgreements",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "client_", type: "address" }],
    name: "getClientAgreementCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "client_", type: "address" },
      { internalType: "uint256", name: "offset", type: "uint256" },
      { internalType: "uint256", name: "limit", type: "uint256" },
    ],
    name: "getClientAgreements",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "provider_", type: "address" }],
    name: "getProviderAgreementCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "provider_", type: "address" },
      { internalType: "uint256", name: "offset", type: "uint256" },
      { internalType: "uint256", name: "limit", type: "uint256" },
    ],
    name: "getProviderAgreements",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "isDealLockAgreement",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const DEALLOCK_FACTORY_V2_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "agreement", type: "address" },
      { indexed: true, internalType: "address", name: "client", type: "address" },
      { indexed: true, internalType: "address", name: "provider", type: "address" },
      { indexed: false, internalType: "uint256", name: "chainId", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "contractVersion", type: "uint256" },
      { indexed: false, internalType: "address", name: "paymentToken", type: "address" },
      { indexed: false, internalType: "uint256", name: "milestoneCount", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "totalAmount", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "reviewPeriod", type: "uint256" },
      { indexed: false, internalType: "bytes32", name: "metadataHash", type: "bytes32" },
    ],
    name: "AgreementCreated",
    type: "event",
  },
  {
    inputs: [
      { internalType: "address", name: "provider", type: "address" },
      { internalType: "address", name: "paymentToken", type: "address" },
      { internalType: "string[]", name: "descriptions", type: "string[]" },
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
      { internalType: "uint256[]", name: "deadlines", type: "uint256[]" },
      { internalType: "uint256", name: "reviewPeriod", type: "uint256" },
      { internalType: "bytes32", name: "metadataHash", type: "bytes32" },
    ],
    name: "createAgreement",
    outputs: [{ internalType: "address", name: "agreement", type: "address" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "factoryVersion",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "pure",
    type: "function",
  },
] as const;

export const DEALLOCK_FACTORY_V3_ABI = DEALLOCK_FACTORY_V2_ABI;

const FACTORY_ADDRESSES: Record<number, Address | undefined> = {
  11155111: (import.meta.env.VITE_DEALLOCK_FACTORY_SEPOLIA as Address | undefined) || undefined,
  31337: (import.meta.env.VITE_DEALLOCK_FACTORY_HARDHAT as Address | undefined) || undefined,
};

const FACTORY_V2_ADDRESSES: Record<number, Address | undefined> = {
  11155111: (import.meta.env.VITE_DEALLOCK_FACTORY_V2_SEPOLIA as Address | undefined) || undefined,
  31337: (import.meta.env.VITE_DEALLOCK_FACTORY_V2_HARDHAT as Address | undefined) || undefined,
};

const FACTORY_V3_ADDRESSES: Record<number, Address | undefined> = {
  11155111: (import.meta.env.VITE_DEALLOCK_FACTORY_V3_SEPOLIA as Address | undefined) || undefined,
  31337: (import.meta.env.VITE_DEALLOCK_FACTORY_V3_HARDHAT as Address | undefined) || undefined,
};

export function getFactoryAddress(chainId: number): Address | null {
  const addr = FACTORY_ADDRESSES[chainId];
  if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) return null;
  return addr;
}

export function isFactoryConfigured(chainId: number): boolean {
  return getFactoryAddress(chainId) !== null;
}

export function getFactoryV2Address(chainId: number): Address | null {
  const addr = FACTORY_V2_ADDRESSES[chainId];
  if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) return null;
  return addr;
}

export function isFactoryV2Configured(chainId: number): boolean {
  return getFactoryV2Address(chainId) !== null;
}

export function getFactoryV3Address(chainId: number): Address | null {
  const addr = FACTORY_V3_ADDRESSES[chainId];
  if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) return null;
  return addr;
}

export function isFactoryV3Configured(chainId: number): boolean {
  return getFactoryV3Address(chainId) !== null;
}
