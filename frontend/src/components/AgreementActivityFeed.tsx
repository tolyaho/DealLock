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

function eventLabel(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
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
    <section className="surface-card surface-card--pad anim-fade-rise">
      <div className="section-header">
        <h2 className="section-header-title">Activity</h2>
        <span className="section-header-desc">Indexed contract events for this agreement</span>
      </div>

      {!signedIn && (
        <div className="empty-state">
          Sign in to view the private activity feed for agreements linked to your wallets.
        </div>
      )}

      {signedIn && loading && <div className="empty-state">Loading activity…</div>}

      {signedIn && error && <div className="banner banner-error">{error}</div>}

      {signedIn && !loading && !error && events.length === 0 && (
        <div className="empty-state">
          No indexed events yet. Reliable activity appears after the backend indexer runs for this known agreement.
        </div>
      )}

      {signedIn && events.length > 0 && (
        <div className="activity-feed">
          {events.map((event) => {
            const txUrl = explorerTxUrl(chainId, event.txHash);
            const amount = formatAmount(event, paymentAsset);
            return (
              <article className="activity-item" key={event.id}>
                <div className="activity-main">
                  <div className="activity-title-row">
                    <strong>{eventLabel(event.eventName)}</strong>
                    <span>{new Date(event.occurredAt).toLocaleString()}</span>
                  </div>
                  <div className="activity-meta">
                    {itemLabel(event) && <span>{itemLabel(event)}</span>}
                    {amount && <span>{amount}</span>}
                    {event.actorAddress && <span>Actor {shortAddress(event.actorAddress)}</span>}
                    <span>Block {event.blockNumber}</span>
                  </div>
                </div>
                {txUrl ? (
                  <a className="btn btn-sm btn-secondary" href={txUrl} target="_blank" rel="noopener noreferrer">
                    Tx
                  </a>
                ) : (
                  <span className="activity-tx input-mono">{shortAddress(event.txHash)}</span>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
