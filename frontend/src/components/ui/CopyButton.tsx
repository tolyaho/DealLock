import { useState } from "react";

interface CopyButtonProps {
  text: string;
  className?: string;
  label?: string;
}

export default function CopyButton({ text, className = "", label = "Copy" }: CopyButtonProps) {
  const [done, setDone] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
    }
  }

  return (
    <button
      type="button"
      className={`btn-copy ${className}`.trim()}
      title={label}
      aria-live="polite"
      onClick={handleCopy}
    >
      {done ? "Copied" : label}
    </button>
  );
}
