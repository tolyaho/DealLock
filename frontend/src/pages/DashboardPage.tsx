import { useState, useEffect, useCallback, useMemo } from "react";
import { useAccount, useChainId, useReadContract, useReadContracts } from "wagmi";
import { type Address } from "viem";
import { DEALLOCK_ABI } from "../contract.ts";
import {
  type AgreementSidebarFilter,
  type MilestoneData,
  type Role,
  deriveRole,
} from "../types.ts";
import {
  loadAgreementMetadata,
  saveAgreementMetadata,
  upsertAgreementRegistry,
  syncRegistryFromChain,
  touchAgreementAccess,
  loadSidebarFilter,
  saveSidebarFilter,
  normalizeContractAddress,
  type AgreementMetadata,
  type AgreementMetadataDraft,
} from "../storage.ts";
import {
  isSupportedChain,
  switchToSepolia,
  chainName,
  explorerAddressUrl,
  isSepoliaChain,
  HARDHAT_CHAIN_ID,
} from "../network.ts";
import { type ServiceTemplateId } from "../templates.ts";
import AppShell from "../components/layout/AppShell.tsx";
import AgreementOverview from "../components/AgreementOverview.tsx";
import AgreementContextSections from "../components/AgreementContextSections.tsx";
import MilestoneList from "../components/MilestoneList.tsx";
import ActionPanel from "../components/ActionPanel.tsx";
import CreateAgreementForm from "../components/CreateAgreementForm.tsx";
import WalletPanel from "../components/WalletPanel.tsx";
import AgreementSidebar from "../components/dashboard/AgreementSidebar.tsx";
import WelcomeHero from "../components/dashboard/DashboardHeader.tsx";
import WorkspaceHeader from "../components/dashboard/WorkspaceHeader.tsx";

const STORAGE_KEY = "deallock_contract_address";

type Mode = "create" | "load";

