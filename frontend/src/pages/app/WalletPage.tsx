/* Wallet (skeleton placeholder) — connected wallets & balances ship next phase. */
import { EmptyState, PageContainer, PageHeader } from "../../components/app";
import { IconWallet } from "../../components/app/icons";

export default function WalletPage() {
  return (
    <PageContainer>
      <PageHeader title="Wallet" subtitle="The addresses you fund and receive escrow with." />
      <EmptyState
        icon={<IconWallet />}
        title="Wallet view coming next"
        text="Connected addresses, balances, and the assets DealLock supports (ETH + configured USDC) will appear here."
      />
    </PageContainer>
  );
}
