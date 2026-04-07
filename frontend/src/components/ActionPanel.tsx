import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { type Address } from "viem";
import { DEALLOCK_ABI } from "../contract.ts";
import { type MilestoneData, type Role } from "../types.ts";
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
    query: {
      enabled: txState.status === "confirming",
    },
  });

  const chainOk = isSupportedChain(chainId);

  async function exec(
    label: string,
    fn: () => Promise<`0x${string}`>,
  ) {
    setTxState({ status: "pending", label });
    try {
      const hash = await fn();
      setTxState({ status: "confirming", hash, label });
      await waitForHash(hash);
      setTxState({ status: "success", hash });
      await onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTxState({ status: "error", message: msg.slice(0, 200) });
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
  const isClient = role === "client";
  const isProvider = role === "provider";
  const disabled = isConfirming || !chainOk;

  return (
    <section className="card">
      <div className="card-header">
        <span className="card-title">Actions</span>
      </div>

      {!chainOk && (
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">Wrong network</div>
          <p className="empty-state-text">Switch to Sepolia to interact with the contract.</p>
        </div>
      )}

      {chainOk && role === "other" && (
        <div className="empty-state">
          <div className="empty-state-icon">👤</div>
          <div className="empty-state-title">Not a participant</div>
          <p className="empty-state-text">Connect as the client or provider to interact.</p>
        </div>
      )}

      {/* Provider: Accept Agreement */}
      {isProvider && agreementState === 0 && (
        <div className="action-section">
          <h3>Accept Agreement</h3>
          <p className="action-hint">Review the terms and accept to allow funding.</p>
          <button
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
            Accept Agreement
          </button>
        </div>
      )}

      {/* Client: Fund Agreement */}
      {isClient && agreementState === 1 && totalAmount !== undefined && (
        <div className="action-section">
          <h3>Fund Agreement</h3>
          <p className="action-hint">Send the exact total amount to lock funds in escrow.</p>
          <button
            className="btn btn-primary"
            disabled={disabled}
            onClick={() =>
              exec("Fund Agreement", () =>
                writeContractAsync({
                  address: contractAddress,
                  abi: DEALLOCK_ABI,
                  functionName: "fundAgreement",
                  value: totalAmount,
                }),
              )
            }
          >
            Fund ({Number(totalAmount) / 1e18} ETH)
          </button>
        </div>
      )}

      {/* Provider: Submit Milestone */}
      {isProvider && agreementState === 2 && (
        <div className="action-section">
          <h3>Submit Milestone Evidence</h3>
          <p className="action-hint">
            Provide a non-empty delivery reference: repo link, commit hash, Figma URL, IPFS CID, etc.
          </p>
          <div className="action-row">
            <input
              type="number"
              min={0}
              max={milestones.length - 1}
              value={milestoneIdInput}
              onChange={(e) => setMilestoneIdInput(e.target.value)}
              placeholder="Milestone #"
            />
            <input
              type="text"
              value={proofInput}
              onChange={(e) => setProofInput(e.target.value)}
              placeholder="Delivery evidence (link, hash, CID…)"
              style={{ maxWidth: "none", flex: 1 }}
            />
            <button
              className="btn btn-primary"
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

      {/* Client: Approve Milestone */}
      {isClient && agreementState === 2 && (
        <div className="action-section">
          <h3>Approve Milestone</h3>
          <p className="action-hint">Release funds for submitted milestones.</p>
          <div className="action-row">
            {milestones
              .filter((m) => m.state === 1)
              .map((m) => (
                <button
                  key={m.id}
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
                  Approve #{m.id}
                </button>
              ))}
            {milestones.filter((m) => m.state === 1).length === 0 && (
              <span className="text-dim text-sm">No submitted milestones to approve</span>
            )}
          </div>
        </div>
      )}

      {/* Client: Refund Expired */}
      {isClient && agreementState === 2 && (
        <div className="action-section">
          <h3>Refund Expired Milestone</h3>
          <p className="action-hint">Reclaim funds for milestones past their deadline.</p>
          <div className="action-row">
            {milestones
              .filter(
                (m) =>
                  m.state === 0 &&
                  m.deadline < BigInt(Math.floor(Date.now() / 1000)),
              )
              .map((m) => (
                <button
                  key={m.id}
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
                  Refund #{m.id}
                </button>
              ))}
            {milestones.filter(
              (m) =>
                m.state === 0 &&
                m.deadline < BigInt(Math.floor(Date.now() / 1000)),
            ).length === 0 && (
              <span className="text-dim text-sm">No expired milestones</span>
            )}
          </div>
        </div>
      )}

      {/* Transaction status */}
      {txState.status === "pending" && (
        <div className="tx-status tx-pending">
          Waiting for wallet signature: {txState.label}…
        </div>
      )}
      {txState.status === "confirming" && (
        <div className="tx-status tx-pending">
          <span>Submitted — waiting for confirmation: {txState.label}…</span>
          <TxLink hash={txState.hash} chainId={chainId} />
        </div>
      )}
      {txState.status === "success" && (
        <div className="tx-status tx-success">
          <strong>Transaction confirmed!</strong>
          <TxLink hash={txState.hash} chainId={chainId} />
        </div>
      )}
      {txState.status === "error" && (
        <div className="tx-status tx-error">{txState.message}</div>
      )}
    </section>
  );
}
