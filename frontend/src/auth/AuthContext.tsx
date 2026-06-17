/*
 * AuthContext — the single source of truth for DealLock's session state.
 *
 * DealLock auth is wallet-first and the three states fall straight out of
 * GET /auth/me:
 *   anonymous — no session
 *   wallet    — wallet signed in, but email not yet verified
 *   verified  — wallet + verified email (fully onboarded)
 *
 * The provider lives inside WagmiProvider (it reads the connected account and
 * signs through wagmi) and inside the Router (it watches the URL for the
 * `?verifyEmail=` deep link the verification email points at — /app?verifyEmail=…
 * — and confirms it against the current session, then strips the param).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { sepolia } from "wagmi/chains";
import { api, ApiError, type NonceResponse, type SessionResponse, type SessionUser, type WalletRecord } from "./api";

export type AuthStatus = "loading" | "anonymous" | "wallet" | "verified";

interface AuthValue {
  status: AuthStatus;
  user: SessionUser | null;
  wallets: WalletRecord[];
  /** Has a backend session (wallet signed in), regardless of email state. */
  isAuthenticated: boolean;
  /** Re-read GET /auth/me. */
  refresh: () => Promise<void>;
  /** SIWE: nonce → wallet signature → verify. Requires a connected wallet. */
  signIn: () => Promise<void>;
  /** Send a verification link to `email` (completed by the link in the inbox). */
  startEmail: (email: string) => Promise<void>;
  /** End the session and disconnect the wallet. */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [ready, setReady] = useState(false);

  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnectAsync } = useDisconnect();
  const [searchParams, setSearchParams] = useSearchParams();

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<SessionResponse>("/auth/me");
      setUser(data.user);
      setWallets(data.wallets);
    } catch {
      // 401 (no session) or the backend being unreachable both mean "anonymous"
      // here — never let it throw, so the landing page is unaffected.
      setUser(null);
      setWallets([]);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async () => {
    if (!isConnected || !address) {
      throw new ApiError(0, "Connect a wallet first.");
    }
    const { message, nonceId } = await api.post<NonceResponse>("/auth/nonce", {
      address,
      chainId: chainId ?? sepolia.id,
    });
    const signature = await signMessageAsync({ message });
    const data = await api.post<SessionResponse>("/auth/verify", { address, nonceId, signature });
    setUser(data.user);
    setWallets(data.wallets);
  }, [address, chainId, isConnected, signMessageAsync]);

  const startEmail = useCallback(async (email: string) => {
    await api.post("/email/start-verification", { email });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore — clearing local state below is what matters */
    }
    try {
      await disconnectAsync();
    } catch {
      /* wallet may already be disconnected */
    }
    setUser(null);
    setWallets([]);
  }, [disconnectAsync]);

  // Email verification deep link: the email links to /app?verifyEmail=<token>.
  // It's session-bound (same browser that requested it), so confirm against the
  // current session, then remove the param so a reload doesn't re-fire it.
  const handledToken = useRef<string | null>(null);
  useEffect(() => {
    const token = searchParams.get("verifyEmail");
    if (!token || handledToken.current === token) return;
    handledToken.current = token;
    void api
      .post("/email/confirm", { token })
      .then(() => refresh())
      .catch(() => {
        // Invalid/expired tokens (or a missing session) are non-fatal — the user
        // can request a fresh link from the signup flow.
      })
      .finally(() => {
        const next = new URLSearchParams(searchParams);
        next.delete("verifyEmail");
        setSearchParams(next, { replace: true });
      });
  }, [searchParams, setSearchParams, refresh]);

  const status: AuthStatus = !ready
    ? "loading"
    : !user
      ? "anonymous"
      : user.emailVerifiedAt
        ? "verified"
        : "wallet";

  const value: AuthValue = {
    status,
    user,
    wallets,
    isAuthenticated: Boolean(user),
    refresh,
    signIn,
    startEmail,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
