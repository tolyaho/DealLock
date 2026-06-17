/*
 * Wizard step bodies — each renders only the fields for its step; the card head
 * copy (eyebrow / title / subtitle) is role-aware and owned by CreatePage. All
 * controls come from the kit (TextInput / TextArea / Field / Button) so the
 * silver field + focus language matches the rest of the dashboard exactly.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Button, Field, TextArea, TextInput } from "../../../components/app";
import {
  IconCheck,
  IconChevronRight,
  IconClose,
  IconDiamond,
  IconDollar,
  IconEdit,
  IconLock,
  IconPlus,
} from "../../../components/app/icons";
import { formatMoney } from "../../../fixtures/format";
import type { AssetSymbol, Role } from "../../../fixtures/types";
import {
  draftTotal,
  formatDateLabel,
  milestoneAmount,
  STEP_LABEL,
  type CreateDraft,
  type DraftMilestone,
  type StepErrors,
  type StepId,
} from "./model";

export interface StepCtx {
  role: Role;
  draft: CreateDraft;
  errors: StepErrors;
  set: (patch: Partial<CreateDraft>) => void;
  updateMilestone: (id: string, patch: Partial<DraftMilestone>) => void;
  addMilestone: () => void;
  removeMilestone: (id: string) => void;
}

/* ── 1 · Counterparty ─────────────────────────────────────────────────────── */
export function CounterpartyStep({ role, draft, errors, set }: StepCtx) {
  const isClient = role === "client";
  return (
    <TextInput
      label={isClient ? "Provider email or wallet address" : "Client email or wallet address"}
      required
      type="text"
      autoComplete="off"
      autoCapitalize="off"
      spellCheck={false}
      placeholder="name@company.com  ·  0x…"
      value={draft.counterparty}
      onChange={(e) => set({ counterparty: e.target.value })}
      error={errors.counterparty}
      hint={
        isClient
          ? "They’ll review and accept before work begins."
          : "They’ll review the proposal and fund escrow if accepted."
      }
    />
  );
}

/* ── 2 · Project basics ───────────────────────────────────────────────────── */
export function BasicsStep({ role, draft, errors, set }: StepCtx) {
  const isClient = role === "client";
  return (
    <>
      <TextInput
        label={isClient ? "Agreement title" : "Proposal title"}
        required
        type="text"
        placeholder="e.g. Marketing site redesign"
        value={draft.title}
        onChange={(e) => set({ title: e.target.value })}
        error={errors.title}
      />
      <TextArea
        label="Short description"
        rows={3}
        placeholder="What’s being delivered, in a sentence or two."
        value={draft.description}
        onChange={(e) => set({ description: e.target.value })}
      />
      <TextInput
        label="Target deadline"
        type="date"
        value={draft.deadline}
        onChange={(e) => set({ deadline: e.target.value })}
        hint="Optional — the overall date you’re aiming for."
      />
    </>
  );
}

