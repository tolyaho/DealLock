/*
 * Wallet — linked wallets, signing authority, and payment readiness (ships next
 * phase). No filters until there's history; the stage leads with connecting a
 * wallet. The Connect/Manage actions are intentionally not wired yet.
 */
import { EmptyStatePage, SplineObject } from "../../components/app";
import { IconLink } from "../../components/app/icons";
import { SPLINE_SCENES } from "../../splineScenes";

export default function WalletPage() {
  return (
    <EmptyStatePage
      title="Wallet"
      subtitle="Manage linked wallets, signing authority, and payment readiness."
      splineType="wallet"
      object={<SplineObject scene={SPLINE_SCENES.wallet} scale={1.12} zoomOut={0.72} />}
      emptyTitle="No wallet activity yet"
      emptyDescription="Linked wallets, escrow actions, and signing status will appear here. DealLock settles in ETH and the USDC you configure — blockchain reads stay the source of truth."
      primaryAction={{ label: "Connect wallet", icon: <IconLink /> }}
      secondaryAction={{ label: "Manage linked wallets" }}
    />
  );
}
