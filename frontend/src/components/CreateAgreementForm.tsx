import { useEffect, useState } from "react";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import { type Address, isAddress, createWalletClient, custom, decodeEventLog, type Hex } from "viem";
import { sepolia, hardhat } from "viem/chains";
import { DEALLOCK_V4_ABI } from "../contractV4.ts";
import { DEALLOCK_V4_BYTECODE } from "../bytecodeV4.ts";
import {
  DEALLOCK_FACTORY_ABI,
  DEALLOCK_FACTORY_V2_ABI,
  DEALLOCK_FACTORY_V3_ABI,
  getFactoryAddress,
  getFactoryV2Address,
  getFactoryV3Address,
  isFactoryConfigured,
  isFactoryV2Configured,
  isFactoryV3Configured,
} from "../contractFactory.ts";
import {
  SERVICE_TEMPLATE_IDS,
  getServiceTemplate,
  type ServiceTemplateId,
} from "../templates.ts";
import { type AgreementMetadataDraft } from "../storage.ts";
import { isSupportedChain, explorerTxUrl, explorerAddressUrl, humanizeContractError } from "../network.ts";
import { useAccountSession } from "../account/useAccountSession.ts";
import {
  assetKey,
  parseAssetAmount,
  paymentAssetsForChain,
} from "../tokens.ts";

interface MilestoneInput {
  description: string;
  amount: string;
  deadline: string;
  note: string;
}

function emptyMilestone(): MilestoneInput {
  return { description: "", amount: "", deadline: "", note: "" };
}

function milestonesFromTemplate(id: ServiceTemplateId): MilestoneInput[] {
  const t = getServiceTemplate(id);
  return t.milestones.map((row) => ({
    description: row.description,
    amount: "",
    deadline: "",
    note: row.note ?? "",
  }));
}

type DeployState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "confirming"; hash: `0x${string}` }
  | { status: "success"; address: Address; hash: `0x${string}` }
  | { status: "error"; message: string };

interface Props {
  onDeployed: (
    address: Address,
    draft: AgreementMetadataDraft,
    receipt: {
      deploymentTxHash: string;
      deploymentBlockNumber: string;
      creationSource: "factory" | "direct";
      factoryVersion?: number;
      factoryAddress?: string;
      factoryTxHash?: string;
      factoryLogIndex?: number;
      metadataHash?: string;
      paymentAssetKind?: "native" | "erc20";
      paymentTokenAddress?: string | null;
      paymentSymbol?: string;
      paymentDecimals?: number;
    },
  ) => void;
}

const initialTemplate = getServiceTemplate("website");

function normalizeContactEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return email || null;
}

