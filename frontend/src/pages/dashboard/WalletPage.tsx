/* Wallet / payment preferences. Shows the linked payout wallet, mock balances,
 * and the registry-backed supported assets (ETH + configured USDC only — no
 * arbitrary token entry). Connect/withdraw are disabled until wired. */
import { PageContent } from "../../components/dashboard/Page";
import PageHeader from "../../components/dashboard/PageHeader";
import { Avatar, Button, SectionCard } from "../../components/dashboard/primitives";
import { formatMoney } from "../../fixtures/format";
import {
  IconCheck,
  IconDiamond,
  IconDollar,
  IconLink,
  IconLock,
} from "../../components/dashboard/icons";

const SUPPORTED = [
  { symbol: "ETH", name: "Ether", network: "Ethereum · Sepolia", decimals: 18, Icon: IconDiamond },
  { symbol: "USDC", name: "USD Coin", network: "Ethereum · Sepolia", decimals: 6, Icon: IconDollar },
];

export default function WalletPage() {
  return (
    <PageContent>
      <PageHeader
        title="Wallet"
        subtitle="Your linked payout wallet and supported settlement assets."
        actions={<Button variant="secondary" icon={<IconLink />} comingSoon>Connect another wallet</Button>}
      />

      <div className="dl-grid dl-grid--hero">
        <SectionCard label="Linked wallet">
          <div className="dl-row" style={{ padding: "4px 0", borderBottom: 0 }}>
            <Avatar initials="Ξ" size="lg" metal />
            <span className="dl-row__body">
              <span className="dl-table__name" style={{ gap: 8 }}>
                <span className="dl-row__title" style={{ fontSize: 15 }}>Ethereum wallet</span>
                <span className="dl-pill dl-pill--approved"><span className="dl-pill__dot" />Connected</span>
              </span>
              <span className="dl-row__sub">0x8f3a·······7f90 · Primary payout</span>
            </span>
          </div>
          <div className="dl-divider" />
          <div className="dl-grid dl-grid--2" style={{ gap: 12 }}>
            <div>
              <div className="dl-label">ETH balance</div>
              <div className="dl-stat__value dl-stat__value-sm">{formatMoney({ amount: 4.82, asset: "ETH" })}</div>
            </div>
            <div>
              <div className="dl-label">USDC balance</div>
              <div className="dl-stat__value dl-stat__value-sm">{formatMoney({ amount: 12480, asset: "USDC" })}</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard label="Withdrawable from escrow">
          <div className="dl-stat__value">{formatMoney({ amount: 14800, asset: "USDC" })}</div>
          <p className="dl-stat__meta">Released milestone funds available to withdraw.</p>
          <div style={{ marginTop: "auto", paddingTop: 18 }}>
            <Button variant="primary" icon={<IconLock />} comingSoon block>Withdraw to wallet</Button>
          </div>
        </SectionCard>
      </div>

      <SectionCard label="Supported assets">
        <div className="dl-rows">
          {SUPPORTED.map((a) => (
            <div className="dl-row" key={a.symbol}>
              <span className="dl-row__icon"><a.Icon /></span>
              <span className="dl-row__body">
                <span className="dl-row__title">{a.name} · {a.symbol}</span>
                <span className="dl-row__sub">{a.network} · {a.decimals} decimals</span>
              </span>
              <span className="dl-pill dl-pill--approved"><span className="dl-pill__dot" /><IconCheck /> Registry</span>
            </div>
          ))}
        </div>
        <p className="dl-stat__meta" style={{ marginTop: 14 }}>
          Only assets configured in the escrow registry are available. Arbitrary token addresses are not supported.
        </p>
      </SectionCard>
    </PageContent>
  );
}
