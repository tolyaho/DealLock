/*
 * RepoCta — the GitHub / repository wrapper. A standalone bar (kept separate from
 * the code panel so it's easy to extend with extra actions — "Download ABI",
 * "Read docs", etc.). `repoUrl` is a prop so the placeholder URL in securityData
 * can be swapped in one place.
 */

import { GithubIcon } from "./AssetIcons";

interface Props {
  repoUrl: string;
}

export default function RepoCta({ repoUrl }: Props) {
  return (
    <div className="dl-repo-cta">
      <div className="dl-repo-cta__lead">
        <span className="dl-repo-cta__mark" aria-hidden="true">
          <GithubIcon className="dl-repo-cta__gh" />
        </span>
        <div className="dl-repo-cta__text">
          <span className="dl-repo-cta__title">View escrow contracts on GitHub</span>
          <span className="dl-repo-cta__sub">DealLock V1–V6 factories and multi-asset escrow logic are public.</span>
        </div>
      </div>

      <div className="dl-repo-cta__actions">
        <a
          className="dl-repo-cta__btn dl-repo-cta__btn--ghost"
          href={repoUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          Review escrow logic
        </a>
        <a
          className="dl-repo-cta__btn dl-repo-cta__btn--solid"
          href={repoUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          Explore repository
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
    </div>
  );
}
