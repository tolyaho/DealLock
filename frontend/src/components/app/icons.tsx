/*
 * One thin-line icon set for the entire dashboard. Geometric, minimal, single
 * stroke weight (1.6), round caps/joins — never filled/cartoonish (STYLE_GUIDE
 * §7). Every icon inherits `currentColor` and sizes to its container (width/
 * height set by CSS), so callers never pass size/color props.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: IconProps) => (
  <Svg {...p}><path d="M4 10.5 12 4l8 6.5" /><path d="M5.5 9.5V19a1 1 0 0 0 1 1H10v-5h4v5h3.5a1 1 0 0 0 1-1V9.5" /></Svg>
);
export const IconAgreements = (p: IconProps) => (
  <Svg {...p}><path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M13 3v5h5" /><path d="M9 13h6M9 17h4" /></Svg>
);
export const IconMilestone = (p: IconProps) => (
  <Svg {...p}><path d="M6 4v16" /><path d="M6 5h10l-2 2.5L16 10H6" /></Svg>
);
export const IconProvider = (p: IconProps) => (
  <Svg {...p}><rect x="3.5" y="7" width="17" height="12" rx="2" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M3.5 12h17" /></Svg>
);
export const IconActivity = (p: IconProps) => (
  <Svg {...p}><path d="M3 12h3l2.5-6 4 13L15 9l1.5 3H21" /></Svg>
);
export const IconMessages = (p: IconProps) => (
  <Svg {...p}><path d="M4 5.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H9l-4 3.5V17H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" /></Svg>
);
export const IconCounterparties = (p: IconProps) => (
  <Svg {...p}><circle cx="9" cy="9" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 6.2a3 3 0 0 1 0 5.6" /><path d="M17.5 19a5.5 5.5 0 0 0-3-4.9" /></Svg>
);
export const IconStatistics = (p: IconProps) => (
  <Svg {...p}><path d="M4 20V4" /><path d="M4 20h16" /><rect x="7.5" y="12" width="3" height="5" rx="0.6" /><rect x="13" y="8" width="3" height="9" rx="0.6" /><rect x="18.5" y="14" width="0" height="0" /></Svg>
);
export const IconSettings = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a1 1 0 0 0 .2 1.1l.1.1a1.5 1.5 0 1 1-2.1 2.1l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V19a1.5 1.5 0 0 1-3 0v-.1a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a1.5 1.5 0 1 1-2.1-2.1l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H5a1.5 1.5 0 0 1 0-3h.1a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a1.5 1.5 0 1 1 2.1-2.1l.1.1a1 1 0 0 0 1.1.2H9a1 1 0 0 0 .6-.9V5a1.5 1.5 0 0 1 3 0v.1a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.5 1.5 0 1 1 2.1 2.1l-.1.1a1 1 0 0 0-.2 1.1V9a1 1 0 0 0 .9.6h.1a1.5 1.5 0 0 1 0 3H19a1 1 0 0 0-.9.6Z" /></Svg>
);
export const IconWallet = (p: IconProps) => (
  <Svg {...p}><rect x="3.5" y="6" width="17" height="13" rx="2.5" /><path d="M3.5 9.5h17" /><circle cx="16.5" cy="13" r="1.1" fill="currentColor" stroke="none" /></Svg>
);
export const IconBell = (p: IconProps) => (
  <Svg {...p}><path d="M6.5 9a5.5 5.5 0 0 1 11 0c0 5 2 6 2 6H4.5s2-1 2-6Z" /><path d="M10 19a2 2 0 0 0 4 0" /></Svg>
);
export const IconSearch = (p: IconProps) => (
  <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.6-3.6" /></Svg>
);
export const IconChevronRight = (p: IconProps) => (<Svg {...p}><path d="m9 5 7 7-7 7" /></Svg>);
export const IconArrowRight = (p: IconProps) => (<Svg {...p}><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></Svg>);
export const IconArrowLeft = (p: IconProps) => (<Svg {...p}><path d="M20 12H5" /><path d="m11 6-6 6 6 6" /></Svg>);
export const IconPlus = (p: IconProps) => (<Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>);
export const IconCheck = (p: IconProps) => (<Svg {...p}><path d="m5 12.5 4.5 4.5L19 7" /></Svg>);
export const IconLock = (p: IconProps) => (
  <Svg {...p}><rect x="5" y="10.5" width="14" height="9.5" rx="2.2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></Svg>
);
export const IconShield = (p: IconProps) => (
  <Svg {...p}><path d="M12 3.5 19 6v5.5c0 4.5-3 7.4-7 9-4-1.6-7-4.5-7-9V6Z" /><path d="m9 12 2 2 4-4" /></Svg>
);
export const IconFile = (p: IconProps) => (
  <Svg {...p}><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M13 3v5h5" /></Svg>
);
export const IconDownload = (p: IconProps) => (<Svg {...p}><path d="M12 4v10" /><path d="m8 11 4 4 4-4" /><path d="M5 19h14" /></Svg>);
export const IconUpload = (p: IconProps) => (<Svg {...p}><path d="M12 15V5" /><path d="m8 8 4-4 4 4" /><path d="M5 19h14" /></Svg>);
export const IconRevision = (p: IconProps) => (
  <Svg {...p}><path d="M4.5 11a7.5 7.5 0 0 1 12.8-4.3L20 9" /><path d="M20 4v5h-5" /><path d="M19.5 13a7.5 7.5 0 0 1-12.8 4.3L4 15" /><path d="M4 20v-5h5" /></Svg>
);
export const IconFilter = (p: IconProps) => (<Svg {...p}><path d="M4 6h16M7 12h10M10 18h4" /></Svg>);
export const IconCalendar = (p: IconProps) => (
  <Svg {...p}><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M4 9.5h16M8 3.5v4M16 3.5v4" /></Svg>
);
export const IconClock = (p: IconProps) => (<Svg {...p}><circle cx="12" cy="12" r="8" /><path d="M12 8v4.5l3 2" /></Svg>);
export const IconUser = (p: IconProps) => (<Svg {...p}><circle cx="12" cy="8.5" r="3.5" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></Svg>);
export const IconBuilding = (p: IconProps) => (
  <Svg {...p}><rect x="5" y="4" width="14" height="16" rx="1.5" /><path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h6" /></Svg>
);
export const IconMore = (p: IconProps) => (
  <Svg {...p}><circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none" /></Svg>
);
export const IconMenu = (p: IconProps) => (<Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>);
export const IconClose = (p: IconProps) => (<Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>);
export const IconExternal = (p: IconProps) => (
  <Svg {...p}><path d="M14 5h5v5" /><path d="M19 5l-7 7" /><path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></Svg>
);
export const IconEdit = (p: IconProps) => (
  <Svg {...p}><path d="M5 19h14" /><path d="M14 5.5 18.5 10 8.5 20H4v-4.5Z" /></Svg>
);
export const IconClient = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></Svg>
);
export const IconDiamond = (p: IconProps) => (
  <Svg {...p}><path d="M6 4h12l3 5-9 11L3 9Z" /><path d="M3 9h18M9 4 7.5 9 12 20M15 4l1.5 5L12 20" /></Svg>
);
export const IconLink = (p: IconProps) => (
  <Svg {...p}><path d="M9.5 14.5 14.5 9.5" /><path d="M11 7.5 12.8 5.7a3.4 3.4 0 0 1 4.8 4.8L15.8 12.3" /><path d="M13 16.5l-1.8 1.8a3.4 3.4 0 0 1-4.8-4.8L8.2 11.7" /></Svg>
);
export const IconSend = (p: IconProps) => (<Svg {...p}><path d="M20 4 3.5 11l6.5 2.5L12.5 20 20 4Z" /><path d="m10 13.5 4-5" /></Svg>);
export const IconDollar = (p: IconProps) => (<Svg {...p}><path d="M12 4v16" /><path d="M15.5 7.5A3 3 0 0 0 12.5 6h-1a2.5 2.5 0 0 0 0 5h1a2.5 2.5 0 0 1 0 5h-1A3 3 0 0 1 8.5 14.5" /></Svg>);
export const IconImage = (p: IconProps) => (
  <Svg {...p}><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m5 18 4.5-4.5L13 17l3-3 3 3" /></Svg>
);
export const IconGlobe = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4c2.5 2.2 2.5 13.8 0 16M12 4c-2.5 2.2-2.5 13.8 0 16" /></Svg>
);
export const IconBolt = (p: IconProps) => (<Svg {...p}><path d="M13 3 5 13h5l-1 8 8-10h-5l1-8Z" /></Svg>);
