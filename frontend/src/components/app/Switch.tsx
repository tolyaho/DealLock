/*
 * Switch — a metal rocker toggle. When on, the track gains a soft sage
 * under-glow beneath the brushed-disc knob (moodboard: metallic toggle glow).
 * Exposed as role="switch" with aria-checked.
 */
interface Props {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
}

export function Switch({ on, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`dl-switch${on ? " is-on" : ""}`}
      onClick={() => onChange(!on)}
    >
      <span className="dl-switch__knob" aria-hidden="true" />
    </button>
  );
}
