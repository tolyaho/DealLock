/*
 * Identity — the reusable "who" cell: a metal-token Avatar + a name (UI sans,
 * never mono) with an optional second-line subtitle (type / role / handle).
 *
 * Used wherever a party appears (Agreements table, Counterparties list, …) so
 * monogram + name styling and truncation stay consistent. Flex with min-width:0
 * throughout, so the name ellipsizes correctly inside a fixed table cell or a
 * flexible list row — and only when there genuinely isn't room.
 */
import { Avatar } from "./Avatar";

interface Props {
  initials: string;
  name: string;
  /** optional second line — e.g. "Company", "Client", a handle */
  sub?: string;
  size?: "sm" | "md" | "lg";
}

export function Identity({ initials, name, sub, size = "sm" }: Props) {
  return (
    <span className="dl-identity">
      <Avatar initials={initials} size={size} />
      <span className="dl-identity__text">
        <span className="dl-identity__name">{name}</span>
        {sub && <span className="dl-identity__sub">{sub}</span>}
      </span>
    </span>
  );
}