function isValidContactEmail(value: string): boolean {
  const email = normalizeContactEmail(value);
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function CreateAgreementForm({ onDeployed }: Props) {
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const { user, sessionStatus } = useAccountSession();

  const [serviceTemplateId, setServiceTemplateId] = useState<ServiceTemplateId>("website");
  const [projectTitle, setProjectTitle] = useState(initialTemplate.defaultProjectTitle);
  const [providerAddr, setProviderAddr] = useState("");
  const [milestones, setMilestones] = useState<MilestoneInput[]>(() =>
    milestonesFromTemplate("website"),
  );
  const [evidenceGuidance, setEvidenceGuidance] = useState(initialTemplate.evidenceGuidance);
  const [acceptanceGuidance, setAcceptanceGuidance] = useState(
    initialTemplate.acceptanceGuidance,
  );
  const [disputeBoundaryNote, setDisputeBoundaryNote] = useState(
    initialTemplate.disputeBoundaryNote,
  );
  const [clientEmail, setClientEmail] = useState("");
  const [providerEmail, setProviderEmail] = useState("");
  const [paymentAssetKey, setPaymentAssetKey] = useState("native");
  const [errors, setErrors] = useState<string[]>([]);
  const [deployState, setDeployState] = useState<DeployState>({ status: "idle" });

  const chainOk = isSupportedChain(chainId);
  const paymentAssets = paymentAssetsForChain(chainId);
  const selectedPaymentAsset =
    paymentAssets.find((asset) => assetKey(asset) === paymentAssetKey) ?? paymentAssets[0]!;

  useEffect(() => {
    if (!paymentAssets.some((asset) => assetKey(asset) === paymentAssetKey)) {
      setPaymentAssetKey(assetKey(paymentAssets[0]!));
    }
  }, [paymentAssetKey, paymentAssets]);

  useEffect(() => {
    if (sessionStatus !== "signed-in" || !user?.email || !user.emailVerifiedAt || clientEmail) return;
    setClientEmail(user.email);
  }, [clientEmail, sessionStatus, user?.email, user?.emailVerifiedAt]);

  function applyTemplate(id: ServiceTemplateId) {
    const t = getServiceTemplate(id);
    setServiceTemplateId(id);
    setProjectTitle(t.defaultProjectTitle);
    setMilestones(milestonesFromTemplate(id));
    setEvidenceGuidance(t.evidenceGuidance);
    setAcceptanceGuidance(t.acceptanceGuidance);
    setDisputeBoundaryNote(t.disputeBoundaryNote);
  }

  function updateMilestone(index: number, field: keyof MilestoneInput, value: string) {
    setMilestones((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    );
  }

  function addMilestone() {
    setMilestones((prev) => [...prev, emptyMilestone()]);
  }

  function removeMilestone(index: number) {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  }

  function validate(): string[] {
    const errs: string[] = [];

    if (selectedPaymentAsset.kind === "erc20" && !factoryV2Configured && !factoryV3Configured) {
      errs.push("ERC-20 agreements require Factory V2 or Factory V3. Configure a payment-aware factory for this network or select ETH.");
    }

    if (!providerAddr.trim() || !isAddress(providerAddr.trim())) {
      errs.push("Provider must be a valid EVM address.");
    }

    if (!projectTitle.trim()) {
      errs.push("Project title is required.");
    }

    if (!isValidContactEmail(clientEmail)) {
      errs.push("Client notification email must be a valid email address.");
    }
    if (!isValidContactEmail(providerEmail)) {
      errs.push("Provider notification email must be a valid email address.");
    }

    if (milestones.length === 0) {
      errs.push("At least one milestone is required.");
      return errs;
    }

    const now = Math.floor(Date.now() / 1000);
    let prevTs = 0;

    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i]!;
      if (!m.description.trim()) errs.push(`Milestone ${i}: description is empty.`);

      try {
        const amt = parseAssetAmount(m.amount, selectedPaymentAsset);
        if (amt <= 0n) errs.push(`Milestone ${i}: amount must be > 0 ${selectedPaymentAsset.symbol}.`);
      } catch {
        errs.push(`Milestone ${i}: amount must be a valid ${selectedPaymentAsset.symbol} amount.`);
      }

      if (!m.deadline) {
        errs.push(`Milestone ${i}: deadline is required.`);
      } else {
        const ts = Math.floor(new Date(m.deadline).getTime() / 1000);
        if (ts <= now) errs.push(`Milestone ${i}: deadline must be in the future.`);
        if (ts < prevTs) errs.push(`Milestone ${i}: deadlines must be nondecreasing.`);
        prevTs = ts;
      }
    }

    return errs;
  }

  async function handleDeploy() {
    const errs = validate();
    setErrors(errs);
    if (errs.length > 0) {
      setDeployState({ status: "error", message: "Fix validation errors above, then deploy again." });
      return;
    }
    let signer: any = walletClient;
    if (!signer) {
      try {
        const { getWalletClient } = await import("wagmi/actions");
        const { config } = await import("../wagmi.ts");
        signer = await getWalletClient(config, { chainId });
      } catch {
        signer = undefined;
      }
    }
    if (!signer) {
      try {
        const injected = (window as Window & { ethereum?: unknown }).ethereum;
        if (injected) {
          const accounts = (await (
            injected as { request: (args: { method: string }) => Promise<unknown> }
          ).request({ method: "eth_accounts" })) as string[];
          const account = accounts[0];
          if (account && isAddress(account)) {
            signer = createWalletClient({
              account: account as Address,
              chain: chainId === sepolia.id ? sepolia : hardhat,
              transport: custom(injected),
            });
          }
        }
      } catch {
        signer = undefined;
      }
    }
    if (!signer) {
      setDeployState({
        status: "error",
        message:
          "Wallet client unavailable. Unlock MetaMask, reconnect this site, then try again. If it still fails, disable script/privacy blockers for localhost:5173.",
      });
      return;
    }

    setDeployState({ status: "pending" });

    try {
      const descriptions = milestones.map((m) => m.description.trim());
      const amounts = milestones.map((m) => parseAssetAmount(m.amount, selectedPaymentAsset));
      const deadlines = milestones.map((m) =>
        BigInt(Math.floor(new Date(m.deadline).getTime() / 1000)),
      );
      const REVIEW_PERIOD_SECONDS = BigInt(3 * 24 * 60 * 60); // 3 days
      const ZERO_METADATA_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

      const { getPublicClient } = await import("wagmi/actions");
      const { config } = await import("../wagmi.ts");
      const publicClient = getPublicClient(config);
      if (!publicClient) throw new Error("No public client available");

      const factoryV2Address = getFactoryV2Address(chainId);
      const factoryV3Address = getFactoryV3Address(chainId);
      const factoryAddress = getFactoryAddress(chainId);

      let hash: `0x${string}`;
      let addr: Address;
      let creationSource: "factory" | "direct";
      let factoryVersion: number | undefined;
      let factoryTxHash: string | undefined;
      let factoryLogIndex: number | undefined;

      let usedFactoryAddress: Address | null = null;

      if (factoryV3Address || factoryV2Address) {
        const paymentAwareFactoryAddress = factoryV3Address ?? factoryV2Address!;
        const paymentAwareFactoryAbi = factoryV3Address ? DEALLOCK_FACTORY_V3_ABI : DEALLOCK_FACTORY_V2_ABI;
        // Deploy through the newest configured payment-aware factory.
        hash = await signer.writeContract({
          address: paymentAwareFactoryAddress,
          abi: paymentAwareFactoryAbi,
          functionName: "createAgreement",
          args: [
            providerAddr.trim() as Address,
            selectedPaymentAsset.address ?? "0x0000000000000000000000000000000000000000",
            descriptions,
            amounts,
            deadlines,
            REVIEW_PERIOD_SECONDS,
            ZERO_METADATA_HASH,
          ],
        });
        usedFactoryAddress = paymentAwareFactoryAddress;

        setDeployState({ status: "confirming", hash });

        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          timeout: 120_000,
        });

        let parsedAddr: Address | null = null;
        let parsedLogIndex: number | undefined;
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: paymentAwareFactoryAbi,
              data: log.data,
              topics: log.topics as [Hex, ...Hex[]],
            });
            if (decoded.eventName === "AgreementCreated") {
              parsedAddr = (decoded.args as { agreement: Address }).agreement;
              parsedLogIndex = log.logIndex;
              break;
            }
          } catch {
            // skip non-factory logs
          }
        }

        if (!parsedAddr) throw new Error("AgreementCreated event not found in receipt");
        addr = parsedAddr;
        creationSource = "factory";
        factoryVersion = factoryV3Address ? 3 : 2;
        factoryTxHash = hash;
        factoryLogIndex = parsedLogIndex;
      } else if (selectedPaymentAsset.kind === "erc20") {
        throw new Error("ERC-20 agreements require VITE_DEALLOCK_FACTORY_V3_* or VITE_DEALLOCK_FACTORY_V2_* to be configured for this network.");
      } else if (factoryAddress) {
        // Deploy native ETH agreement through legacy factory.
        hash = await signer.writeContract({
          address: factoryAddress,
          abi: DEALLOCK_FACTORY_ABI,
          functionName: "createAgreement",
          args: [
            providerAddr.trim() as Address,
            descriptions,
            amounts,
            deadlines,
            REVIEW_PERIOD_SECONDS,
            ZERO_METADATA_HASH,
          ],
        });

        setDeployState({ status: "confirming", hash });

        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          timeout: 120_000,
        });

        // Parse AgreementCreated log to extract the deployed agreement address.
        let parsedAddr: Address | null = null;
        let parsedLogIndex: number | undefined;
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: DEALLOCK_FACTORY_ABI,
              data: log.data,
              topics: log.topics as [Hex, ...Hex[]],
            });
            if (decoded.eventName === "AgreementCreated") {
              parsedAddr = (decoded.args as { agreement: Address }).agreement;
              parsedLogIndex = log.logIndex;
              break;
            }
          } catch {
            // skip non-factory logs
          }
        }

        if (!parsedAddr) throw new Error("AgreementCreated event not found in receipt");
        addr = parsedAddr;
        creationSource = "factory";
        factoryVersion = 1;
        factoryTxHash = hash;
        factoryLogIndex = parsedLogIndex;
        usedFactoryAddress = factoryAddress;
      } else {
        // Direct V4 deployment (fallback for local dev without factory configured).
        hash = await signer.deployContract({
          abi: DEALLOCK_V4_ABI,
          bytecode: DEALLOCK_V4_BYTECODE,
          args: [providerAddr.trim() as Address, descriptions, amounts, deadlines, REVIEW_PERIOD_SECONDS],
        });

        setDeployState({ status: "confirming", hash });

        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          timeout: 120_000,
        });

        if (!receipt.contractAddress) throw new Error("No contract address in receipt");
        addr = receipt.contractAddress as Address;
        creationSource = "direct";
      }

      const t = getServiceTemplate(serviceTemplateId);
      const draft: AgreementMetadataDraft = {
        projectTitle: projectTitle.trim(),
        serviceTemplate: serviceTemplateId,
        serviceCategory: t.serviceCategory,
        evidenceGuidance: evidenceGuidance.trim(),
        acceptanceGuidance: acceptanceGuidance.trim(),
        disputeBoundaryNote: disputeBoundaryNote.trim(),
        milestoneNotes: milestones.map((m) => m.note.trim()),
        clientEmail: normalizeContactEmail(clientEmail),
        providerEmail: normalizeContactEmail(providerEmail),
        paymentAssetKind: selectedPaymentAsset.kind,
        paymentTokenAddress: selectedPaymentAsset.address,
        paymentSymbol: selectedPaymentAsset.symbol,
        paymentDecimals: selectedPaymentAsset.decimals,
      };

      // Extract block number from receipt for indexer start block.
      const receiptForBlock = await publicClient.waitForTransactionReceipt({ hash, timeout: 5_000 }).catch(() => null);
      const blockNumber = receiptForBlock?.blockNumber?.toString() ?? "0";

      setDeployState({ status: "success", address: addr, hash });
      onDeployed(addr, draft, {
        deploymentTxHash: hash,
        deploymentBlockNumber: blockNumber,
        creationSource,
        ...(factoryVersion !== undefined ? { factoryVersion } : {}),
        ...(usedFactoryAddress ? { factoryAddress: usedFactoryAddress } : {}),
        ...(factoryTxHash ? { factoryTxHash } : {}),
        ...(factoryLogIndex !== undefined ? { factoryLogIndex } : {}),
        metadataHash: ZERO_METADATA_HASH,
        paymentAssetKind: selectedPaymentAsset.kind,
        paymentTokenAddress: selectedPaymentAsset.address,
        paymentSymbol: selectedPaymentAsset.symbol,
        paymentDecimals: selectedPaymentAsset.decimals,
      });
    } catch (err: unknown) {
      setDeployState({ status: "error", message: humanizeContractError(err) });
    }
  }

  function copyAddress() {
    if (deployState.status === "success") {
      navigator.clipboard.writeText(deployState.address);
    }
  }

  const busy = deployState.status === "pending" || deployState.status === "confirming";

  function scrollToOverview() {
    document.getElementById("dealock-overview")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const factoryConfigured = isFactoryConfigured(chainId);
  const factoryV2Configured = isFactoryV2Configured(chainId);
  const factoryV3Configured = isFactoryV3Configured(chainId);

  return (
    <section className="surface-card surface-card--pad" id="dealock-create">
      <div className="surface-card-head">
        <h2 className="surface-card-title">Create agreement</h2>
        <p className="surface-card-desc">
          Deploy milestone escrow for <strong>digital freelance deliverables</strong>. Only provider
          address, milestone text, amounts, and deadlines go on-chain. Titles and guidance stay in this
          browser.
        </p>
        {chainOk && (
          <p className="hint" style={{ marginTop: "0.25rem" }}>
            {factoryV3Configured
              ? "Agreements are deployed through Factory V3 — V6 deadline extensions, ETH, and configured ERC-20 assets supported."
              : factoryV2Configured
                ? "Agreements are deployed through Factory V2 — ETH and configured ERC-20 assets supported."
              : factoryConfigured
                ? "Native ETH agreements use the DealLock Factory. Configure Factory V3 or V2 for USDC/ERC-20 agreements."
                : "Direct ETH deployment (no factory configured for this network). Configure Factory V3 or V2 to enable USDC/ERC-20 agreements."}
          </p>
        )}
      </div>

      {!isConnected && (
        <div className="form-empty">
          <div className="form-empty-icon" aria-hidden>
            ◈
          </div>
          <h3 className="form-empty-title">Connect your wallet</h3>
          <p className="form-empty-text">The deploying wallet becomes the on-chain client.</p>
        </div>
      )}

      {isConnected && !chainOk && (
        <div className="form-empty">
          <div className="form-empty-icon" aria-hidden>
            ⚠
          </div>
          <h3 className="form-empty-title">Switch to Sepolia</h3>
          <p className="form-empty-text">Deployments target the Sepolia demo network.</p>
        </div>
      )}

      {isConnected && chainOk && (
        <>
          <div className="form-section">
            <h3 className="form-section-title">Template & project</h3>
          <div className="field">
            <label className="label">Service template</label>
            <select
              value={serviceTemplateId}
              onChange={(e) => applyTemplate(e.target.value as ServiceTemplateId)}
              disabled={busy}
            >
              {SERVICE_TEMPLATE_IDS.map((id) => (
                <option key={id} value={id}>
                  {getServiceTemplate(id).label}
                </option>
              ))}
            </select>
            <p className="hint">Prefills milestones and guidance — edit before deploy.</p>
          </div>

          <div className="field">
            <label className="label">Project title</label>
            <input
              type="text"
              placeholder="e.g. Marketing landing v2"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="field">
            <label className="label">Provider address</label>
            <input
              type="text"
              className="input-mono"
              placeholder="0x..."
              value={providerAddr}
              onChange={(e) => setProviderAddr(e.target.value)}
              disabled={busy}
            />
          </div>

          </div>

          <div className="form-section">
            <h3 className="form-section-title">Notification contacts (off-chain)</h3>
            <div className="form-row form-row--2">
              <div className="field">
                <label className="label">Client notification email (optional)</label>
                <input
                  type="email"
                  placeholder="client@example.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label className="label">Provider notification email (optional)</label>
                <input
                  type="email"
                  placeholder="provider@example.com"
                  value={providerEmail}
                  onChange={(e) => setProviderEmail(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>
            <p className="hint">
              Contact emails are stored off-chain for notifications only. Wallets still control funds and contract actions.
            </p>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">Payment asset</h3>
            <div className="field">
              <label className="label">Escrow asset</label>
              <select
                value={assetKey(selectedPaymentAsset)}
                onChange={(e) => setPaymentAssetKey(e.target.value)}
                disabled={busy}
              >
                {paymentAssets.map((asset) => (
                  <option key={assetKey(asset)} value={assetKey(asset)}>
                    {asset.symbol} — {asset.name}
                  </option>
                ))}
              </select>
              <p className="hint">
                {selectedPaymentAsset.kind === "native"
                  ? "ETH agreements fund escrow in one transaction with native ETH."
                  : `${selectedPaymentAsset.symbol} agreements require approve, then fund. You still need ETH for gas.`}
              </p>
              {selectedPaymentAsset.kind === "erc20" && !factoryV2Configured && !factoryV3Configured && (
                <div className="validation-errors">
                  Configure <code>VITE_DEALLOCK_FACTORY_V3_*</code> or <code>VITE_DEALLOCK_FACTORY_V2_*</code> for this network before deploying ERC-20 agreements.
                </div>
              )}
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">Milestones (on-chain)</h3>
          <div className="field">
            {milestones.map((m, i) => (
              <div key={i} className="milestone-editor-card">
                <div className="milestone-form-header">
                  <span className="milestone-form-header-left">
                    <span className="milestone-index">{i}</span>
                    <span>Milestone {i}</span>
                  </span>
                  {milestones.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => removeMilestone(i)}
                      disabled={busy}
                      title="Remove this milestone"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="milestone-field-row">
                  <input
                    type="text"
                    placeholder="Description (stored on-chain)"
                    value={m.description}
                    onChange={(e) => updateMilestone(i, "description", e.target.value)}
                    disabled={busy}
                  />
                  <input
                    type="number"
                    placeholder={`Amount (${selectedPaymentAsset.symbol})`}
                    step={selectedPaymentAsset.decimals === 6 ? "0.01" : "0.001"}
                    min="0"
                    value={m.amount}
                    onChange={(e) => updateMilestone(i, "amount", e.target.value)}
                    disabled={busy}
                  />
                  <input
                    type="datetime-local"
                    value={m.deadline}
                    onChange={(e) => updateMilestone(i, "deadline", e.target.value)}
                    disabled={busy}
                  />
                </div>
                <div className="milestone-note-field">
                  <label className="label">Off-chain note (UI only)</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. evidence you plan to attach (link, repo, screenshots)"
                    value={m.note}
                    onChange={(e) => updateMilestone(i, "note", e.target.value)}
                    disabled={busy}
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={addMilestone}
              disabled={busy}
            >
              + Add milestone
            </button>
          </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">Off-chain guidance</h3>
          <div className="field">
            <label className="label">Evidence guidance</label>
            <textarea
              rows={3}
              placeholder="What links, hashes, or CIDs you expect per milestone"
              value={evidenceGuidance}
              onChange={(e) => setEvidenceGuidance(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="field">
            <label className="label">Acceptance guidance</label>
            <textarea
              rows={3}
              placeholder="How the client should verify before approving on-chain"
              value={acceptanceGuidance}
              onChange={(e) => setAcceptanceGuidance(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="field">
            <label className="label">Dispute / scope note</label>
            <textarea
              rows={2}
              placeholder="What the contract does NOT decide"
              value={disputeBoundaryNote}
              onChange={(e) => setDisputeBoundaryNote(e.target.value)}
              disabled={busy}
            />
          </div>
          </div>

          {errors.length > 0 && (
            <div className="validation-errors">
              {errors.map((e, idx) => (
                <div key={idx}>{e}</div>
              ))}
            </div>
          )}

          <button type="button" className="btn btn-primary btn-lg btn-block deploy-cta" onClick={handleDeploy} disabled={busy}>
            {busy ? "Deploying…" : `Deploy ${selectedPaymentAsset.symbol} agreement`}
          </button>

          {deployState.status === "pending" && (
            <div className="tx-status tx-pending">Waiting for wallet signature…</div>
          )}
          {deployState.status === "confirming" && (
            <div className="tx-status tx-pending">
              <span>Transaction submitted — waiting for confirmation…</span>
              {(() => {
                const url = explorerTxUrl(chainId, deployState.hash);
                return url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="tx-link">
                    View on Etherscan ↗
                  </a>
                ) : (
                  <code className="mono-sm">{deployState.hash}</code>
                );
              })()}
            </div>
          )}
          {deployState.status === "success" && (
            <div className="deploy-success">
              <div className="deploy-success-badge">Deployed</div>
              <h3 className="deploy-success-title">Agreement is live on-chain</h3>
              <p className="deploy-success-text">
                It is now the active agreement in this workspace. Use the overview and actions below —
                or pick it anytime from <strong>My agreements</strong> in the sidebar.
              </p>
              <div className="deployed-address">
                <code>{deployState.address}</code>
                <button type="button" className="btn btn-secondary btn-sm" onClick={copyAddress}>
                  Copy
                </button>
                {(() => {
                  const url = explorerAddressUrl(chainId, deployState.address);
                  return url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                      Etherscan ↗
                    </a>
                  ) : null;
                })()}
              </div>
              {(() => {
                const url = explorerTxUrl(chainId, deployState.hash);
                return url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="tx-link">
                    Deployment tx ↗
                  </a>
                ) : (
                  <code className="mono-sm">{deployState.hash}</code>
                );
              })()}
              <div className="deploy-success-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={scrollToOverview}>
                  Jump to agreement overview
                </button>
              </div>
            </div>
          )}
          {deployState.status === "error" && (
            <div className="tx-status tx-error">{deployState.message}</div>
          )}
        </>
      )}
    </section>
  );
}
