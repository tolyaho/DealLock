import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  type LinkedWallet,
  type SessionUser,
  fetchSignInNonce,
  verifySignIn,
  logout,
  getMe,
} from "../api/auth.ts";
import { fetchLinkNonce, verifyLinkWallet } from "../api/wallets.ts";
import { ApiError } from "../api/client.ts";

export type SessionStatus = "loading" | "signed-in" | "signed-out";

interface AccountContextValue {
  sessionStatus: SessionStatus;
  user: SessionUser | null;
  wallets: LinkedWallet[];
  signIn: (
    address: string,
    chainId: number,
    signFn: (msg: string) => Promise<string>,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  linkWallet: (
    address: string,
    chainId: number,
    label: string,
    signFn: (msg: string) => Promise<string>,
  ) => Promise<void>;
  refreshSession: () => Promise<void>;
  setWallets: (wallets: LinkedWallet[]) => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [wallets, setWallets] = useState<LinkedWallet[]>([]);

  const refreshSession = useCallback(async () => {
    try {
      const data = await getMe();
      setUser(data.user);
      setWallets(data.wallets);
      setSessionStatus("signed-in");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setSessionStatus("signed-out");
      } else {
        // Backend unreachable — treat as signed out so the app still works
        setSessionStatus("signed-out");
      }
      setUser(null);
      setWallets([]);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const signIn = useCallback(
    async (address: string, chainId: number, signFn: (msg: string) => Promise<string>) => {
      const { message, nonceId } = await fetchSignInNonce(address, chainId);
      const signature = await signFn(message);
      const result = await verifySignIn(address, nonceId, signature);
      setUser(result.user);
      setWallets(result.wallets);
      setSessionStatus("signed-in");
    },
    [],
  );

  const signOut = useCallback(async () => {
    await logout();
    setSessionStatus("signed-out");
    setUser(null);
    setWallets([]);
  }, []);

  const linkWallet = useCallback(
    async (
      address: string,
      chainId: number,
      label: string,
      signFn: (msg: string) => Promise<string>,
    ) => {
      const result = await fetchLinkNonce(address, chainId);
      if (result.alreadyLinked) return;
      const signature = await signFn(result.message);
      const verified = await verifyLinkWallet(address, result.nonceId, signature, label);
      setWallets(verified.wallets);
    },
    [],
  );

  return (
    <AccountContext.Provider
      value={{ sessionStatus, user, wallets, signIn, signOut, linkWallet, refreshSession, setWallets }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccountContext(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccountContext must be used inside <AccountProvider>");
  return ctx;
}
