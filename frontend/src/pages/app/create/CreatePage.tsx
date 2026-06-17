/*
 * Create flow — a guided, one-step-at-a-time wizard for authoring an escrow
 * agreement (client) or a proposal (provider). Same fields and layout for both
 * roles; only the copy and the final action differ. Lives inside the dashboard
 * shell (AppShell Outlet) so the sidebar/topbar/workspace stay put — this page
 * adds NO new shell chrome, only a calm centred wizard card built from the kit.
 *
 * State is local (see ./model). Nothing here calls the backend or chain; the
 * draft shape mirrors the domain so a later phase can map it to POST /agreements.
 */
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, PageContainer, useRoleConfig, useWorkspace } from "../../../components/app";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconClose,
  IconSend,
  IconShield,
} from "../../../components/app/icons";
import type { Role } from "../../../fixtures/types";
import { Stepper } from "./Stepper";
import {
  BasicsStep,
  CounterpartyStep,
  MilestonesStep,
  PaymentStep,
  ReviewStep,
  type StepCtx,
} from "./steps";
import {
  initialDraft,
  newMilestone,
  STEP_ORDER,
  validateStep,
  firstInvalidStep,
  type CreateDraft,
  type DraftMilestone,
  type StepErrors,
  type StepId,
} from "./model";

function stepCopy(step: StepId, role: Role): { title: string; sub: string } {
  const isClient = role === "client";
  switch (step) {
    case "counterparty":
      return {
        title: isClient ? "Who is the provider?" : "Who is the client?",
        sub: isClient
          ? "Add the provider you want to work with."
          : "Add the client you’re sending this proposal to.",
      };
    case "basics":
      return { title: "Project basics", sub: "The essentials of the work." };
    case "milestones":
      return {
        title: "Milestones",
        sub: "Break the work into milestones — each is funded and released on its own.",
      };
    case "payment":
      return { title: "Payment", sub: "Choose how escrow is denominated." };
    case "review":
      return {
        title: "Review & confirm",
        sub: isClient
          ? "Check everything before you create the agreement."
          : "Check everything before you send the proposal.",
      };
  }
}

