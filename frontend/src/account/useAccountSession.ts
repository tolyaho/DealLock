import { useAccountContext } from "./AccountProvider.tsx";

export function useAccountSession() {
  return useAccountContext();
}
