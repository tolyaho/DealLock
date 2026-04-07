import { useState } from "react";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import { type Address, parseEther, isAddress, createWalletClient, custom } from "viem";
import { sepolia, hardhat } from "viem/chains";
import { DEALLOCK_ABI } from "../contract.ts";
import { DEALLOCK_BYTECODE } from "../bytecode.ts";
import {
  SERVICE_TEMPLATE_IDS,
  getServiceTemplate,
  type ServiceTemplateId,
} from "../templates.ts";
import { type AgreementMetadataDraft } from "../storage.ts";
import { isSupportedChain, explorerTxUrl, explorerAddressUrl } from "../network.ts";

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
  onDeployed: (address: Address, draft: AgreementMetadataDraft) => void;
}

const initialTemplate = getServiceTemplate("website");

export default function CreateAgreementForm({ onDeployed }: Props) {
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

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
  const [errors, setErrors] = useState<string[]>([]);
  const [deployState, setDeployState] = useState<DeployState>({ status: "idle" });

  const chainOk = isSupportedChain(chainId);

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

    if (!providerAddr.trim() || !isAddress(providerAddr.trim())) {
      errs.push("Provider must be a valid EVM address.");
    }

    if (!projectTitle.trim()) {
      errs.push("Project title is required.");
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

      const amt = parseFloat(m.amount);
      if (isNaN(amt) || amt <= 0) errs.push(`Milestone ${i}: amount must be > 0.`);

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
      const amounts = milestones.map((m) => parseEther(m.amount));
      const deadlines = milestones.map((m) =>
        BigInt(Math.floor(new Date(m.deadline).getTime() / 1000)),
      );

      const hash = await signer.deployContract({
        abi: DEALLOCK_ABI,
        bytecode: DEALLOCK_BYTECODE,
        args: [providerAddr.trim() as Address, descriptions, amounts, deadlines],
      });

      setDeployState({ status: "confirming", hash });

      const { getPublicClient } = await import("wagmi/actions");
      const { config } = await import("../wagmi.ts");
      const publicClient = getPublicClient(config);
      if (!publicClient) throw new Error("No public client available");

      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 120_000,
      });

      if (!receipt.contractAddress) throw new Error("No contract address in receipt");

      const addr = receipt.contractAddress as Address;
      const t = getServiceTemplate(serviceTemplateId);
      const draft: AgreementMetadataDraft = {
        projectTitle: projectTitle.trim(),
        serviceTemplate: serviceTemplateId,
        serviceCategory: t.serviceCategory,
        evidenceGuidance: evidenceGuidance.trim(),
        acceptanceGuidance: acceptanceGuidance.trim(),
        disputeBoundaryNote: disputeBoundaryNote.trim(),
        milestoneNotes: milestones.map((m) => m.note.trim()),
      };

      setDeployState({ status: "success", address: addr, hash });
      onDeployed(addr, draft);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setDeployState({ status: "error", message: msg.slice(0, 300) });
    }
  }

  function copyAddress() {
    if (deployState.status === "success") {
      navigator.clipboard.writeText(deployState.address);
    }
  }

  const busy = deployState.status === "pending" || deployState.status === "confirming";

  return (
    <section className="card">
      <div className="card-header">
        <span className="card-title">Create Agreement</span>
      </div>
      <p className="form-intro">
        Deploy a milestone escrow for <strong>digital freelance deliverables</strong>. Only provider address,
        milestone texts, amounts, and deadlines go on-chain. Titles and guidance are saved locally.
      </p>

      {!isConnected && (
        <div className="empty-state">
          <div className="empty-state-icon">🔗</div>
          <div className="empty-state-title">Connect your wallet</div>
          <p className="empty-state-text">The deploying wallet becomes the client.</p>
        </div>
      )}

      {isConnected && !chainOk && (
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">Wrong network</div>
          <p className="empty-state-text">Switch to Sepolia to deploy an agreement.</p>
        </div>
      )}

      {isConnected && chainOk && (
        <>
          {/* Service template */}
          <div className="field">
            <label className="label">Service Template</label>
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
            <p className="hint">Prefills sample milestones and guidance. Edit anything before deploy.</p>
          </div>

          {/* Project title */}
          <div className="field">
            <label className="label">Project Title</label>
            <input
              type="text"
              placeholder="e.g. Marketing landing v2"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              disabled={busy}
            />
          </div>

          {/* Provider address */}
          <div className="field">
            <label className="label">Provider Address</label>
            <input
              type="text"
              className="input-mono"
              placeholder="0x..."
              value={providerAddr}
              onChange={(e) => setProviderAddr(e.target.value)}
              disabled={busy}
            />
          </div>

          {/* Milestones */}
          <div className="field">
            <label className="label">Milestones (on-chain)</label>
            {milestones.map((m, i) => (
              <div key={i} className="milestone-form-row">
                <div className="milestone-form-header">
                  <span className="flex items-center gap-sm">
                    <span className="milestone-index">{i}</span>
                    <span className="text-sm" style={{ fontWeight: 600 }}>
                      Milestone {i}
                    </span>
                  </span>
                  {milestones.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removeMilestone(i)}
                      disabled={busy}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="milestone-form-fields">
                  <input
                    type="text"
                    placeholder="Description (stored on-chain)"
                    value={m.description}
                    onChange={(e) => updateMilestone(i, "description", e.target.value)}
                    disabled={busy}
                  />
                  <input
                    type="number"
                    placeholder="Amount (ETH)"
                    step="0.001"
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
                  <label className="label label-inline">Off-chain note (shown on milestone cards)</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. what evidence you plan to attach"
                    value={m.note}
                    onChange={(e) => updateMilestone(i, "note", e.target.value)}
                    disabled={busy}
                  />
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={addMilestone} disabled={busy}>
              + Add milestone
            </button>
          </div>

          {/* Guidance fields */}
          <div className="field">
            <label className="label">Evidence Guidance (off-chain)</label>
            <textarea
              rows={3}
              placeholder="What links, hashes, or CIDs you expect per milestone"
              value={evidenceGuidance}
              onChange={(e) => setEvidenceGuidance(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="field">
            <label className="label">Acceptance Guidance (off-chain)</label>
            <textarea
              rows={3}
              placeholder="How the client should verify before approving on-chain"
              value={acceptanceGuidance}
              onChange={(e) => setAcceptanceGuidance(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="field">
            <label className="label">Dispute / Scope Note (off-chain)</label>
            <textarea
              rows={2}
              placeholder="What the contract does NOT decide"
              value={disputeBoundaryNote}
              onChange={(e) => setDisputeBoundaryNote(e.target.value)}
              disabled={busy}
            />
          </div>

          {/* Validation errors */}
          {errors.length > 0 && (
            <div className="validation-errors">
              {errors.map((e, idx) => (
                <div key={idx}>{e}</div>
              ))}
            </div>
          )}

          {/* Deploy button */}
          <button
            className="btn btn-primary btn-lg w-full"
            onClick={handleDeploy}
            disabled={busy}
            style={{ marginTop: "0.5rem" }}
          >
            {busy ? "Deploying…" : "Deploy Agreement"}
          </button>

          {/* Deploy status */}
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
            <div className="tx-status tx-success">
              <strong>Contract deployed!</strong>
              <div className="deployed-address">
                <code>{deployState.address}</code>
                <button type="button" className="btn-icon" onClick={copyAddress}>
                  Copy
                </button>
                {(() => {
                  const url = explorerAddressUrl(chainId, deployState.address);
                  return url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="btn-icon">
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
