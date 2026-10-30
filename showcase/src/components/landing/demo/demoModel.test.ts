/*
 * Invariant tests for the interactive escrow simulator's reducer.
 *
 * These assert against the ACTUAL reducer + selectors in demoModel.ts (not hardcoded
 * display strings), so they lock in the escrow rules the demo claims to show:
 * acceptance-before-funding, all-at-once funding, sequential milestones, manual
 * approval, no fees, and the revision path. If a change breaks one of these, the demo
 * would mislead a visitor about how the real contracts behave — so the test fails.
 *
 * Runs on Node's built-in test runner with native TypeScript (no test-framework
 * dependency, so the showcase keeps a zero-vulnerability dependency tree):
 *   node --test "src/**\/*.test.ts"   (see `npm test`)
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  reducer,
  initialDemoState,
  totalAmount,
  lockedAmount,
  releasedAmount,
  releasedCount,
  activeMilestone,
  stepFor,
  type DemoAction,
  type DemoState,
} from "./demoModel.ts";

/** Apply a sequence of actions to a fresh state. */
function run(...actions: DemoAction[]): DemoState {
  return actions.reduce((s, a) => reducer(s, a), initialDemoState());
}

const TOTAL = 12_000; // 4000 + 5000 + 3000

describe("initial state", () => {
  it("starts Proposed with three upcoming milestones and one creation event", () => {
    const s = initialDemoState();
    assert.equal(s.phase, "proposed");
    assert.equal(s.milestones.length, 3);
    assert.ok(s.milestones.every((m) => m.status === "upcoming"));
    assert.equal(totalAmount(s), TOTAL);
    assert.equal(lockedAmount(s), 0);
    assert.equal(releasedAmount(s), 0);
    assert.equal(s.events.length, 1);
  });
});

describe("funding requires acceptance first", () => {
  it("ignores FUND while Proposed (cannot fund before the provider accepts)", () => {
    const s = run({ type: "FUND" });
    assert.equal(s.phase, "proposed");
    assert.equal(lockedAmount(s), 0);
  });

  it("locks the FULL total at once on funding, and opens only milestone 1", () => {
    const s = run({ type: "ACCEPT" }, { type: "FUND" });
    assert.equal(s.phase, "funded");
    assert.equal(lockedAmount(s), TOTAL); // all-at-once funding
    assert.equal(releasedAmount(s), 0);
    assert.equal(s.milestones[0].status, "in_progress");
    assert.equal(s.milestones[1].status, "upcoming");
    assert.equal(s.milestones[2].status, "upcoming");
  });
});

describe("milestones are strictly sequential", () => {
  it("only the earliest unreleased milestone is ever active", () => {
    const s = run({ type: "ACCEPT" }, { type: "FUND" });
    assert.equal(activeMilestone(s)?.id, s.milestones[0].id);
  });

  it("SUBMIT acts on milestone 1 and never on a later one while earlier is pending", () => {
    const s = run({ type: "ACCEPT" }, { type: "FUND" }, { type: "SUBMIT" });
    assert.equal(s.milestones[0].status, "submitted");
    assert.equal(s.milestones[1].status, "upcoming"); // still blocked
  });

  it("approving milestone 1 advances exactly milestone 2 (not 3)", () => {
    const s = run({ type: "ACCEPT" }, { type: "FUND" }, { type: "SUBMIT" }, { type: "APPROVE" });
    assert.equal(s.milestones[0].status, "released");
    assert.equal(s.milestones[1].status, "in_progress");
    assert.equal(s.milestones[2].status, "upcoming"); // not incorrectly unlocked
  });
});

describe("amounts stay correct through releases", () => {
  it("after the first release: released=4000, locked=8000, conserved", () => {
    const s = run({ type: "ACCEPT" }, { type: "FUND" }, { type: "SUBMIT" }, { type: "APPROVE" });
    assert.equal(releasedAmount(s), 4_000);
    assert.equal(lockedAmount(s), 8_000);
    assert.equal(releasedCount(s), 1);
    // conservation: locked + released always equals the funded total
    assert.equal(lockedAmount(s) + releasedAmount(s), TOTAL);
  });
});

