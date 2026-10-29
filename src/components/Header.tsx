"use client";

import React from "react";
import { Activity, Monitor, Moon, ShieldCheck, Sun } from "lucide-react";
import { ThemePreference, useTheme } from "./ThemeProvider";

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light theme", icon: Sun },
  { value: "dark", label: "Dark theme", icon: Moon },
  { value: "system", label: "Match system theme", icon: Monitor },
];

export const Header: React.FC = () => {
  const { preference, setPreference } = useTheme();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/90 px-4 backdrop-blur sm:px-6">
      <div className="mx-auto flex min-h-16 max-w-[1280px] items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-on-primary">
            <Activity className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-ink">Stride Lab</h1>
            <p className="hidden text-[11px] font-medium text-muted sm:block">Running form analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden items-center gap-1.5 text-xs text-muted md:inline-flex">
            <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
            Video is processed in your browser
          </span>
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5" role="radiogroup" aria-label="Color theme">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={preference === value}
                aria-label={label}
                title={label}
                onClick={() => setPreference(value)}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                  preference === value ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};
