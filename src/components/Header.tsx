import React from "react";
import { Activity } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 border-b-2 border-b-[#c17b48] bg-surface px-4 sm:px-6">
      <div className="mx-auto flex min-h-[72px] max-w-[1440px] items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center bg-[#172f40] text-white">
              <Activity className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">Stride Lab</h1>
              <p className="hidden text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 sm:block">Running motion analysis</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
