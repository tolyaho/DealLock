/*
 * Avatar — an engraved metal identity token (calm satin silver circle, Inter
 * semibold monogram). Sizes: sm 32 (table/list) · md 40 · lg 48 (profile).
 * `metal` is retained for call-site compatibility but is now a no-op — every
 * avatar uses the same calm token (see .dl-avatar in app.css).
 */
interface Props {
  initials: string;
  size?: "sm" | "md" | "lg";
  /** @deprecated all avatars are the metal token now; kept for compatibility */
  metal?: boolean;
}

export function Avatar({ initials, size = "md", metal }: Props) {
  return (
    <span className={`dl-avatar dl-avatar--${size}${metal ? " dl-avatar--metal" : ""}`} aria-hidden="true">
      {initials}
    </span>
  );
}
