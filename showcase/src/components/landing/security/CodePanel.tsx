/*
 * CodePanel — the technical-proof centerpiece of the Security section.
 *
 * A large satin/frosted panel that switches between the security-concept tabs
 * (Native ETH / ERC-20 assets / Release rules). Layout, top to bottom:
 *   head    — concept tabs (a real ARIA tablist) + badge + copy button
 *   blurb   — one-line description of the active topic
 *   filebar — the source path, so the code reads as inspectable, not invented
 *   code    — line-numbered, syntax-highlighted snippet (see highlight.ts)
 *   meta    — per-topic strip (3 cells)
 *
 * Everything is driven by the `SecurityTab` array, so adding a tab needs no
 * changes here. The code area is re-keyed by tab so a light crossfade plays on
 * switch (disabled under prefers-reduced-motion in CSS).
 */

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { highlight, TOKEN_CLASS } from "./highlight";
import type { TabKey, SecurityTab } from "./securityData";
import {
  CheckIcon,
  CopyIcon,
  Erc20Icon,
  EthIcon,
  ReleaseIcon,
} from "./AssetIcons";

const TAB_ICON: Record<TabKey, (p: { className?: string }) => ReactNode> = {
  nativeEth: EthIcon,
  erc20: Erc20Icon,
  release: ReleaseIcon,
};

interface Props {
  tabs: SecurityTab[];
  activeKey: TabKey;
  onSelect: (key: TabKey) => void;
}

export default function CodePanel({ tabs, activeKey, onSelect }: Props) {
  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0];
  const lines = useMemo(() => highlight(active.code), [active.code]);

  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(active.code);
      setCopied(true);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1700);
    } catch {
      /* clipboard blocked (e.g. insecure context) — silently no-op */
    }
  }, [active.code]);

  // Roving arrow-key navigation across the tablist.
  const onTabKey = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = (index + dir + tabs.length) % tabs.length;
    tabRefs.current[next]?.focus();
    onSelect(tabs[next].key);
  };

  return (
    <div className="dl-code-panel">
      <div className="dl-code-panel__head">
        <div className="dl-asset-tabs" role="tablist" aria-label="Security topics">
          {tabs.map((tab, i) => {
            const Icon = TAB_ICON[tab.key];
            const selected = tab.key === activeKey;
            return (
              <button
                key={tab.key}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                id={`dl-asset-tab-${tab.key}`}
                aria-selected={selected}
                aria-controls="dl-code-region"
                tabIndex={selected ? 0 : -1}
                className={`dl-asset-tab${selected ? " is-active" : ""}`}
                onClick={() => onSelect(tab.key)}
                onKeyDown={(e) => onTabKey(e, i)}
              >
                <Icon className="dl-asset-tab__icon" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="dl-code-panel__tools">
          <span className="dl-code-panel__badge">{active.badge}</span>
          <button
            type="button"
            className={`dl-code-panel__copy${copied ? " is-copied" : ""}`}
            onClick={copy}
            aria-label={copied ? "Code copied" : "Copy code"}
          >
            {copied ? <CheckIcon className="dl-code-panel__copy-icon" /> : <CopyIcon className="dl-code-panel__copy-icon" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      <p className="dl-code-panel__blurb">{active.blurb}</p>

      <div className="dl-code-panel__filebar">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-6-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M13 3v6h6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
        <span className="dl-code-panel__filepath">{active.file}</span>
        <span className="dl-code-panel__lang">{active.lang}</span>
      </div>

      <div
        className="dl-code-panel__scroll"
        id="dl-code-region"
        role="tabpanel"
        aria-labelledby={`dl-asset-tab-${active.key}`}
        tabIndex={0}
      >
        {/* Re-keyed by asset so the crossfade keyframe replays on switch. */}
        <pre className="dl-code" key={active.key}>
          <code>
            {lines.map((tokens, li) => (
              <span className="dl-code__line" key={li}>
                <span className="dl-code__ln" aria-hidden="true">
                  {li + 1}
                </span>
                <span className="dl-code__src">
                  {tokens.length === 0
                    ? "​"
                    : tokens.map((t, ti) => (
                        <span key={ti} className={TOKEN_CLASS[t.type]}>
                          {t.text}
                        </span>
                      ))}
                </span>
              </span>
            ))}
          </code>
        </pre>
      </div>

      <dl className="dl-code-panel__meta">
        {active.meta.map((m) => (
          <div className="dl-code-panel__meta-cell" key={m.label}>
            <dt>{m.label}</dt>
            <dd>{m.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
