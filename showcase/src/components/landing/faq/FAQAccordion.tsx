/*
 * FAQAccordion — single-open accordion over the curated FAQ_FEATURED items (the
 * section fits one screen, so only the core questions render — see faqData). The
 * first item is open by default; opening another closes the previous (one panel
 * open at a time reads cleaner and keeps the column short). Clicking the open item
 * collapses it, so the user can close everything. State is just the open item's id.
 */

import { useState } from "react";
import { FEATURED_FAQ_ITEMS } from "./faqData";
import FAQItem from "./FAQItem";

export default function FAQAccordion() {
  const [openId, setOpenId] = useState<string | null>(FEATURED_FAQ_ITEMS[0].id);

  return (
    <ul className="dl-faq-list" role="list">
      {FEATURED_FAQ_ITEMS.map((item) => (
        <FAQItem
          key={item.id}
          item={item}
          open={openId === item.id}
          onToggle={() => setOpenId((prev) => (prev === item.id ? null : item.id))}
        />
      ))}
    </ul>
  );
}
