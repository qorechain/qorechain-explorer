// components/Shell.tsx
// Explorer chrome: header (logo · network switcher · theme · docs/dashboard)
// + footer with task-oriented docs links. Same visual language as the
// QoreChain dashboard.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { BookOpen, ExternalLink, Moon, Sun } from "lucide-react";

import { useNetwork } from "@/lib/network-provider";
import { DASHBOARD_ORIGIN, NETWORKS, type NetworkId } from "@/lib/registry";
import { DOCS_BASE, DOCS_LINK_GROUPS, docsUrl } from "@/lib/docs-links";

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setMounted(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return mounted;
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="cursor-pointer rounded-lg p-2 text-slate-500 transition-colors hover:bg-black/5 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function NetworkSwitcher() {
  const { networkId, setNetwork } = useNetwork();
  const mounted = useMounted();
  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1 dark:border-[#1a1f2e]">
      {(Object.keys(NETWORKS) as NetworkId[]).map((id) => {
        const active = mounted && networkId === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setNetwork(id)}
            className={`cursor-pointer flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
              active
                ? "bg-emerald-600 text-white"
                : "text-slate-500 hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/10"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white" : "bg-emerald-500/70"}`}
            />
            {NETWORKS[id].label}
          </button>
        );
      })}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { network } = useNetwork();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b-[0.5px] border-black/20 bg-white px-4 dark:border-gray-700 dark:bg-[#121320] lg:px-6">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote brand asset */}
          <img
            src="https://www.qorechain.io/assets/icon.png"
            alt="QoreChain"
            className="h-8 w-8"
          />
          <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
            QoreChain
            <span className="ml-2 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Explorer
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <NetworkSwitcher />
          <ThemeToggle />
          <a
            href={DOCS_BASE}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10 md:flex"
          >
            <BookOpen className="h-4 w-4" /> Docs
          </a>
          <a
            href={DASHBOARD_ORIGIN}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer flex items-center gap-1.5 rounded-lg bg-black px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
          >
            Dashboard <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">{children}</main>

      <footer className="border-t border-black/10 bg-white px-4 py-10 dark:border-white/10 dark:bg-[#0f1219] lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {DOCS_LINK_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {group.title}
                </div>
                <ul className="space-y-2">
                  {group.links.map((link) => (
                    <li key={link.path}>
                      <a
                        href={docsUrl(link.path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={link.description}
                        className="cursor-pointer text-sm text-slate-500 transition-colors hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-start justify-between gap-2 border-t border-black/5 pt-6 text-xs text-slate-400 dark:border-white/5 dark:text-slate-500 sm:flex-row sm:items-center">
            <span>
              QoreChain Explorer — {network.label} (
              <span className="font-mono">{network.data.chainId.cosmos}</span>)
            </span>
            <span className="flex items-center gap-4">
              <a href={docsUrl("/appendix/networks")} target="_blank" rel="noopener noreferrer" className="cursor-pointer hover:text-emerald-500">
                Networks
              </a>
              <a href={docsUrl("/appendix/faq")} target="_blank" rel="noopener noreferrer" className="cursor-pointer hover:text-emerald-500">
                FAQ
              </a>
              <a href="https://www.qorechain.io" target="_blank" rel="noopener noreferrer" className="cursor-pointer hover:text-emerald-500">
                qorechain.io
              </a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
