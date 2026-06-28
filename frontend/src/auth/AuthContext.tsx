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
  /** The REAL backend session status (source of truth — never affected by the dev bypass). */
  status: AuthStatus;
  /**
   * The status route guards & redirects should consume. Identical to `status`, EXCEPT
   * the temporary dev bypass can promote a wallet-only session to "verified" for the
   * FRONTEND shell only (see `devBypassEmailVerification`). The backend `requireVerified`
   * middleware is untouched, so product APIs still require real email verification.
   */
  gateStatus: AuthStatus;
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
  /** Persist the user's display name (first + last); refreshes session state. */
  updateProfile: (firstName: string, lastName: string) => Promise<void>;
  /** End the session and disconnect the wallet. */
  logout: () => Promise<void>;
  /**
   * TEMPORARY DEV-ONLY: mark the FRONTEND email step as complete so a wallet-only
   * session can reach the /app shell during local development. See the DEV BYPASS
   * block below — this does NOT verify the email server-side.
   */
  devBypassEmailVerification: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

/* ─────────────────────────────────────────────────────────────────────────────
 * ⚠ TEMPORARY DEV-ONLY EMAIL-VERIFICATION BYPASS ⚠
 * ---------------------------------------------------------------------------
 * The backend `requireVerified` middleware still gates EVERY product route, so this
 * flag ONLY unlocks the FRONTEND /app shell for local development — it does NOT make
 * product APIs succeed and is NOT production-secure. It exists so we can build and
 * preview the dashboard before the real email-code verification UI is wired up.
 *
 * It is deliberately isolated here (and consumed only via `gateStatus`) so it can be
 * deleted in one place. It is sessionStorage-backed (clears when the tab closes) to
 * reinforce that it is throwaway dev state, never a real verification.
 *
 * TODO(auth): remove this block, `devBypassEmailVerification`, and VerifyEmailPage's
 * code step once real email verification is wired to POST /email/confirm. Until then
 * the dev bypass only reveals the UI — backend product calls will 403 without a real
 * verified email.
 * ──────────────────────────────────────────────────────────────────────────── */
const DEV_EMAIL_BYPASS_KEY = "deallock.devEmailBypass";

function readDevEmailBypass(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(DEV_EMAIL_BYPASS_KEY) === "1";
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [ready, setReady] = useState(false);
  // TEMPORARY dev-only email bypass (see the DEV BYPASS block above).
  const [devEmailBypass, setDevEmailBypass] = useState(readDevEmailBypass);

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

  const updateProfile = useCallback(async (firstName: string, lastName: string) => {
    const data = await api.patch<SessionResponse>("/profile", { firstName, lastName });
    setUser(data.user);
    setWallets(data.wallets);
  }, []);

  // TEMPORARY dev-only: flip the frontend-shell bypass on (persist for the tab).
  // Replace with real email verification — this never touches the backend session.
  const devBypassEmailVerification = useCallback(() => {
    setDevEmailBypass(true);
    try {
      window.sessionStorage.setItem(DEV_EMAIL_BYPASS_KEY, "1");
    } catch {
      /* sessionStorage unavailable — the in-memory flag still applies for this tab */
    }
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
    // Drop the dev bypass on logout so the next (possibly different) wallet starts clean.
    setDevEmailBypass(false);
    try {
      window.sessionStorage.removeItem(DEV_EMAIL_BYPASS_KEY);
    } catch {
      /* ignore */
    }
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

  // gateStatus = what the route guards/redirects use. It only ever PROMOTES a
  // wallet-only session to "verified" via the temporary dev bypass; it can never
  // upgrade an anonymous/loading session, so an expired/missing session still
  // correctly redirects to /login even with the bypass flag set.
  const gateStatus: AuthStatus =
    status === "wallet" && devEmailBypass ? "verified" : status;

  const value: AuthValue = {
    status,
    gateStatus,
    user,
    wallets,
    isAuthenticated: Boolean(user),
    refresh,
    signIn,
    startEmail,
    updateProfile,
    logout,
    devBypassEmailVerification,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
