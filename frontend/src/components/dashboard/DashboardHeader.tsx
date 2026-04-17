import { type ReactNode } from "react";

interface WelcomeHeroProps {
  chainOk: boolean;
  isConnected: boolean;
  children?: ReactNode;
}

/**
 * Welcome hero — shown only when no active agreement is selected.
 * Active-agreement chrome is owned by `WorkspaceHeader`.
 */
export default function WelcomeHero({ chainOk, isConnected, children }: WelcomeHeroProps) {
  let headline = "Your escrow workspace";
  let sub =
    "Create a new milestone escrow on Sepolia, or open one you already have access to. Everything is client-side — your keys never leave the wallet.";

  if (!isConnected) {
    headline = "Connect your wallet to begin";
    sub =
      "DealLock is a client-only Sepolia demo. The deploying wallet becomes the on-chain client for any agreement it creates.";
  } else if (!chainOk) {
    headline = "Switch to Sepolia to continue";
    sub =
      "This demo runs on Sepolia (chain 11155111) or a local Hardhat fork. Contract calls are disabled on other networks.";
  }

  return (
    <section className="welcome-hero anim-fade-rise">
      <p className="welcome-hero-eyebrow">Sepolia · Client-only demo</p>
      <h1 className="welcome-hero-title">{headline}</h1>
      <p className="welcome-hero-sub">{sub}</p>
      {children}
    </section>
  );
}
