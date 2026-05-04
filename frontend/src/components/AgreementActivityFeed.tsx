import { shortAddress } from "../types.ts";
import { explorerTxUrl } from "../network.ts";
import type { ActivityEvent } from "../api/activity.ts";
import { formatAssetAmount, type PaymentAsset } from "../tokens.ts";

interface Props {
  events: ActivityEvent[];
  loading: boolean;
  error: string | null;
  chainId: number;
  signedIn: boolean;
  paymentAsset: PaymentAsset;
}

const EVENT_LABELS: Record<string, { label: string; icon: string; description?: string }> = {
  AgreementAccepted:          { label: "Agreement accepted",         icon: "AC" },
  AgreementFunded:            { label: "Escrow funded",              icon: "FD" },
  AgreementCancelled:         { label: "Agreement cancelled",        icon: "CN" },
  MilestoneSubmitted:         { label: "Delivery submitted",         icon: "SB" },
  MilestoneApproved:          { label: "Milestone approved",         icon: "AP" },
  MilestoneReleased:          { label: "Funds released",             icon: "RL" },
  MilestoneRefunded:          { label: "Milestone refunded",         icon: "RF" },
  MilestoneDisputed:          { label: "Milestone disputed",         icon: "DP" },
  MilestoneSettled:           { label: "Dispute settled",            icon: "ST" },
  SettlementProposed:         { label: "Settlement proposed",        icon: "PR" },
  SettlementAccepted:         { label: "Settlement accepted",        icon: "SA" },
  RevisionRequested:          { label: "Revision requested",         icon: "RV" },
  RevisionAccepted:           { label: "Provider accepted revision", icon: "RA" },
  RevisionRejected:           { label: "Revision rejected",          icon: "RR" },
  MilestoneRevisionEscalated: { label: "Revision escalated",         icon: "EX" },
  DeadlineExtensionRequested: { label: "Deadline extension requested", icon: "DR" },
  DeadlineExtensionAccepted:  { label: "Deadline extension accepted", icon: "DA" },
  DeadlineExtensionRejected:  { label: "Deadline extension rejected", icon: "DX" },
  AdjustmentRequested:        { label: "Paid adjustment requested",  icon: "AR" },
  AdjustmentAccepted:         { label: "Adjustment accepted",        icon: "AA" },
  AdjustmentFunded:           { label: "Adjustment funded",          icon: "AF" },
  AdjustmentSubmitted:        { label: "Adjustment delivered",       icon: "AS" },
  AdjustmentReleased:         { label: "Adjustment funds released",  icon: "AL" },
  AdjustmentRefunded:         { label: "Adjustment refunded",        icon: "AB" },
};

function eventLabel(name: string): string {
  const mapped = EVENT_LABELS[name];
  if (mapped) return mapped.label;
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function eventIcon(name: string): string {
  return EVENT_LABELS[name]?.icon ?? "EV";
}

function itemLabel(event: ActivityEvent): string | null {
  if (!event.itemType) return null;
  const base = event.itemType[0]!.toUpperCase() + event.itemType.slice(1);
  return event.itemId == null ? base : `${base} #${event.itemId}`;
}

function formatAmount(event: ActivityEvent, fallbackAsset: PaymentAsset): string | null {
  const raw = event.amountRaw ?? event.amountWei;
  if (!raw) return null;
  try {
    const asset: PaymentAsset = {
      kind: event.paymentTokenAddress ? "erc20" : "native",
      chainId: fallbackAsset.chainId,
      address: event.paymentTokenAddress as PaymentAsset["address"],
      symbol: event.paymentSymbol ?? fallbackAsset.symbol,
      name: event.paymentSymbol ?? fallbackAsset.name,
      decimals: event.paymentDecimals ?? fallbackAsset.decimals,
    };
    return formatAssetAmount(BigInt(raw), asset);
  } catch {
    return null;
  }
}

export default function AgreementActivityFeed({ events, loading, error, chainId, signedIn, paymentAsset }: Props) {
  return (
    <section className="surface-card surface-card--pad activity-feed-card anim-fade-rise">
      <div className="section-header">
        <h2 className="section-header-title">Activity</h2>
        <span className="section-header-desc">Indexed contract events for this agreement</span>
      </div>

      {!signedIn && (
        <div className="activity-signin-prompt">
          <div className="activity-signin-icon" aria-hidden>LOCK</div>
          <p className="activity-signin-title">Sign in to view activity</p>
          <p className="activity-signin-text">
            The private activity feed is visible to signed-in accounts whose linked wallets are
            parties to this agreement. Email can notify you, but wallet actions and contract
            state control the agreement.
          </p>
        </div>
      )}

      {signedIn && loading && (
        <div className="activity-loading" role="status" aria-live="polite" aria-label="Loading activity">
          <span className="activity-loading-dot" aria-hidden />
          <span className="activity-loading-dot" aria-hidden />
          <span className="activity-loading-dot" aria-hidden />
          <span>Loading agreement activity...</span>
        </div>
      )}

      {signedIn && error && (
        <div className="banner banner-error" role="alert">
          <div className="banner-content">
            <strong>Could not load activity</strong><br />
            {error}
          </div>
        </div>
      )}

      {signedIn && !loading && !error && events.length === 0 && (
        <div className="empty-state empty-state--compact">
          <div className="empty-state-icon" aria-hidden>EV</div>
          <p className="empty-state-title">No indexed activity yet</p>
          <p className="empty-state-text">
            Contract events appear here after the backend processes this agreement. The contract
            state remains the source of truth while indexing catches up.
          </p>
        </div>
      )}

      {signedIn && events.length > 0 && (
        <div className="activity-feed" role="list" aria-label="Agreement activity">
          {events.map((event) => {
            const txUrl = explorerTxUrl(chainId, event.txHash);
            const amount = formatAmount(event, paymentAsset);
            const item = itemLabel(event);
            const icon = eventIcon(event.eventName);
            return (
              <article className="activity-item" key={event.id} role="listitem">
                <div className="activity-icon" aria-hidden>{icon}</div>
                <div className="activity-main">
                  <div className="activity-title-row">
                    <strong>{eventLabel(event.eventName)}</strong>
                    <span className="activity-time">{new Date(event.occurredAt).toLocaleString()}</span>
                  </div>
                  <div className="activity-meta">
                    {item && <span className="activity-meta-tag">{item}</span>}
                    {amount && <span className="activity-meta-amount">{amount}</span>}
                    {event.actorAddress && (
                      <span className="activity-meta-actor">
                        by {shortAddress(event.actorAddress)}
                      </span>
                    )}
                  </div>
                </div>
                {txUrl ? (
                  <a
                    className="btn btn-sm btn-ghost activity-tx-link"
                    href={txUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View transaction ${event.txHash} on Etherscan`}
                  >
                    Tx
                  </a>
                ) : (
                  <code className="activity-tx mono-sm">{shortAddress(event.txHash)}</code>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
