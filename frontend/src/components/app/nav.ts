/*
 * Sidebar navigation config — the single source for the app's primary nav.
 * Grouped (moodboard: Mercury sectioned sidebar). Add/route here; the Sidebar
 * renders from this. `dot` = a champagne attention marker (mock for now).
 */
import type { ComponentType, SVGProps } from "react";
import {
  IconActivity,
  IconAgreements,
  IconCounterparties,
  IconDiamond,
  IconHome,
  IconMessages,
  IconSettings,
  IconStatistics,
  IconWallet,
} from "./icons";

export interface NavItem {
  to: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  dot?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { to: "/app/home", label: "Home", Icon: IconHome },
      { to: "/app/agreements", label: "Agreements", Icon: IconAgreements, dot: true },
      { to: "/app/activity", label: "Activity", Icon: IconActivity },
    ],
  },
  {
    label: "Network",
    items: [
      { to: "/app/counterparties", label: "Counterparties", Icon: IconCounterparties },
      { to: "/app/messages", label: "Messages", Icon: IconMessages },
    ],
  },
  {
    label: "Insights",
    items: [{ to: "/app/statistics", label: "Statistics", Icon: IconStatistics }],
  },
];

export const NAV_FOOTER: NavItem[] = [
  { to: "/app/wallet", label: "Wallet", Icon: IconWallet },
  { to: "/app/settings", label: "Settings", Icon: IconSettings },
  { to: "/app/design-lab", label: "Design lab", Icon: IconDiamond },
];
