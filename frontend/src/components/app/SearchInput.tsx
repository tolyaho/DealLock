/*
 * SearchInput — a recessed satin field with a leading search glyph and an
 * optional clear button. Controlled. The field is a real <input> so native
 * keyboard / autofill / a11y behaviour is preserved.
 */
import { IconClose, IconSearch } from "./icons";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  block?: boolean;
  onClear?: () => void;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  ariaLabel = "Search",
  block,
  onClear,
}: Props) {
  return (
    <div className={`dl-search${block ? " dl-search--block" : ""}`}>
      <IconSearch className="dl-search__icon" aria-hidden="true" />
      <input
        className="dl-search__field"
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          className="dl-search__clear"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            onClear?.();
          }}
        >
          <IconClose />
        </button>
      )}
    </div>
  );
}
