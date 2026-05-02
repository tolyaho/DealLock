import { useState } from "react";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { useAccountSession } from "../../account/useAccountSession.ts";
import { updateWallet, removeWallet } from "../../api/wallets.ts";
import { shortAddress } from "../../types.ts";
import { ApiError } from "../../api/client.ts";

export default function LinkedWalletsPanel({ onClose }: { onClose: () => void }) {
  const { wallets, setWallets, linkWallet, sessionStatus } = useAccountSession();
  const { address } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();

  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [savingLabel, setSavingLabel] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const currentWalletAlreadyLinked =
    address != null && wallets.some((w) => w.address === address.toLowerCase());

  async function handleLinkCurrentWallet() {
    if (!address) return;
    setLinking(true);
    setLinkError(null);
    try {
      await linkWallet(
        address,
        chainId,
        "Linked wallet",
        (msg) => signMessageAsync({ message: msg }),
      );
    } catch (err) {
      setLinkError(
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Failed to link wallet",
      );
    } finally {
      setLinking(false);
    }
  }

  function startEdit(addr: string, currentLabel: string) {
    setEditingAddress(addr);
    setEditLabel(currentLabel);
    setRemoveError(null);
  }

  async function saveLabel(addr: string) {
    setSavingLabel(true);
    try {
      const result = await updateWallet(addr, { label: editLabel.trim() });
      setWallets(result.wallets);
      setEditingAddress(null);
    } catch {
      // ignore — label save failure is non-critical
    } finally {
      setSavingLabel(false);
    }
  }

  async function handleRemove(addr: string) {
    setRemoveError(null);
    try {
      const result = await removeWallet(addr);
      setWallets(result.wallets);
    } catch (err) {
      setRemoveError(
        err instanceof ApiError ? err.message : "Failed to remove wallet",
      );
    }
  }

  if (sessionStatus !== "signed-in") return null;

  return (
    <div className="linked-wallets-panel">
      <div className="linked-wallets-header">
        <h3 className="linked-wallets-title">Linked wallets</h3>
        <button
          type="button"
          className="btn-icon-bare linked-wallets-close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <ul className="linked-wallets-list">
        {wallets.map((w) => (
          <li key={w.id} className="linked-wallet-row">
            <div className="linked-wallet-info">
              <span className="linked-wallet-addr">
                <code>{shortAddress(w.address)}</code>
                {w.isPrimary && <span className="linked-wallet-primary-badge">Primary</span>}
              </span>
              {editingAddress === w.address ? (
                <div className="linked-wallet-edit-row">
                  <input
                    className="input input-sm"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveLabel(w.address)}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-xs"
                    onClick={() => saveLabel(w.address)}
                    disabled={savingLabel}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => setEditingAddress(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <span className="linked-wallet-label">
                  {w.label || "—"}
                  <button
                    type="button"
                    className="btn-icon-bare linked-wallet-rename"
                    title="Rename"
                    onClick={() => startEdit(w.address, w.label)}
                  >
                    ✎
                  </button>
                </span>
              )}
            </div>
            {!w.isPrimary && wallets.length > 1 && (
              <button
                type="button"
                className="btn btn-ghost btn-xs linked-wallet-remove"
                title="Remove wallet"
                onClick={() => handleRemove(w.address)}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {removeError && <p className="linked-wallets-error">{removeError}</p>}

      {address && !currentWalletAlreadyLinked && (
        <div className="linked-wallets-footer">
          <p className="linked-wallets-hint">
            Connect the wallet you want to add, then click below. Linking only proves ownership —
            no funds are moved.
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleLinkCurrentWallet}
            disabled={linking}
          >
            {linking ? "Signing…" : `Link ${shortAddress(address)}`}
          </button>
          {linkError && <p className="linked-wallets-error">{linkError}</p>}
        </div>
      )}

      {address && currentWalletAlreadyLinked && wallets.length < 10 && (
        <div className="linked-wallets-footer">
          <p className="linked-wallets-hint">
            Switch wallet in MetaMask, then click "Link" to add another.
          </p>
        </div>
      )}
    </div>
  );
}
