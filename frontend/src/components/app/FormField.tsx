/*
 * Form primitives — the recessed satin field language, matched to SearchInput.
 *
 *   Field      — label · control · (hint|error) wrapper for arbitrary controls
 *                (asset pickers, amount affixes). Owns the a11y wiring.
 *   TextInput  — a single-line <input class="dl-input"> with the full field chrome.
 *   TextArea   — the multi-line variant (.dl-input--area).
 *
 * The field box carries its own silver focus ring (scoped under .dl-app in
 * app.css so it outranks the global graphite :focus-visible). Errors set
 * aria-invalid + role="alert"; hints/errors are wired via aria-describedby.
 */
import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

interface FieldChromeProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

function Describe({ hint, error, hintId, errId }: { hint?: string; error?: string; hintId?: string; errId?: string }) {
  if (error) return <p className="dl-field__error" id={errId} role="alert">{error}</p>;
  if (hint) return <p className="dl-field__hint" id={hintId}>{hint}</p>;
  return null;
}

/** Wrapper for a custom control (e.g. the payment asset grid). Render the control
 *  as children; pass the control's id via `htmlFor` so the label points at it. */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
}: FieldChromeProps & { htmlFor?: string; children: ReactNode }) {
  return (
    <div className="dl-field">
      {label && (
        <label className="dl-field__label" htmlFor={htmlFor}>
          {label}
          {required && <span className="dl-field__req" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      <Describe hint={hint} error={error} />
    </div>
  );
}

type TextInputProps = FieldChromeProps & Omit<InputHTMLAttributes<HTMLInputElement>, "className">;

export function TextInput({ label, hint, error, required, id, ...rest }: TextInputProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errId = error ? `${fieldId}-err` : undefined;
  const describedBy = [errId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="dl-field">
      {label && (
        <label className="dl-field__label" htmlFor={fieldId}>
          {label}
          {required && <span className="dl-field__req" aria-hidden="true">*</span>}
        </label>
      )}
      <input
        id={fieldId}
        className="dl-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      <Describe hint={hint} error={error} hintId={hintId} errId={errId} />
    </div>
  );
}

type TextAreaProps = FieldChromeProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">;

export function TextArea({ label, hint, error, required, id, rows = 3, ...rest }: TextAreaProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errId = error ? `${fieldId}-err` : undefined;
  const describedBy = [errId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="dl-field">
      {label && (
        <label className="dl-field__label" htmlFor={fieldId}>
          {label}
          {required && <span className="dl-field__req" aria-hidden="true">*</span>}
        </label>
      )}
      <textarea
        id={fieldId}
        className="dl-input dl-input--area"
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      <Describe hint={hint} error={error} hintId={hintId} errId={errId} />
    </div>
  );
}
