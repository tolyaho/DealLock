/*
 * The DealLock app foundation — one import surface for the whole design system.
 * Pages should import from here (`@/components/app`) so the system stays the
 * single way to build screens.
 */

// Shell + layout
export { default as AppShell } from "./AppShell";
export { Sidebar } from "./Sidebar";
export { Topbar } from "./Topbar";
export { WorkspaceSwitch } from "./WorkspaceSwitch";
export { PageContainer } from "./PageContainer";
export { PageHeader } from "./PageHeader";
export { default as MetalSurface } from "./MetalSurface";

// Primitives
export { Button, IconButton, Spinner } from "./Button";
export { MetalCTA } from "./MetalCTA";
export { Card, MetricCard } from "./Card";
export { StatusChip, type ChipTone } from "./StatusChip";
export { SegmentedControl } from "./SegmentedControl";
export { SearchInput } from "./SearchInput";
export { ActionTile } from "./ActionTile";
export { TableShell, type Column } from "./TableShell";
export { EmptyState } from "./EmptyState";
export { SplineObjectSlot, type SplineSlotType } from "./SplineObjectSlot";
export { StatisticsSplineObject } from "./StatisticsSplineObject";
export { EmptyStateStage, type StageAction } from "./EmptyStateStage";
export { PageToolbar } from "./PageToolbar";
export { EmptyStatePage } from "./EmptyStatePage";
export { BottomActionBar } from "./BottomActionBar";
export { Avatar } from "./Avatar";
export { Identity } from "./Identity";
export { Switch } from "./Switch";

// Context
export { WorkspaceProvider, useWorkspace, useRoleConfig } from "./WorkspaceContext";

// Role identity system (one source of truth for role-specific copy)
export { ROLE_CONFIG, roleConfig, type RoleConfig } from "../../fixtures/roleConfig";

// Nav config
export { NAV_GROUPS, NAV_FOOTER, type NavItem, type NavGroup } from "./nav";
