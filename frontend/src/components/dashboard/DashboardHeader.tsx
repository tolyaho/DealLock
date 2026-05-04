import { type ReactNode } from "react";

interface WelcomeHeroProps {
  chainOk: boolean;
  isConnected: boolean;
  children?: ReactNode;
}

export default function WelcomeHero({ chainOk, isConnected, children }: WelcomeHeroProps) {
  if (!isConnected) {
    return (
      <section className="welcome-hero anim-fade-rise">
        <p className="welcome-hero-eyebrow">Testnet beta · Sepolia</p>
        <h1 className="welcome-hero-title">Connect your wallet to begin</h1>
        <p className="welcome-hero-sub">
          DealLock uses your wallet to identify which agreements and actions belong to you.
          Your keys never leave the wallet — DealLock has no custody over your funds.
        </p>
        <div className="welcome-trust-row" aria-label="Trust indicators">
          <span className="welcome-trust-item">No platform custody</span>
          <span className="welcome-trust-sep" aria-hidden>·</span>
          <span className="welcome-trust-item">Wallet-authorized actions only</span>
          <span className="welcome-trust-sep" aria-hidden>·</span>
          <span className="welcome-trust-item">No platform fees</span>
        </div>
        {children}
      </section>
    );
  }

  if (!chainOk) {
    return (
      <section className="welcome-hero anim-fade-rise">
        <p className="welcome-hero-eyebrow">Wrong network</p>
        <h1 className="welcome-hero-title">Switch to Sepolia to continue</h1>
        <p className="welcome-hero-sub">
          DealLock runs on Sepolia testnet (chain 11155111) or a local Hardhat fork. Switch your
          wallet to Sepolia to create or interact with agreements.
        </p>
        {children}
      </section>
    );
  }

  return (
    <section className="welcome-hero anim-fade-rise">
      <p className="welcome-hero-eyebrow">Milestone escrow · Sepolia testnet</p>
      <h1 className="welcome-hero-title">Your agreement workspace</h1>
      <p className="welcome-hero-sub">
        Create a milestone escrow as the client, or open an existing agreement by contract
        address. Funds stay in the agreement contract — DealLock has no custody.
      </p>
      {children}
    </section>
  );
}
