"use client";

import React from "react";
import { Activity, LogOut, Monitor, Moon, ShieldCheck, Sun } from "lucide-react";
import { ThemePreference, useTheme } from "./ThemeProvider";
import { useAuth } from "./AuthProvider";
import { GoogleIcon } from "./GoogleIcon";

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light theme", icon: Sun },
  { value: "dark", label: "Dark theme", icon: Moon },
  { value: "system", label: "Match system theme", icon: Monitor },
];

export const Header: React.FC = () => {
  const { preference, setPreference } = useTheme();
  const auth = useAuth();
  const name = auth.user?.name ?? "Account";
  const avatar = auth.user?.imageUrl ?? undefined;

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
          {auth.enabled && !auth.loading && (auth.user ? (
            <div className="flex items-center gap-2">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- profile photo URL from Clerk
                <img src={avatar} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full border border-border" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary">
                  {name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="hidden max-w-[10rem] truncate text-xs font-medium text-ink lg:block">{name}</span>
              <button type="button" onClick={() => void auth.signOut()} className="quiet-button min-h-8 px-2" title="Sign out" aria-label="Sign out">
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => void auth.signInWithGoogle()} className="control-button min-h-8">
              <GoogleIcon className="h-4 w-4" /> Sign in
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};
