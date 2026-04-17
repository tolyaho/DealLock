import { useEffect, useMemo, useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { type Address } from "viem";
import { DEALLOCK_ABI } from "../contract.ts";
import { type MilestoneData, type Role, formatEth } from "../types.ts";
import { explorerTxUrl, isSupportedChain } from "../network.ts";

interface Props {
  contractAddress: Address;
  role: Role;
  agreementState?: number;
  totalAmount?: bigint;
  milestones: MilestoneData[];
  onSuccess: () => Promise<void>;
}

type TxState =
  | { status: "idle" }
  | { status: "pending"; label: string }
  | { status: "confirming"; hash: `0x${string}`; label: string }
  | { status: "success"; hash: `0x${string}` }
  | { status: "error"; message: string };

function TxLink({ hash, chainId }: { hash: string; chainId: number }) {
  const url = explorerTxUrl(chainId, hash);
  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="tx-link">
        View on Etherscan ↗
      </a>
    );
  }
  return <code className="mono-sm">{hash}</code>;
}

export default function ActionPanel({
  contractAddress,
  role,
  agreementState,
  totalAmount,
  milestones,
  onSuccess,
}: Props) {
  const chainId = useChainId();
  const [txState, setTxState] = useState<TxState>({ status: "idle" });
  const [proofInput, setProofInput] = useState("");
  const [milestoneIdInput, setMilestoneIdInput] = useState("0");

  const { writeContractAsync } = useWriteContract();

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txState.status === "confirming" ? txState.hash : undefined,
    query: { enabled: txState.status === "confirming" },
  });

  const chainOk = isSupportedChain(chainId);
  const isClient = role === "client";
  const isProvider = role === "provider";
  const disabled = isConfirming || !chainOk;

  // Auto-pick the next pending milestone for the submit form
  const nextPendingIdx = useMemo(
    () => milestones.findIndex((m) => m.state === 0),
    [milestones],
  );
  useEffect(() => {
    if (nextPendingIdx >= 0) {
      setMilestoneIdInput(String(nextPendingIdx));
    }
  }, [nextPendingIdx]);

  async function exec(label: string, fn: () => Promise<`0x${string}`>) {
    setTxState({ status: "pending", label });
    try {
      const hash = await fn();
      setTxState({ status: "confirming", hash, label });
      await waitForHash(hash);
      setTxState({ status: "success", hash });
      await onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTxState({ status: "error", message: msg.slice(0, 220) });
    }
  }

  async function waitForHash(hash: `0x${string}`) {
    const { getPublicClient } = await import("wagmi/actions");
    const { config } = await import("../wagmi.ts");
    const client = getPublicClient(config);
    if (!client) return;
    await client.waitForTransactionReceipt({ hash, timeout: 120_000 });
  }

  const mid = Number(milestoneIdInput) || 0;
  const submittedToApprove = milestones.filter((m) => m.state === 1);
  const expiredToRefund = milestones.filter(
    (m) => m.state === 0 && m.deadline < BigInt(Math.floor(Date.now() / 1000)),
  );

  // Guided empty states — show a "waiting" message when no actions are currently available.
  const showProviderAccept = isProvider && agreementState === 0;
  const showClientFund = isClient && agreementState === 1 && totalAmount !== undefined;
  const showProviderSubmit = isProvider && agreementState === 2;
  const showClientApprove = isClient && agreementState === 2 && submittedToApprove.length > 0;
  const showClientRefund = isClient && agreementState === 2 && expiredToRefund.length > 0;

  const anyAction =
    showProviderAccept || showClientFund || showProviderSubmit || showClientApprove || showClientRefund;

  const waitingMessage = (() => {
    if (!chainOk) return null;
    if (role === "other") return null;
    if (agreementState === 0 && isClient)
      return "Waiting for the provider to accept. You can fund once they do.";
    if (agreementState === 1 && isProvider)
      return "Waiting for the client to fund. Submissions open when escrow is funded.";
    if (agreementState === 2 && isClient && submittedToApprove.length === 0)
      return "Waiting for the provider to submit the next milestone.";
    if (agreementState === 3) return "All milestones released — this agreement is complete.";
    if (agreementState === 4) return "Agreement cancelled.";
    return null;
  })();

  return (
    <section className="surface-card surface-card--pad anim-fade-rise" id="dealock-actions">
      <div className="section-header">
        <h2 className="section-header-title">Actions</h2>
        <span className="section-header-desc">What you can do next</span>
      </div>

      {!chainOk && (
        <div className="action-empty">
          <h3 className="action-empty-title">Switch to Sepolia</h3>
          <p className="action-empty-text">
            Contract calls are disabled on unsupported networks. Use the topbar button to switch.
          </p>
        </div>
      )}

      {chainOk && role === "other" && (
        <div className="action-empty action-empty--viewer">
          <h3 className="action-empty-title">Read-only for this wallet</h3>
          <p className="action-empty-text">
            This wallet is not the client or provider on this agreement. Connect the party wallet to
            sign accept, fund, submit, approve, or refund.
          </p>
        </div>
      )}

      {chainOk && role !== "other" && !anyAction && waitingMessage && (
        <div className="action-waiting">
          <span className="action-waiting-icon" aria-hidden>
            ⏳
          </span>
          <span>{waitingMessage}</span>
        </div>
      )}

      {chainOk && anyAction && (
        <div className="action-stack">
          {showProviderAccept && (
            <div className="action-group action-group--provider">
              <div className="action-group-head">
                <span className="action-group-step">Step 1 · Provider</span>
                <h3>Accept agreement</h3>
                <p>Confirm you accept the milestone terms before the client can fund.</p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={disabled}
                onClick={() =>
                  exec("Accept Agreement", () =>
                    writeContractAsync({
                      address: contractAddress,
                      abi: DEALLOCK_ABI,
                      functionName: "acceptAgreement",
                    }),
                  )
                }
              >
                Accept agreement
              </button>
            </div>
          )}

          {showClientFund && (
            <div className="action-group action-group--client">
              <div className="action-group-head">
                <span className="action-group-step">Step 2 · Client</span>
                <h3>Fund escrow</h3>
                <p>Send the exact on-chain total so milestones can begin.</p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={disabled}
                onClick={() =>
                  exec("Fund Agreement", () =>
                    writeContractAsync({
                      address: contractAddress,
                      abi: DEALLOCK_ABI,
                      functionName: "fundAgreement",
                      value: totalAmount!,
                    }),
                  )
                }
              >
                Fund escrow ({formatEth(totalAmount!)} ETH)
              </button>
            </div>
          )}

          {showProviderSubmit && (
            <div className="action-group action-group--provider">
              <div className="action-group-head">
                <span className="action-group-step">Active · Provider</span>
                <h3>Submit milestone evidence</h3>
                <p>
                  Drop in a repo URL, commit SHA, IPFS CID, or any stable pointer. It will be stored
                  on-chain as the delivery reference.
                </p>
              </div>
              <div className="action-input-row">
                <label className="input-label">
                  Milestone
                  <input
                    type="number"
                    min={0}
                    max={Math.max(0, milestones.length - 1)}
                    value={milestoneIdInput}
                    onChange={(e) => setMilestoneIdInput(e.target.value)}
                    className="input input-narrow"
                  />
                </label>
                <label className="input-label input-label--grow">
                  Evidence
                  <input
                    type="text"
                    value={proofInput}
                    onChange={(e) => setProofInput(e.target.value)}
                    placeholder="https://… · commit SHA · IPFS CID…"
                    className="input"
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-primary action-submit-btn"
                  disabled={disabled || !proofInput.trim()}
                  onClick={() =>
                    exec(`Submit #${mid}`, () =>
                      writeContractAsync({
                        address: contractAddress,
                        abi: DEALLOCK_ABI,
                        functionName: "submitMilestone",
                        args: [BigInt(mid), proofInput.trim()],
                      }),
                    )
                  }
                >
                  Submit
                </button>
              </div>
            </div>
          )}

          {showClientApprove && (
            <div className="action-group action-group--client">
              <div className="action-group-head">
                <span className="action-group-step">Active · Client</span>
                <h3>Approve milestones</h3>
                <p>Release escrow for each milestone after verifying the delivery reference.</p>
              </div>
              <div className="action-chip-row">
                {submittedToApprove.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={disabled}
                    onClick={() =>
                      exec(`Approve #${m.id}`, () =>
                        writeContractAsync({
                          address: contractAddress,
                          abi: DEALLOCK_ABI,
                          functionName: "approveMilestone",
                          args: [BigInt(m.id)],
                        }),
                      )
                    }
                  >
                    Approve #{m.id} ({formatEth(m.amount)} ETH)
                  </button>
                ))}
              </div>
            </div>
          )}

          {showClientRefund && (
            <div className="action-group action-group--danger-zone">
              <div className="action-group-head">
                <span className="action-group-step">Client · Refund</span>
                <h3>Refund expired milestones</h3>
                <p>
                  If a milestone is still pending after its deadline, reclaim that tranche. Refunds
                  release in strict order.
                </p>
              </div>
              <div className="action-chip-row">
                {expiredToRefund.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={disabled}
                    onClick={() =>
                      exec(`Refund #${m.id}`, () =>
                        writeContractAsync({
                          address: contractAddress,
                          abi: DEALLOCK_ABI,
                          functionName: "refundExpiredMilestone",
                          args: [BigInt(m.id)],
                        }),
                      )
                    }
                  >
                    Refund #{m.id} ({formatEth(m.amount)} ETH)
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {txState.status === "pending" && (
        <div className="tx-status tx-pending">Waiting for wallet signature · {txState.label}</div>
      )}
      {txState.status === "confirming" && (
        <div className="tx-status tx-pending">
          <span>Confirming on-chain · {txState.label}</span>
          <TxLink hash={txState.hash} chainId={chainId} />
        </div>
      )}
      {txState.status === "success" && (
        <div className="tx-status tx-success">
          <strong>Confirmed</strong>
          <TxLink hash={txState.hash} chainId={chainId} />
        </div>
      )}
      {txState.status === "error" && <div className="tx-status tx-error">{txState.message}</div>}
    </section>
  );
}
