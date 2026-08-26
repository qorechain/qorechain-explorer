///// Date : 2026-08-26 | Changes : Shared pager + prev/next stepper (SCRUM-241) | Who : Liviu Epure
"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const BTN =
  "inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm " +
  "font-medium text-slate-700 transition hover:border-emerald-400 hover:text-emerald-600 " +
  "dark:border-[#1a1f2e] dark:text-slate-300 dark:hover:border-emerald-500/50 dark:hover:text-emerald-400";
const BTN_OFF =
  "inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-slate-100 px-3 py-1.5 " +
  "text-sm font-medium text-slate-300 dark:border-[#141824] dark:text-slate-600";

/**
 * Page-number pager for a list.
 *
 * `total` is the chain-wide count; the caller fetches only the current page, so
 * this component never sees more rows than are on screen.
 */
export function Pager({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
      <span className="text-slate-500 dark:text-slate-400">
        {total === 0
          ? "Nothing to show"
          : `${first.toLocaleString()}–${last.toLocaleString()} of ${total.toLocaleString()}`}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={BTN} rel="prev">
            <ChevronLeft className="h-4 w-4" /> Newer
          </Link>
        ) : (
          <span className={BTN_OFF}>
            <ChevronLeft className="h-4 w-4" /> Newer
          </span>
        )}
        <span className="px-1 text-slate-400">
          Page {page.toLocaleString()} of {lastPage.toLocaleString()}
        </span>
        {page < lastPage ? (
          <Link href={hrefFor(page + 1)} className={BTN} rel="next">
            Older <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className={BTN_OFF}>
            Older <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Prev/next stepper for a detail page. A missing neighbour renders as a
 * disabled control rather than disappearing, so the buttons do not move around
 * as you step through — and "there is nothing newer" stays visible instead of
 * looking like a rendering fault.
 */
export function Stepper({
  prevHref,
  nextHref,
  prevLabel,
  nextLabel,
  loading = false,
}: {
  prevHref: string | null;
  nextHref: string | null;
  prevLabel: string;
  nextLabel: string;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      {prevHref && !loading ? (
        <Link href={prevHref} className={BTN} rel="prev">
          <ChevronLeft className="h-4 w-4" /> {prevLabel}
        </Link>
      ) : (
        <span className={BTN_OFF} title={loading ? "Looking up neighbours…" : "Nothing older"}>
          <ChevronLeft className="h-4 w-4" /> {prevLabel}
        </span>
      )}
      {nextHref && !loading ? (
        <Link href={nextHref} className={BTN} rel="next">
          {nextLabel} <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className={BTN_OFF} title={loading ? "Looking up neighbours…" : "Nothing newer"}>
          {nextLabel} <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </div>
  );
}
