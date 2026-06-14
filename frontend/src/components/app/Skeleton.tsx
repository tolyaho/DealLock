/*
 * Skeleton — silver/pearl loading placeholders for the dashboard. Recessed pearl
 * surfaces with a soft left-to-right light sweep (frosted-metal feel), rounded to
 * match the real components, so swapping skeleton → content causes NO layout shift.
 *
 * All skeletons are decorative: each is aria-hidden, and the loading REGION should
 * carry aria-busy (the pages do this). The sweep is disabled under
 * prefers-reduced-motion (CSS). No spinners — these stand in for normal data.
 *
 * `usePageLoading()` reads `?loading=1` so any page can preview its skeleton; it's
 * the single seam to swap for a real `isLoading` query flag when the dApp data lands.
 */
import type { CSSProperties, ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

/** `true` when `?loading=1` is present — the demo/wiring seam for real queries. */
export function usePageLoading(): boolean {
  const [params] = useSearchParams();
  return params.get("loading") === "1";
}

const cx = (base: string, extra?: string) => (extra ? `${base} ${extra}` : base);

export function SkeletonText({
  lines = 1,
  width,
  lastWidth = "62%",
  className,
}: {
  lines?: number;
  width?: string;
  lastWidth?: string;
  className?: string;
}) {
  if (lines === 1) {
    return <span className={cx("dl-skel dl-skel-line", className)} style={{ width }} aria-hidden="true" />;
  }
  return (
    <span className={cx("dl-skel-lines", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <span
          key={i}
          className="dl-skel dl-skel-line"
          style={{ width: i === lines - 1 ? lastWidth : width }}
        />
      ))}
    </span>
  );
}

export function SkeletonCircle({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cx("dl-skel dl-skel-circle", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

export function SkeletonButton({
  width = 96,
  className,
}: {
  width?: number | string;
  className?: string;
}) {
  return <span className={cx("dl-skel dl-skel-btn", className)} style={{ width }} aria-hidden="true" />;
}

/** A card-shaped skeleton — reuses the real `.dl-card` shell so the surface,
 *  radius and elevation match; fill it with skeleton bits (or the default). */
export function SkeletonCard({
  children,
  className,
  style,
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cx("dl-card dl-skel-card", className)} style={style} aria-hidden="true">
      {children ?? (
        <>
          <SkeletonText width="44%" />
          <SkeletonText lines={2} width="100%" lastWidth="72%" className="dl-skel-card__body" />
        </>
      )}
    </div>
  );
}

/** A generic list row skeleton: avatar circle + two stacked lines + a trailing
 *  control. Matches the `.dl-list__row` rhythm used across the dashboard. */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cx("dl-skel-row", className)} aria-hidden="true">
      <SkeletonCircle size={36} />
      <span className="dl-skel-row__main">
        <span className="dl-skel dl-skel-line" style={{ width: "52%" }} />
        <span className="dl-skel dl-skel-line dl-skel-line--sm" style={{ width: "34%" }} />
      </span>
      <SkeletonButton width={84} />
    </div>
  );
}

/** A generic table skeleton (header bar + N rows). Page tables that need an exact
 *  column match compose their own rows inside the real TableShell. */
export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="dl-skel-table" aria-hidden="true">
      <div className="dl-skel-table__head">
        <SkeletonText width="120px" className="dl-skel-line--sm" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/** Empty-state STAGE skeleton — reuses the real `.dl-stage` panel so the loading
 *  → empty-state swap never shifts. A round object placeholder, a title line, a
 *  couple of copy lines, and a CTA. */
export function StageSkeleton() {
  return (
    <section className="dl-stage" aria-hidden="true">
      <SkeletonCircle size={120} className="dl-skel-stage__obj" />
      <span className="dl-skel dl-skel-line" style={{ width: 168, height: 18 }} />
      <span className="dl-skel-lines dl-skel-stage__text">
        <span className="dl-skel dl-skel-line" />
        <span className="dl-skel dl-skel-line" style={{ width: "68%", margin: "0 auto" }} />
      </span>
      <SkeletonButton width={150} className="dl-skel-stage__cta" />
    </section>
  );
}
