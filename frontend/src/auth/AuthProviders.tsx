/*
 * AuthProviders — the provider stack the whole app sits inside: wagmi (wallet),
 * TanStack Query (wagmi's required async cache), then DealLock's AuthProvider.
 *
 * Mounted inside <BrowserRouter> in main.tsx because AuthProvider reads the URL
 * (the email verification deep link). It adds no visual surface — the marketing
 * landing renders unchanged underneath it.
 */
import { type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "./wagmi";
import { AuthProvider } from "./AuthContext";

const queryClient = new QueryClient();

export function AuthProviders({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
