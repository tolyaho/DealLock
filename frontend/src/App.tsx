import { useState, useEffect, useCallback } from "react";
import { useAccount, useChainId, useReadContract, useReadContracts } from "wagmi";
import { type Address } from "viem";
import { DEALLOCK_ABI } from "./contract.ts";
import { type MilestoneData, type Role } from "./types.ts";
import {
  loadAgreementMetadata,
  saveAgreementMetadata,
  type AgreementMetadata,
  type AgreementMetadataDraft,
} from "./storage.ts";
import {
  isSupportedChain,
  switchToSepolia,
  chainName,
  explorerAddressUrl,
  isSepoliaChain,
  HARDHAT_CHAIN_ID,
} from "./network.ts";
import AgreementOverview from "./components/AgreementOverview.tsx";
import AgreementContextSections from "./components/AgreementContextSections.tsx";
import MilestoneList from "./components/MilestoneList.tsx";
import ActionPanel from "./components/ActionPanel.tsx";
import CreateAgreementForm from "./components/CreateAgreementForm.tsx";
import WalletPanel from "./components/WalletPanel.tsx";

const STORAGE_KEY = "deallock_contract_address";

type Mode = "create" | "load";

export default function App() {
  const { address: account, isConnected } = useAccount();
  const chainId = useChainId();

  const [contractAddress, setContractAddress] = useState<Address | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (saved as Address) : null;
  });
  const [inputAddr, setInputAddr] = useState(contractAddress ?? "");
  const [mode, setMode] = useState<Mode>(contractAddress ? "load" : "create");
  const [agreementMetadata, setAgreementMetadata] = useState<AgreementMetadata | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (contractAddress) {
      localStorage.setItem(STORAGE_KEY, contractAddress);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [contractAddress]);

  useEffect(() => {
    if (!contractAddress) {
      setAgreementMetadata(null);
      return;
    }
    setAgreementMetadata(loadAgreementMetadata(contractAddress));
  }, [contractAddress]);

  const chainOk = isSupportedChain(chainId);
  const readsEnabled = !!contractAddress && isConnected && chainOk;

  const contractArgs = {
    address: contractAddress!,
    abi: DEALLOCK_ABI,
    chainId,
  } as const;

  const { data: clientAddr, refetch: rClient, error: readClientError, isPending: readPending } =
    useReadContract({
      ...contractArgs,
      functionName: "client",
      query: { enabled: readsEnabled },
    });
  const { data: providerAddr, refetch: rProvider } = useReadContract({
    ...contractArgs,
    functionName: "provider",
    query: { enabled: readsEnabled },
  });
  const { data: totalAmount, refetch: rTotal } = useReadContract({
    ...contractArgs,
    functionName: "totalAmount",
    query: { enabled: readsEnabled },
  });
  const { data: fundedAmount, refetch: rFunded } = useReadContract({
    ...contractArgs,
    functionName: "fundedAmount",
    query: { enabled: readsEnabled },
  });
  const { data: releasedAmount, refetch: rReleased } = useReadContract({
    ...contractArgs,
    functionName: "releasedAmount",
    query: { enabled: readsEnabled },
  });
  const { data: refundedAmount, refetch: rRefunded } = useReadContract({
    ...contractArgs,
    functionName: "refundedAmount",
    query: { enabled: readsEnabled },
  });
  const { data: agreementState, refetch: rState } = useReadContract({
    ...contractArgs,
    functionName: "agreementState",
    query: { enabled: readsEnabled },
  });
  const { data: balance, refetch: rBalance } = useReadContract({
    ...contractArgs,
    functionName: "getContractBalance",
    query: { enabled: readsEnabled },
  });
  const { data: milestoneCount, refetch: rCount } = useReadContract({
    ...contractArgs,
    functionName: "getMilestoneCount",
    query: { enabled: readsEnabled },
  });

  const count = milestoneCount ? Number(milestoneCount) : 0;

  const milestoneContracts = Array.from({ length: count }, (_, i) => ({
    ...contractArgs,
    functionName: "getMilestone" as const,
    args: [BigInt(i)] as const,
  }));

  const { data: rawMilestones, refetch: rMilestones } = useReadContracts({
    contracts: milestoneContracts,
    query: { enabled: readsEnabled && count > 0 },
  });

  const milestones: MilestoneData[] = (rawMilestones ?? [])
    .map((r, i) => {
      if (r.status !== "success") return null;
      const [description, amount, deadline, proof, submittedAt, state] =
        r.result as [string, bigint, bigint, string, bigint, number];
      return { id: i, description, amount, deadline, proof, submittedAt, state };
    })
    .filter((m): m is MilestoneData => m !== null);

  const role: Role =
    account && clientAddr && account.toLowerCase() === clientAddr.toLowerCase()
      ? "client"
      : account &&
          providerAddr &&
          account.toLowerCase() === providerAddr.toLowerCase()
        ? "provider"
        : "other";

  const refetchAll = useCallback(async () => {
    await Promise.all([
      rClient(),
      rProvider(),
      rTotal(),
      rFunded(),
      rReleased(),
      rRefunded(),
      rState(),
      rBalance(),
      rCount(),
      rMilestones(),
    ]);
  }, [
    rClient, rProvider, rTotal, rFunded, rReleased,
    rRefunded, rState, rBalance, rCount, rMilestones,
  ]);

  function handleSetAddress() {
    const trimmed = inputAddr.trim();
    if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
      setContractAddress(trimmed as Address);
    }
  }

  function handleDeployed(addr: Address, draft: AgreementMetadataDraft) {
    const full: AgreementMetadata = {
      ...draft,
      contractAddress: addr,
      createdAt: new Date().toISOString(),
    };
    saveAgreementMetadata(full);
    setAgreementMetadata(full);
    setContractAddress(addr);
    setInputAddr(addr);
    setMode("load");
  }

  async function handleSwitchSepolia() {
    setSwitching(true);
    await switchToSepolia();
    setSwitching(false);
  }

  const handleClearSavedContract = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setContractAddress(null);
    setInputAddr("");
    setMode("create");
  }, []);

  const zeroDataContractRead =
    !!readClientError &&
    /returned no data|\b0x\b/i.test(readClientError.message);

  const contractExplorerUrl =
    contractAddress ? explorerAddressUrl(chainId, contractAddress) : null;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Manage your milestone-based escrow agreements on Sepolia</p>
      </div>

      {isConnected && !chainOk && (
        <div className="banner banner-warn">
          <strong>Wrong network.</strong> You are on {chainName(chainId)}.
          DealLock requires <strong>Sepolia</strong> (chain 11155111).
          <div className="banner-actions">
            <button className="btn btn-warning btn-sm" onClick={handleSwitchSepolia} disabled={switching}>
              {switching ? "Switching…" : "Switch to Sepolia"}
            </button>
          </div>
        </div>
      )}

      {contractAddress && isConnected && chainOk && readClientError && (
        <div className="banner banner-error">
          <strong>Cannot read this agreement.</strong>{" "}
          {zeroDataContractRead
            ? "The RPC returned no data — usually there is no DealLock contract at this address on the current network."
            : "An error occurred reading contract data."}
          <ul className="banner-list">
            <li>
              <strong>Wrong chain:</strong> MetaMask is on <strong>{chainName(chainId)}</strong>. Use the same chain where the contract was deployed.
            </li>
            <li>
              <strong>Wrong address:</strong> paste the contract address from the deployment tx, not a wallet address.
              {isSepoliaChain(chainId) && contractAddress && (
                <>
                  {" "}Check on{" "}
                  <a href={explorerAddressUrl(chainId, contractAddress) ?? "#"} target="_blank" rel="noopener noreferrer">
                    Sepolia Etherscan
                  </a>.
                </>
              )}
            </li>
            {chainId === HARDHAT_CHAIN_ID && (
              <li>
                <strong>Local Hardhat:</strong> run <code>npx hardhat node</code> in the project root.
              </li>
            )}
          </ul>
          <div className="banner-actions">
            <button className="btn btn-sm btn-secondary" onClick={handleClearSavedContract}>
              Clear saved contract
            </button>
          </div>
          <details className="banner-details">
            <summary>Technical detail</summary>
            <pre className="banner-pre">{readClientError.message}</pre>
          </details>
        </div>
      )}

      {contractAddress && isConnected && chainOk && readPending && !readClientError && (
        <div className="banner banner-info">Loading agreement data…</div>
      )}

      {contractAddress && !isConnected && (
        <div className="banner banner-warn">
          <strong>Connect your wallet</strong> to load this agreement on Sepolia.
        </div>
      )}

      {isConnected && <WalletPanel role={role} />}

      {!contractAddress && (
        <div className="welcome-grid">
          <div className="welcome-card" onClick={() => setMode("create")}>
            <div className="welcome-card-icon">✦</div>
            <h3>Create New Agreement</h3>
            <p>Deploy a milestone escrow contract for a new project</p>
          </div>
          <div className="welcome-card" onClick={() => { setMode("load"); }}>
            <div className="welcome-card-icon">↗</div>
            <h3>Load Existing Agreement</h3>
            <p>Enter a contract address to view and interact with an agreement</p>
          </div>
        </div>
      )}

      <div className="tabs" style={{ marginTop: contractAddress ? 0 : "1.5rem" }}>
        <button className={`tab ${mode === "create" ? "tab-active" : ""}`} onClick={() => setMode("create")}>
          Create New
        </button>
        <button className={`tab ${mode === "load" ? "tab-active" : ""}`} onClick={() => setMode("load")}>
          Load Existing
        </button>
      </div>

      {mode === "create" && <CreateAgreementForm onDeployed={handleDeployed} />}

      {mode === "load" && (
        <section className="card">
          <div className="card-header">
            <span className="card-title">Contract Address</span>
          </div>
          <div className="load-contract">
            <input
              type="text"
              className="input-mono"
              placeholder="0x..."
              value={inputAddr}
              onChange={(e) => setInputAddr(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSetAddress()}
            />
            <button className="btn btn-primary" onClick={handleSetAddress}>Load</button>
          </div>
          {contractAddress && (
            <div className="active-contract">
              <span className="active-contract-label">Active</span>
              <code>{contractAddress}</code>
              <button type="button" className="btn-icon" title="Copy" onClick={() => navigator.clipboard.writeText(contractAddress)}>
                Copy
              </button>
              {contractExplorerUrl && (
                <a href={contractExplorerUrl} target="_blank" rel="noopener noreferrer" className="btn-icon">
                  Etherscan ↗
                </a>
              )}
            </div>
          )}
        </section>
      )}

      {contractAddress && (
        <>
          <AgreementOverview
            clientAddr={clientAddr as Address | undefined}
            providerAddr={providerAddr as Address | undefined}
            totalAmount={totalAmount as bigint | undefined}
            fundedAmount={fundedAmount as bigint | undefined}
            releasedAmount={releasedAmount as bigint | undefined}
            refundedAmount={refundedAmount as bigint | undefined}
            agreementState={agreementState as number | undefined}
            balance={balance as bigint | undefined}
            projectTitle={agreementMetadata?.projectTitle}
            contractAddress={contractAddress}
          />

          {isConnected && chainOk && (
            <div className="refresh-row">
              <button className="btn btn-ghost btn-sm" onClick={refetchAll}>
                ↻ Refresh
              </button>
            </div>
          )}

          <AgreementContextSections metadata={agreementMetadata} />
          <MilestoneList milestones={milestones} milestoneNotes={agreementMetadata?.milestoneNotes} />
          <ActionPanel
            contractAddress={contractAddress}
            role={role}
            agreementState={agreementState as number | undefined}
            totalAmount={totalAmount as bigint | undefined}
            milestones={milestones}
            onSuccess={refetchAll}
          />
        </>
      )}
    </div>
  );
}
