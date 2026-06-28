/*
 * useWalletAuth — the connect → sign sequence the auth pages drive, with the
 * pending/error bookkeeping the UI needs. Wallet scope is injected only (see
 * wagmi.ts). `connect` opens the browser wallet; `sign` runs the SIWE handshake
 * (AuthContext.signIn). Errors are mapped to calm, human copy.
 */
import { useCallback, useState } from "react";
import { useAccount, useConnect } from "wagmi";
import { useAuth } from "./AuthContext";
import { ApiError } from "./api";

function describeError(e: unknown): string {
  const message =
    (e as { shortMessage?: string })?.shortMessage ||
    (e as { message?: string })?.message ||
    "";
  if (/user rejected|user denied|rejected the request|\b4001\b/i.test(message)) {
    return "Request was declined in your wallet.";
  }
  if (/connector not found|no injected|getprovider|provider is not defined|window\.ethereum/i.test(message)) {
    return "No browser wallet detected. Install MetaMask or another injected wallet.";
  }
  if (/failed to fetch|networkerror|load failed|fetch/i.test(message)) {
    return "Backend API is not reachable. Make sure the backend is running and VITE_API_URL matches the page origin.";
  }
  if (e instanceof ApiError && e.message) return e.message;
  return "Something went wrong. Please try again.";
}

export function useWalletAuth() {
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending: connecting } = useConnect();
  const { signIn } = useAuth();
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasInjected =
    typeof window !== "undefined" && Boolean((window as { ethereum?: unknown }).ethereum);

  const connect = useCallback(async () => {
    setError(null);
    try {
      const injectedConnector = connectors.find((c) => c.type === "injected") ?? connectors[0];
      if (!injectedConnector) {
        setError("No browser wallet detected. Install MetaMask or another injected wallet.");
        return;
      }
      await connectAsync({ connector: injectedConnector });
    } catch (e) {
      setError(describeError(e));
    }
  }, [connectAsync, connectors]);

  const sign = useCallback(async () => {
    setError(null);
    setSigning(true);
    try {
      await signIn();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSigning(false);
    }
  }, [signIn]);

  return {
    address,
    isConnected,
    connecting,
    signing,
    error,
    hasInjected,
    connect,
    sign,
    clearError: () => setError(null),
  };
}
