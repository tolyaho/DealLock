export default function ContractVaultCard() {
  return (
    <div className="vault-shell" aria-hidden="true">
      <div className="vault-rail vault-rail--top">
        <span>Client locks</span>
        <i />
        <span>Provider submits</span>
      </div>

      <div className="vault-card">
        <div className="vault-card__header">
          <span className="vault-card__label">Agreement DL-2048</span>
          <span className="vault-state-pill">Funds locked</span>
        </div>

        <div className="vault-asset-row">
          <span className="vault-asset-pill vault-asset-pill--eth">ETH</span>
          <span className="vault-asset-pill vault-asset-pill--erc20">USDC</span>
          <span className="vault-fee-pill">No DealLock fee</span>
        </div>

        <div className="vault-balance">
          <span>Agreement balance</span>
          <strong>3,800.00 USDC</strong>
          <small>Held in the agreement, not by DealLock</small>
        </div>

        <div className="vault-capsules">
          <div className="vault-capsule vault-capsule--released">
            <span className="vault-capsule__id">MIL-01</span>
            <span className="vault-capsule__title">Released</span>
            <span className="vault-capsule__amount">1,200</span>
          </div>
          <div className="vault-capsule vault-capsule--submitted">
            <span className="vault-capsule__id">MIL-02</span>
            <span className="vault-capsule__title">Submitted</span>
            <span className="vault-capsule__amount">1,700</span>
          </div>
          <div className="vault-capsule vault-capsule--active">
            <span className="vault-capsule__id">MIL-03</span>
            <span className="vault-capsule__title">Active</span>
            <span className="vault-capsule__amount">900</span>
          </div>
        </div>

        <div className="vault-state-machine">
          <span className="vault-state-machine__node vault-state-machine__node--client">Lock</span>
          <span className="vault-state-machine__line" />
          <span className="vault-state-machine__node vault-state-machine__node--provider">Submit</span>
          <span className="vault-state-machine__line vault-state-machine__line--pending" />
          <span className="vault-state-machine__node vault-state-machine__node--release">Release</span>
        </div>

        <div className="vault-action-row">
          <span>Approved wallet actions</span>
          <div>
            <b>Approve</b>
            <b>Revise</b>
            <b>Dispute</b>
          </div>
        </div>

        <div className="vault-audit">
          <div>
            <span>Block 6,912,044</span>
            <strong>Proof submitted</strong>
            <code>tx 0x8c4a...71c</code>
          </div>
          <div>
            <span>12 conf</span>
            <strong>Awaiting client approval</strong>
            <code>contract state submitted</code>
          </div>
        </div>
      </div>

      <div className="vault-seal vault-seal--client">No platform custody</div>
      <div className="vault-seal vault-seal--provider">Wallet authority</div>
    </div>
  );
}