/* ── 3 · Milestones ───────────────────────────────────────────────────────── */
function MilestoneCard({
  index,
  milestone,
  asset,
  errors,
  isOpen,
  onToggle,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  milestone: DraftMilestone;
  asset: AssetSymbol;
  errors: StepErrors;
  isOpen: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<DraftMilestone>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const amountId = useId();
  const amount = milestoneAmount(milestone);
  const nameErr = errors[`ms-${milestone.id}-name`];
  const amountErr = errors[`ms-${milestone.id}-amount`];
  const summary = amount > 0 ? formatMoney({ amount, asset }) : "—";

  return (
    <div className={`dl-ms-edit${isOpen ? " is-open" : ""}`}>
      <div className="dl-ms-edit__head">
        <button
          type="button"
          className="dl-ms-edit__toggle"
          onClick={onToggle}
          aria-expanded={isOpen}
        >
          <span className="dl-ms-edit__index" aria-hidden="true">{index + 1}</span>
          <span className="dl-ms-edit__title">{milestone.name.trim() || `Milestone ${index + 1}`}</span>
          <span className="dl-ms-edit__amount dl-num">{summary}</span>
          <span className="dl-ms-edit__chevron" aria-hidden="true">
            <IconChevronRight />
          </span>
        </button>
        {canRemove && (
          <button
            type="button"
            className="dl-ms-edit__remove"
            onClick={onRemove}
            aria-label={`Remove milestone ${index + 1}`}
            title="Remove milestone"
          >
            <IconClose />
          </button>
        )}
      </div>

      <div className="dl-ms-edit__body" inert={!isOpen ? true : undefined}>
        <div className="dl-ms-edit__bodyinner">
          <div className="dl-ms-edit__fields">
            <TextInput
              label="Milestone name"
              required
              type="text"
              placeholder={`e.g. ${index === 0 ? "Discovery & wireframes" : "Build & handoff"}`}
              value={milestone.name}
              onChange={(e) => onChange({ name: e.target.value })}
              error={nameErr}
            />
            <TextArea
              label="Deliverable"
              rows={2}
              placeholder="What gets delivered for this milestone."
              value={milestone.description}
              onChange={(e) => onChange({ description: e.target.value })}
            />
            <div className="dl-ms-edit__row">
              <Field label="Amount" required htmlFor={amountId} error={amountErr}>
                <div className="dl-amount">
                  <input
                    id={amountId}
                    className="dl-input"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={milestone.amount}
                    aria-invalid={amountErr ? true : undefined}
                    onChange={(e) => onChange({ amount: e.target.value })}
                  />
                  <span className="dl-amount__suffix">{asset}</span>
                </div>
              </Field>
              <TextInput
                label="Due date"
                type="date"
                value={milestone.dueDate}
                onChange={(e) => onChange({ dueDate: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MilestonesStep({ draft, errors, updateMilestone, addMilestone, removeMilestone }: StepCtx) {
  // Expanded cards — first open by default; any newly-added milestone auto-opens.
  const [open, setOpen] = useState<Set<string>>(() => new Set(draft.milestones.slice(0, 1).map((m) => m.id)));
  const seen = useRef<Set<string>>(new Set(draft.milestones.map((m) => m.id)));
  const total = draftTotal(draft);

  useEffect(() => {
    let added = false;
    const next = new Set(open);
    for (const m of draft.milestones) {
      if (!seen.current.has(m.id)) {
        seen.current.add(m.id);
        next.add(m.id);
        added = true;
      }
    }
    if (added) setOpen(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.milestones]);

  const toggle = (id: string) =>
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <div className="dl-ms-list">
        {draft.milestones.map((m, i) => (
          <MilestoneCard
            key={m.id}
            index={i}
            milestone={m}
            asset={draft.asset}
            errors={errors}
            isOpen={open.has(m.id)}
            onToggle={() => toggle(m.id)}
            onChange={(patch) => updateMilestone(m.id, patch)}
            onRemove={() => removeMilestone(m.id)}
            canRemove={draft.milestones.length > 1}
          />
        ))}
      </div>

      <button type="button" className="dl-ms-add" onClick={addMilestone}>
        <IconPlus />
        Add milestone
      </button>

      <div className="dl-ms-subtotal">
        <span>{draft.milestones.length} milestone{draft.milestones.length === 1 ? "" : "s"}</span>
        <span className="dl-num">{formatMoney({ amount: total, asset: draft.asset })}</span>
      </div>
    </>
  );
}

/* ── 4 · Payment ──────────────────────────────────────────────────────────── */
const ASSETS: { value: AssetSymbol; name: string; desc: string; icon: typeof IconDollar }[] = [
  { value: "USDC", name: "USDC", desc: "Stablecoin · 6 decimals", icon: IconDollar },
  { value: "ETH", name: "ETH", desc: "Native · 18 decimals", icon: IconDiamond },
];

export function PaymentStep({ role, draft, set }: StepCtx) {
  const total = draftTotal(draft);
  const note =
    role === "client"
      ? "Funds are locked when you fund escrow."
      : "The client funds escrow after accepting your proposal.";

  return (
    <>
      <Field label="Payment asset" required>
        <div className="dl-asset-grid" role="radiogroup" aria-label="Payment asset">
          {ASSETS.map((a) => {
            const Icon = a.icon;
            const active = draft.asset === a.value;
            return (
              <button
                type="button"
                key={a.value}
                role="radio"
                aria-checked={active}
                className={`dl-asset${active ? " is-active" : ""}`}
                onClick={() => set({ asset: a.value })}
              >
                <span className="dl-asset__icon" aria-hidden="true"><Icon /></span>
                <span className="dl-asset__text">
                  <span className="dl-asset__name">{a.name}</span>
                  <span className="dl-asset__desc">{a.desc}</span>
                </span>
                <span className="dl-asset__check" aria-hidden="true"><IconCheck /></span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Network">
        <div className="dl-readonly" aria-readonly="true">
          <span className="dl-readonly__dot" aria-hidden="true" />
          Sepolia testnet
          <span className="dl-readonly__note">Only network for now</span>
        </div>
      </Field>

      <div className="dl-paytotal">
        <div className="dl-paytotal__text">
          <span className="dl-label">Total escrow</span>
          <span className="dl-paytotal__sub">Calculated from {draft.milestones.length} milestone{draft.milestones.length === 1 ? "" : "s"}</span>
        </div>
        <span className="dl-paytotal__value dl-num">{formatMoney({ amount: total, asset: draft.asset })}</span>
      </div>

      <p className="dl-paynote">
        <IconLock />
        {note}
      </p>
    </>
  );
}

/* ── 5 · Review ───────────────────────────────────────────────────────────── */
function ReviewSection({
  heading,
  step,
  onEdit,
  children,
}: {
  heading: string;
  step: StepId;
  onEdit: (s: StepId) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="dl-review__section">
      <div className="dl-review__head">
        <span className="dl-label">{heading}</span>
        <Button variant="ghost" size="sm" icon={<IconEdit />} onClick={() => onEdit(step)}>
          Edit
        </Button>
      </div>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="dl-review__row">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

export function ReviewStep({
  role,
  draft,
  onEdit,
}: StepCtx & { onEdit: (s: StepId) => void }) {
  const isClient = role === "client";
  const total = draftTotal(draft);
  return (
    <div className="dl-review">
      <ReviewSection heading={isClient ? "Provider" : "Client"} step="counterparty" onEdit={onEdit}>
        <dl>
          <Row k={isClient ? "Provider" : "Client"} v={draft.counterparty || "—"} />
        </dl>
      </ReviewSection>

      <ReviewSection heading="Project basics" step="basics" onEdit={onEdit}>
        <dl>
          <Row k="Title" v={draft.title || "—"} />
          {draft.description.trim() && <Row k="Description" v={draft.description} />}
          <Row k="Deadline" v={formatDateLabel(draft.deadline)} />
        </dl>
      </ReviewSection>

      <ReviewSection heading={`${STEP_LABEL.milestones} · ${draft.milestones.length}`} step="milestones" onEdit={onEdit}>
        <ul className="dl-review__ms">
          {draft.milestones.map((m, i) => (
            <li key={m.id} className="dl-review__msrow">
              <span className="dl-review__msname">{m.name.trim() || `Milestone ${i + 1}`}</span>
              <span className="dl-review__msmeta">
                {m.dueDate && <span>{formatDateLabel(m.dueDate)}</span>}
                <span className="dl-num">{formatMoney({ amount: milestoneAmount(m), asset: draft.asset })}</span>
              </span>
            </li>
          ))}
        </ul>
      </ReviewSection>

      <ReviewSection heading="Payment" step="payment" onEdit={onEdit}>
        <dl>
          <Row k="Asset" v={draft.asset} />
          <Row k="Network" v="Sepolia testnet" />
          <Row k="Total escrow" v={<span className="dl-num dl-review__total">{formatMoney({ amount: total, asset: draft.asset })}</span>} />
        </dl>
      </ReviewSection>
    </div>
  );
}
