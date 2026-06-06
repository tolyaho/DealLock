/*
 * Design Lab — the internal preview of the whole DealLock foundation. Every
 * token and primitive is shown here so the system can be reviewed in one place
 * before it's applied across the product. Reads like a spec sheet: numbered
 * sections, specimens on a faint satin tray. Not linked from marketing; reachable
 * at /app/design-lab (and from the sidebar footer).
 *
 * Rule for this page: it only *composes* the kit + token-driven classes. No
 * hardcoded colors / sizes / weights inline — anything visual lives in tokens.css
 * / app.css, so the lab is an honest mirror of what real screens can use.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import {
  ActionTile,
  Avatar,
  BottomActionBar,
  Button,
  Card,
  EmptyState,
  Identity,
  IconButton,
  MetalSurface,
  MetricCard,
  PageContainer,
  PageHeader,
  SearchInput,
  SegmentedControl,
  StatusChip,
  Switch,
  TableShell,
  WorkspaceSwitch,
  type Column,
} from "../../components/app";
import {
  IconAgreements,
  IconBell,
  IconBolt,
  IconDollar,
  IconDownload,
  IconLock,
  IconPlus,
  IconSettings,
  IconShield,
  IconUpload,
} from "../../components/app/icons";

const SURFACES = [
  { name: "--surface-card", bg: "var(--surface-card)" },
  { name: "--surface-nested", bg: "var(--surface-nested)" },
  { name: "--surface-sunken", bg: "var(--surface-sunken)" },
  { name: "--surface-inset", bg: "var(--surface-inset)" },
  { name: "--surface-action", bg: "var(--surface-action)" },
  { name: "--surface-primary", bg: "var(--surface-primary)" },
  { name: "--metal-disc", bg: "var(--metal-disc)" },
];
const ACCENTS = [
  { name: "--accent-secure", bg: "var(--accent-secure)" },
  { name: "--accent-review", bg: "var(--accent-review)" },
  { name: "--accent-technical", bg: "var(--accent-technical)" },
  { name: "--accent-danger", bg: "var(--accent-danger)" },
];
const INKS = [
  { name: "--ink", bg: "var(--ink)" },
  { name: "--ink-soft", bg: "var(--ink-soft)" },
  { name: "--ink-muted", bg: "var(--ink-muted)" },
  { name: "--ink-faint", bg: "var(--ink-faint)" },
];

const TABLE_COLS: Column[] = [
  { key: "name", label: "Component" },
  { key: "role", label: "Role" },
  { key: "status", label: "Status", align: "center" },
  { key: "value", label: "Value", align: "right" },
];

function Section({
  idx,
  title,
  caption,
  stage,
  children,
}: {
  idx: string;
  title: string;
  caption?: string;
  stage?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="dl-lab__section">
      <header className="dl-lab__head">
        <span className="dl-lab__idx">{idx}</span>
        <h2 className="dl-lab__section-title">{title}</h2>
        {caption && <span className="dl-lab__caption">{caption}</span>}
      </header>
      {stage ? <div className="dl-lab__stage">{children}</div> : children}
    </section>
  );
}

function Swatch({ name, bg }: { name: string; bg: string }) {
  return (
    <div className="dl-swatch">
      <div className="dl-swatch__chip" style={{ background: bg }} />
      <span className="dl-swatch__name">{name}</span>
    </div>
  );
}

export default function DesignLabPage() {
  const [seg, setSeg] = useState("30d");
  const [search, setSearch] = useState("");
  const [sw, setSw] = useState(true);

  return (
    <PageContainer wide>
      <PageHeader
        eyebrow="Internal · foundation"
        title="Design lab"
        subtitle="The DealLock foundation — tokens, the satin-metal surface, and every reusable primitive in one place."
      />

      <div className="dl-lab">
        <Section idx="01" title="Typography" caption="4 roles — never drift" stage>
          <div className="dl-type-row">
            <span className="dl-type-row__meta">Display · Instrument Serif · rare expressive headings</span>
            <span className="dl-type--display">Escrow you can inspect</span>
          </div>
          <div className="dl-type-row">
            <span className="dl-type-row__meta">UI · Inter · page title (semibold)</span>
            <span className="dl-type--title">Agreements</span>
          </div>
          <div className="dl-type-row">
            <span className="dl-type-row__meta">UI · Inter · body (default)</span>
            <span className="dl-type--body">
              Funds stay locked in escrow until each milestone is approved and released on-chain.
            </span>
          </div>
          <div className="dl-type-row">
            <span className="dl-type-row__meta">Mono · IBM Plex Mono · labels / IDs / addresses</span>
            <span className="dl-type--mono">0x4F2c…a7b2 · MILESTONE 02 · USDC</span>
          </div>
        </Section>

        <Section idx="02" title="Color & surfaces" caption="accents are semantic only" stage>
          <div>
            <div className="dl-lab__specimen-label">Ink</div>
            <div className="dl-lab__grid">{INKS.map((s) => <Swatch key={s.name} {...s} />)}</div>
          </div>
          <div>
            <div className="dl-lab__specimen-label">Accents</div>
            <div className="dl-lab__grid">{ACCENTS.map((s) => <Swatch key={s.name} {...s} />)}</div>
          </div>
          <div>
            <div className="dl-lab__specimen-label">Surfaces</div>
            <div className="dl-lab__grid">{SURFACES.map((s) => <Swatch key={s.name} {...s} />)}</div>
          </div>
        </Section>

        <Section idx="03" title="Metal surface" caption="the material everything rests on">
          <MetalSurface variant="panel" orbits className="dl-lab__metal">
            <span className="dl-type--title">Satin aluminum</span>
          </MetalSurface>
          <p className="dl-lab__note">
            Brushed grain · diagonal specular sweep · dot texture · vignette · optional orbital linework.
          </p>
        </Section>

        <Section idx="04" title="Buttons" caption="one primary per screen" stage>
          <div className="dl-lab__row">
            <Button variant="primary" icon={<IconPlus />}>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="positive" icon={<IconShield />}>Release</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Cancel agreement</Button>
          </div>
          <div className="dl-lab__row">
            <Button variant="primary" loading>Submitting</Button>
            <Button variant="secondary" disabled>Disabled</Button>
            <Button variant="primary" size="sm">Small</Button>
            <Button variant="secondary" size="lg" icon={<IconDownload />}>Large</Button>
          </div>
          <div className="dl-lab__row">
            <IconButton label="Notifications" icon={<IconBell />} dot />
            <IconButton label="Settings" icon={<IconSettings />} />
            <IconButton label="Metal" icon={<IconBolt />} variant="metal" />
            <IconButton label="Selected" icon={<IconAgreements />} selected />
            <IconButton label="Small" icon={<IconLock />} size="sm" />
          </div>
        </Section>

        <Section idx="05" title="Controls" stage>
          <div className="dl-lab__row">
            <WorkspaceSwitch />
            <SegmentedControl
              ariaLabel="Range"
              value={seg}
              onChange={setSeg}
              options={[{ value: "30d", label: "30D" }, { value: "90d", label: "90D" }, { value: "ytd", label: "YTD" }]}
            />
            <Switch on={sw} onChange={setSw} label="Demo toggle" />
          </div>
          <div className="dl-lab__row">
            <div className="dl-lab__field">
              <SearchInput value={search} onChange={setSearch} placeholder="Search agreements…" block />
            </div>
          </div>
        </Section>

        <Section idx="06" title="Status chips" caption="dot + text, never color alone" stage>
          <div className="dl-lab__row">
            <StatusChip tone="secure">Active</StatusChip>
            <StatusChip tone="review">In review</StatusChip>
            <StatusChip tone="danger">Disputed</StatusChip>
            <StatusChip tone="technical">On-chain</StatusChip>
            <StatusChip tone="neutral">Draft</StatusChip>
          </div>
        </Section>

        <Section idx="07" title="Metric cards" caption="optional identity medallion">
          <div className="dl-grid-metrics">
            <MetricCard label="In escrow" value="$48,250" meta="Across 6 agreements" icon={<IconLock />} tone="secure" />
            <MetricCard label="Released" value="$31,900" meta="▲ 5.1% vs. prior" trend="up" icon={<IconDollar />} tone="secure" />
            <MetricCard label="Needs review" value={3} meta="Submitted work" icon={<IconShield />} tone="review" onClick={() => {}} />
          </div>
        </Section>

        <Section idx="08" title="Cards" caption="base · raised · glass · inset">
          <div className="dl-grid-2">
            <Card label="Base card" title="Milestone 02">
              <p className="dl-muted">White plate on the satin shell with a faint brushed catch.</p>
            </Card>
            <Card variant="raised" label="Raised card" title="Elevated hero">
              <p className="dl-muted">A deeper shadow lifts it off the surface — for the primary zone.</p>
            </Card>
            <Card variant="glass" label="Glass panel" title="Frosted">
              <p className="dl-muted">Restrained blur — used for sticky / floating surfaces only.</p>
            </Card>
            <Card variant="inset" label="Inset panel" title="Secondary">
              <p className="dl-muted">A recessed surface for nested or supporting content.</p>
            </Card>
          </div>
        </Section>

        <Section idx="09" title="Action tiles">
          <div className="dl-grid-metrics">
            <ActionTile icon={<IconPlus />} label="New agreement" sub="Draft escrow terms" />
            <ActionTile icon={<IconUpload />} label="Submit work" sub="Mark a milestone done" />
            <ActionTile icon={<IconShield />} label="Release milestone" sub="Approve & pay out" />
          </div>
        </Section>

        <Section idx="10" title="Table shell">
          <Card flush>
            <TableShell columns={TABLE_COLS} caption="Component table demo" clickable>
              {[
                { n: "Button", r: "Action", s: "secure" as const, v: "5 variants" },
                { n: "Card", r: "Surface", s: "secure" as const, v: "3 levels" },
                { n: "TableShell", r: "Data", s: "review" as const, v: "this" },
              ].map((row) => (
                <tr key={row.n}>
                  <td className="dl-table__name">{row.n}</td>
                  <td>{row.r}</td>
                  <td data-align="center"><StatusChip tone={row.s}>{row.s === "secure" ? "Ready" : "WIP"}</StatusChip></td>
                  <td data-align="right" className="dl-table__num">{row.v}</td>
                </tr>
              ))}
            </TableShell>
          </Card>
        </Section>

        <Section idx="11" title="Identity" caption="metal token · name in UI sans" stage>
          <div className="dl-lab__row">
            <Avatar initials="JL" size="sm" />
            <Avatar initials="SV" size="md" />
            <Avatar initials="AC" size="lg" />
          </div>
          <div className="dl-lab__row">
            <Identity initials="SV" name="Summit Ventures" sub="Company" size="md" />
            <Identity initials="JL" name="Jordan Lee" sub="Individual" size="md" />
          </div>
        </Section>

        <Section idx="12" title="Empty state">
          <Card flush>
            <EmptyState
              icon={<IconAgreements />}
              title="No agreements yet"
              text="When you lock your first escrow agreement, it'll appear here with everything that's funded."
              action={<Button variant="primary" icon={<IconPlus />}>New agreement</Button>}
            />
          </Card>
        </Section>

        <Section idx="13" title="Bottom action bar" caption="commit-style flows">
          <BottomActionBar label="Milestone 02 · ready to release" value="$12,500 USDC">
            <Button variant="ghost">Request revision</Button>
            <Button variant="positive" icon={<IconShield />}>Release funds</Button>
          </BottomActionBar>
        </Section>
      </div>
    </PageContainer>
  );
}