export default function CreatePage() {
  const { workspace } = useWorkspace();
  const cfg = useRoleConfig();
  const navigate = useNavigate();
  const isClient = workspace === "client";

  const [draft, setDraft] = useState<CreateDraft>(initialDraft);
  const [index, setIndex] = useState(0);
  const [reached, setReached] = useState(0);
  const [errors, setErrors] = useState<StepErrors>({});
  const [done, setDone] = useState(false);

  const step = STEP_ORDER[index];
  const isLast = index === STEP_ORDER.length - 1;

  // Any edit clears the visible inline errors; the step re-validates on Next.
  const set = useCallback((patch: Partial<CreateDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors({});
  }, []);

  const updateMilestone = useCallback((id: string, patch: Partial<DraftMilestone>) => {
    setDraft((d) => ({
      ...d,
      milestones: d.milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
    setErrors({});
  }, []);

  const addMilestone = useCallback(() => {
    setDraft((d) => ({ ...d, milestones: [...d.milestones, newMilestone()] }));
  }, []);

  const removeMilestone = useCallback((id: string) => {
    setDraft((d) =>
      d.milestones.length > 1
        ? { ...d, milestones: d.milestones.filter((m) => m.id !== id) }
        : d,
    );
    setErrors({});
  }, []);

  const goToIndex = (i: number) => {
    setErrors({});
    setIndex(i);
    setReached((r) => Math.max(r, i));
  };

  const next = () => {
    const e = validateStep(step, draft);
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    if (!isLast) goToIndex(index + 1);
  };

  const back = () => {
    if (index > 0) goToIndex(index - 1);
  };

  const jumpTo = (s: StepId) => goToIndex(STEP_ORDER.indexOf(s));

  const submit = () => {
    const bad = firstInvalidStep(draft);
    if (bad) {
      // Surface the problem where it lives, then show its errors.
      const i = STEP_ORDER.indexOf(bad);
      setIndex(i);
      setReached((r) => Math.max(r, i));
      setErrors(validateStep(bad, draft));
      return;
    }
    setDone(true);
  };

  const cancel = () => navigate(-1);

  const ctx: StepCtx = { role: workspace, draft, errors, set, updateMilestone, addMilestone, removeMilestone };
  const copy = stepCopy(step, workspace);

  if (done) {
    return <SuccessState role={workspace} draft={draft} navigate={navigate} />;
  }

  const finalLabel = isClient ? "Create agreement" : "Send proposal";
  const finalIcon = isClient ? <IconShield /> : <IconSend />;

  return (
    <PageContainer>
      <div className="dl-wizard">
        <div className="dl-wizard__top">
          <div className="dl-wizard__lede">
            <span className="dl-wizard__kicker">{cfg.primaryAction.label}</span>
            <Stepper current={step} reached={reached} onJump={jumpTo} />
          </div>
          <Button variant="secondary" size="sm" icon={<IconClose />} onClick={cancel}>Cancel</Button>
        </div>

        <section className="dl-wizard__card" aria-labelledby="dl-wizard-title">
          <header className="dl-wizard__head">
            <span className="dl-wizard__eyebrow">Step {index + 1} of {STEP_ORDER.length}</span>
            <h1 className="dl-wizard__title" id="dl-wizard-title">{copy.title}</h1>
            <p className="dl-wizard__sub">{copy.sub}</p>
          </header>

          {/* form sits in a recessed pearl well; body is keyed by step so the
              entrance transition replays on each change (the well stays put) */}
          <div className="dl-wizard__panel">
            <div className="dl-wizard__body" key={step}>
              {step === "counterparty" && <CounterpartyStep {...ctx} />}
              {step === "basics" && <BasicsStep {...ctx} />}
              {step === "milestones" && <MilestonesStep {...ctx} />}
              {step === "payment" && <PaymentStep {...ctx} />}
              {step === "review" && <ReviewStep {...ctx} onEdit={jumpTo} />}
            </div>
          </div>

          <footer className="dl-wizard__foot">
            {index > 0 ? (
              <Button variant="secondary" icon={<IconArrowLeft />} onClick={back}>Back</Button>
            ) : (
              <span />
            )}
            {isLast ? (
              <Button variant="primary" icon={finalIcon} onClick={submit}>{finalLabel}</Button>
            ) : (
              <Button variant="metal" onClick={next}>
                Next
                <IconArrowRight />
              </Button>
            )}
          </footer>
        </section>
      </div>
    </PageContainer>
  );
}

/* Final confirmation — a confident success seal + where the deal goes next. */
function SuccessState({
  role,
  draft,
  navigate,
}: {
  role: Role;
  draft: CreateDraft;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const isClient = role === "client";
  const who = draft.counterparty.trim() || (isClient ? "the provider" : "the client");
  const title = isClient ? "Agreement created" : "Proposal sent";
  const text = isClient
    ? `“${draft.title || "Your agreement"}” is ready. We’ve sent it to ${who} to review and accept — you’ll fund escrow once they accept.`
    : `“${draft.title || "Your proposal"}” has been sent to ${who}. They’ll review and fund escrow if they accept.`;

  return (
    <PageContainer>
      <div className="dl-wizard">
        <div className="dl-create-done" role="status" aria-live="polite">
          <span className="dl-create-done__seal" aria-hidden="true"><IconCheck /></span>
          <h1 className="dl-create-done__title">{title}</h1>
          <p className="dl-create-done__text">{text}</p>
          <div className="dl-create-done__actions">
            <Button
              variant="metal"
              onClick={() => navigate("/app/agreements", { state: { created: { title: draft.title, role } } })}
            >
              View agreements
            </Button>
            <Button variant="ghost" onClick={() => navigate("/app/home")}>Back to home</Button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