export default function DashboardPage() {
  const { address: account, isConnected } = useAccount();
  const chainId = useChainId();

  const [contractAddress, setContractAddress] = useState<Address | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (saved as Address) : null;
  });
  const [inputAddr, setInputAddr] = useState(() => localStorage.getItem(STORAGE_KEY) ?? "");
  const [mode, setMode] = useState<Mode>(() =>
    localStorage.getItem(STORAGE_KEY) ? "load" : "create",
  );
  const [agreementMetadata, setAgreementMetadata] = useState<AgreementMetadata | null>(null);
  const [switching, setSwitching] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState<AgreementSidebarFilter>(() => loadSidebarFilter());
  const [registryVersion, setRegistryVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 960px)");
    const apply = () => setSidebarCollapsed(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

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

  useEffect(() => {
    saveSidebarFilter(sidebarFilter);
  }, [sidebarFilter]);

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

  const role: Role = useMemo(
    () =>
      deriveRole(account, clientAddr as Address | undefined, providerAddr as Address | undefined),
    [account, clientAddr, providerAddr],
  );

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
  }, [rClient, rProvider, rTotal, rFunded, rReleased, rRefunded, rState, rBalance, rCount, rMilestones]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchAll();
    } finally {
      setRefreshing(false);
    }
  }, [refetchAll]);

  useEffect(() => {
    if (!contractAddress || !readsEnabled || readClientError || !clientAddr) return;
    syncRegistryFromChain({
      contractAddress,
      clientAddress: String(clientAddr).toLowerCase(),
      providerAddress: providerAddr ? String(providerAddr).toLowerCase() : null,
      agreementState: agreementState !== undefined ? Number(agreementState) : null,
      projectTitle: agreementMetadata?.projectTitle ?? null,
      serviceTemplate: agreementMetadata?.serviceTemplate ?? null,
      createdAt: agreementMetadata?.createdAt ?? null,
    });
    setRegistryVersion((v) => v + 1);
  }, [
    contractAddress,
    readsEnabled,
    readClientError,
    clientAddr,
    providerAddr,
    agreementState,
    agreementMetadata?.projectTitle,
    agreementMetadata?.serviceTemplate,
    agreementMetadata?.createdAt,
  ]);

  function handleSetAddress() {
    const trimmed = inputAddr.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return;
    const addr = trimmed as Address;
    setContractAddress(addr);
    upsertAgreementRegistry({
      contractAddress: addr,
      projectTitle: loadAgreementMetadata(addr)?.projectTitle ?? null,
      serviceTemplate: loadAgreementMetadata(addr)?.serviceTemplate ?? null,
      createdAt: loadAgreementMetadata(addr)?.createdAt ?? null,
      clientAddress: null,
      providerAddress: null,
      agreementState: null,
    });
    touchAgreementAccess(addr);
    setRegistryVersion((v) => v + 1);
    setMode("load");
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
    upsertAgreementRegistry({
      contractAddress: addr,
      projectTitle: full.projectTitle,
      serviceTemplate: full.serviceTemplate,
      createdAt: full.createdAt,
      clientAddress: null,
      providerAddress: null,
      agreementState: 0,
    });
    touchAgreementAccess(addr);
    setRegistryVersion((v) => v + 1);
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

  function handleSelectAgreement(addr: Address) {
    setContractAddress(addr);
    setInputAddr(addr);
    setMode("load");
    touchAgreementAccess(addr);
    setRegistryVersion((v) => v + 1);
  }

  function handleNewAgreement() {
    setMode("create");
    setContractAddress(null);
    setInputAddr("");
    localStorage.removeItem(STORAGE_KEY);
  }

  function handleLoadByAddress() {
    setMode("load");
    // Load UI only renders when no contract is selected; clear so "Load by address"
    // works even if another agreement was already open.
    if (contractAddress) {
      setContractAddress(null);
      setInputAddr("");
      localStorage.removeItem(STORAGE_KEY);
    }
    setSidebarCollapsed(true);
  }

  function handleRemovedFromRegistry(addr: string) {
    setRegistryVersion((v) => v + 1);
    const norm = normalizeContractAddress(addr);
    if (contractAddress && normalizeContractAddress(contractAddress) === norm) {
      handleClearSavedContract();
    }
  }

  const zeroDataContractRead =
    !!readClientError && /returned no data|\b0x\b/i.test(readClientError.message);

  const showWorkspace = !!contractAddress;

  return (
    <AppShell>
      <div className="dashboard-layout">
        <AgreementSidebar
          key={registryVersion}
          wallet={account}
          activeAddress={contractAddress}
          filter={sidebarFilter}
          onFilterChange={setSidebarFilter}
          onSelect={handleSelectAgreement}
          onNewAgreement={handleNewAgreement}
          onLoadByAddress={handleLoadByAddress}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          onRemovedFromRegistry={handleRemovedFromRegistry}
        />

        <div className="dashboard-main">
          <div className="dashboard-body">
            {showWorkspace ? (
              <WorkspaceHeader
                contractAddress={contractAddress!}
                role={role}
                projectTitle={agreementMetadata?.projectTitle}
                serviceTemplate={agreementMetadata?.serviceTemplate as ServiceTemplateId | undefined}
                agreementState={agreementState as number | undefined}
                totalAmount={totalAmount as bigint | undefined}
                releasedAmount={releasedAmount as bigint | undefined}
                refundedAmount={refundedAmount as bigint | undefined}
                onRefresh={readsEnabled ? handleRefresh : undefined}
                refreshing={refreshing}
              />
            ) : (
              <WelcomeHero chainOk={chainOk} isConnected={isConnected} />
            )}
            {isConnected && !chainOk && (
              <div className="banner banner-warn">
                <div className="banner-content">
                  <strong>Wrong network.</strong> You are on {chainName(chainId)}. This demo targets{" "}
                  <strong>Sepolia</strong> (11155111).
                </div>
                <div className="banner-actions">
                  <button
                    type="button"
                    className="btn btn-warning btn-sm"
                    onClick={handleSwitchSepolia}
                    disabled={switching}
                  >
                    {switching ? "Switching…" : "Switch to Sepolia"}
                  </button>
                </div>
              </div>
            )}

            {contractAddress && isConnected && chainOk && readClientError && (
              <div className="banner banner-error">
                <strong>Cannot read this agreement.</strong>{" "}
                {zeroDataContractRead
                  ? "No DealLock contract data at this address on the current network."
                  : "An error occurred reading contract data."}
                <ul className="banner-list">
                  <li>
                    <strong>Wrong chain:</strong> MetaMask is on <strong>{chainName(chainId)}</strong>.
                    Use the same chain where the contract was deployed.
                  </li>
                  <li>
                    <strong>Wrong address:</strong> use the contract address from the deployment
                    transaction, not a wallet address.
                    {isSepoliaChain(chainId) && contractAddress && (
                      <>
                        {" "}
                        <a
                          href={explorerAddressUrl(chainId, contractAddress) ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Sepolia Etherscan
                        </a>
                      </>
                    )}
                  </li>
                  {chainId === HARDHAT_CHAIN_ID && (
                    <li>
                      <strong>Local Hardhat:</strong> run <code>npx hardhat node</code> in the
                      project root.
                    </li>
                  )}
                </ul>
                <div className="banner-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={handleClearSavedContract}
                  >
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
                <strong>Connect your wallet</strong> to interact with this agreement on Sepolia.
              </div>
            )}

            {!isConnected && <WalletPanel />}

            {!contractAddress && isConnected && (
              <>
                <div className="welcome-tiles">
                  <button
                    type="button"
                    className={`welcome-tile ${mode === "create" ? "welcome-tile--active" : ""}`}
                    onClick={() => setMode("create")}
                  >
                    <span className="welcome-tile-icon" aria-hidden>◈</span>
                    <h3>Create agreement</h3>
                    <p>Deploy a new milestone escrow; your wallet becomes the client.</p>
                  </button>
                  <button
                    type="button"
                    className={`welcome-tile ${mode === "load" ? "welcome-tile--active" : ""}`}
                    onClick={() => setMode("load")}
                  >
                    <span className="welcome-tile-icon" aria-hidden>↗</span>
                    <h3>Load by address</h3>
                    <p>Paste any DealLock contract — it will be saved to this browser.</p>
                  </button>
                </div>

                {mode === "create" && <CreateAgreementForm onDeployed={handleDeployed} />}

                {mode === "load" && (
                  <section className="surface-card surface-card--pad anim-fade-rise">
                    <div className="surface-card-head">
                      <h2 className="surface-card-title">Load agreement</h2>
                      <p className="surface-card-desc">
                        Paste a DealLock contract address. It will appear under{" "}
                        <strong>My agreements</strong> in the sidebar.
                      </p>
                    </div>
                    <div className="load-contract-row">
                      <input
                        type="text"
                        className="input input-mono"
                        placeholder="0x…"
                        value={inputAddr}
                        onChange={(e) => setInputAddr(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSetAddress()}
                      />
                      <button type="button" className="btn btn-primary" onClick={handleSetAddress}>
                        Load
                      </button>
                    </div>
                  </section>
                )}
              </>
            )}

            {contractAddress && isConnected && (
              <>
                <AgreementOverview
                  viewerRole={role}
                  clientAddr={clientAddr as Address | undefined}
                  providerAddr={providerAddr as Address | undefined}
                  totalAmount={totalAmount as bigint | undefined}
                  fundedAmount={fundedAmount as bigint | undefined}
                  releasedAmount={releasedAmount as bigint | undefined}
                  refundedAmount={refundedAmount as bigint | undefined}
                  balance={balance as bigint | undefined}
                />

                <ActionPanel
                  contractAddress={contractAddress}
                  role={role}
                  agreementState={agreementState as number | undefined}
                  totalAmount={totalAmount as bigint | undefined}
                  milestones={milestones}
                  onSuccess={refetchAll}
                />

                <MilestoneList
                  milestones={milestones}
                  milestoneNotes={agreementMetadata?.milestoneNotes}
                  agreementState={agreementState as number | undefined}
                />

                <AgreementContextSections metadata={agreementMetadata} />
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
