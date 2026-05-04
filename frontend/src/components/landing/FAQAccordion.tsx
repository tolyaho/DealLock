import { useState } from "react";

interface FAQ {
  q: string;
  a: string;
}

interface Props {
  items: FAQ[];
}

export default function FAQAccordion({ items }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <dl className="faq-accordion">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={i} className={`faq-item ${isOpen ? "faq-item--open" : ""}`}>
            <dt>
              <button
                type="button"
                className="faq-trigger"
                aria-expanded={isOpen}
                id={`faq-q-${i}`}
                aria-controls={`faq-a-${i}`}
                onClick={() => setOpenIndex(isOpen ? null : i)}
              >
                <span className="faq-q-text">{item.q}</span>
                <span className="faq-icon" aria-hidden>
                  {isOpen ? "−" : "+"}
                </span>
              </button>
            </dt>
            {isOpen && (
              <dd
                className="faq-answer"
                id={`faq-a-${i}`}
                role="region"
                aria-labelledby={`faq-q-${i}`}
              >
                {item.a}
              </dd>
            )}
          </div>
        );
      })}
    </dl>
  );
}
