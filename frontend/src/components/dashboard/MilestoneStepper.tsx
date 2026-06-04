/* Horizontal milestone progress stepper. Done steps get a sage check, the
 * current step a graphite node, future steps a quiet outline. Clean and calm —
 * no infographic noise (STYLE_GUIDE §9). */
import type { Milestone } from "../../fixtures/types";
import { IconCheck } from "./icons";

const DONE: Record<string, boolean> = {
  released: true,
  approved: true,
  completed: true,
};

export default function MilestoneStepper({
  milestones,
  currentId,
}: {
  milestones: Milestone[];
  currentId?: string;
}) {
  return (
    <div className="dl-steps">
      {milestones.map((m) => {
        const done = DONE[m.status];
        const current = m.id === currentId && !done;
        return (
          <div
            key={m.id}
            className={`dl-step${done ? " is-done" : ""}${current ? " is-current" : ""}`}
          >
            <span className="dl-step__node">{done ? <IconCheck /> : m.order}</span>
            <span className="dl-step__label">{m.title}</span>
            <span className="dl-step__cap">{m.dueDate}</span>
          </div>
        );
      })}
    </div>
  );
}
