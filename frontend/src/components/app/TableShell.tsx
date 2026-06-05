/*
 * TableShell — the contractual table discipline (moodboard: Squarespace orders).
 * Tiny uppercase-mono column labels, generous row height, hairline dividers,
 * row hover. A real <table> so semantics / screen-reader column association are
 * preserved. Rows are supplied by the caller as <tr> children; set `data-align`
 * on a <td>/<th> to right/center-align (matches the column's `align`).
 */
import type { ReactNode } from "react";

export interface Column {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  /** optional fixed/min width, e.g. "120px" or "20%" */
  width?: string;
}

interface Props {
  columns: Column[];
  children: ReactNode;
  /** accessible name for the table */
  caption: string;
  /** show row pointer cursor (rows navigate) */
  clickable?: boolean;
  className?: string;
}

export function TableShell({ columns, children, caption, clickable, className = "" }: Props) {
  return (
    <div className="dl-table-wrap">
      <table className={`dl-table${clickable ? " dl-table--clickable" : ""}${className ? ` ${className}` : ""}`}>
        <caption className="dl-visually-hidden" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          {caption}
        </caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" data-align={c.align} style={c.width ? { width: c.width } : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