describe("revision path", () => {
  it("submitted -> revision -> resubmitted -> released", () => {
    let s = run({ type: "ACCEPT" }, { type: "FUND" }, { type: "SUBMIT" });
    assert.equal(s.milestones[0].status, "submitted");
    s = reducer(s, { type: "REQUEST_REVISION" });
    assert.equal(s.milestones[0].status, "revision");
    assert.equal(s.milestones[0].revisions, 1);
    s = reducer(s, { type: "RESUBMIT" });
    assert.equal(s.milestones[0].status, "submitted");
    s = reducer(s, { type: "APPROVE" });
    assert.equal(s.milestones[0].status, "released");
    assert.equal(releasedAmount(s), 4_000);
  });
});

describe("invalid actions never create impossible states", () => {
  it("APPROVE with nothing submitted is a no-op", () => {
    const funded = run({ type: "ACCEPT" }, { type: "FUND" });
    assert.deepEqual(reducer(funded, { type: "APPROVE" }), funded);
  });

  it("SUBMIT when no milestone is in progress is a no-op", () => {
    const proposed = initialDemoState();
    assert.deepEqual(reducer(proposed, { type: "SUBMIT" }), proposed);
  });

  it("RESUBMIT when not in revision is a no-op", () => {
    const submitted = run({ type: "ACCEPT" }, { type: "FUND" }, { type: "SUBMIT" });
    assert.deepEqual(reducer(submitted, { type: "RESUBMIT" }), submitted);
  });
});

describe("full happy path settles the agreement", () => {
  it("all three milestones release, nothing remains locked, phase Completed", () => {
    const s = run(
      { type: "ACCEPT" },
      { type: "FUND" },
      { type: "SUBMIT" }, { type: "APPROVE" }, // m1
      { type: "SUBMIT" }, { type: "APPROVE" }, // m2
      { type: "SUBMIT" }, { type: "APPROVE" }, // m3
    );
    assert.equal(s.phase, "completed");
    assert.equal(releasedAmount(s), TOTAL);
    assert.equal(lockedAmount(s), 0);
    assert.equal(releasedCount(s), 3);
    assert.ok(s.milestones.every((m) => m.status === "released"));
  });
});

describe("reset restores the initial scenario", () => {
  it("RESET deep-equals a fresh initial state", () => {
    const messy = run({ type: "ACCEPT" }, { type: "FUND" }, { type: "SUBMIT" }, { type: "APPROVE" });
    assert.deepEqual(reducer(messy, { type: "RESET" }), initialDemoState());
  });
});

describe("SKIP_TO_REVIEW fast-forwards to the release moment", () => {
  it("lands on funded + milestone 1 submitted, with a consistent ledger", () => {
    const s = reducer(initialDemoState(), { type: "SKIP_TO_REVIEW" });
    assert.equal(s.phase, "funded");
    assert.equal(s.milestones[0].status, "submitted");
    assert.equal(lockedAmount(s), TOTAL);
    assert.ok(s.events.length >= 4);
  });
});

describe("perspectives expose the right actions", () => {
  it("only the freelancer can accept a proposed agreement", () => {
    const s = initialDemoState();
    const types = (role: "client" | "freelancer") => stepFor(s, role).actions.map((a) => a.action.type);
    assert.ok(types("freelancer").includes("ACCEPT"));
    assert.equal(stepFor(s, "client").actions.length, 0);
    assert.equal(stepFor(s, "client").yourMove, false);
  });

  it("only the client can fund an accepted agreement", () => {
    const s = run({ type: "ACCEPT" });
    const clientActions = stepFor(s, "client").actions.map((a) => a.action.type);
    assert.ok(clientActions.includes("FUND"));
    assert.equal(stepFor(s, "freelancer").yourMove, false);
  });

  it("on submission, only the client can approve or request a revision", () => {
    const s = run({ type: "ACCEPT" }, { type: "FUND" }, { type: "SUBMIT" });
    const clientActions = stepFor(s, "client").actions.map((a) => a.action.type);
    assert.ok(clientActions.includes("APPROVE"));
    assert.ok(clientActions.includes("REQUEST_REVISION"));
    assert.equal(stepFor(s, "freelancer").yourMove, false);
  });
});
