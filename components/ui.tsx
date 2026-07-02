// components/ui.tsx
// Small shared primitives in the dashboard's visual language.

"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";

export const CARD =
  "rounded-2xl border border-slate-100 bg-white dark:border-[#1a1f2e] dark:bg-[#171925]";

export function CopyValue({
  value,
  display,
  mono = true,
}: {
  value: string;
  display?: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [value]);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        className={`truncate ${mono ? "font-mono" : ""} text-slate-700 dark:text-slate-300`}
      >
        {display ?? value}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${value}`}
        className="cursor-pointer shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </span>
  );
}

export function FactRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-slate-500 dark:text-slate-400">{label}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      {message}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
    </div>
  );
}
