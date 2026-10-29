import React from "react";

export const Header: React.FC = () => {
  return (
    <header className="border-b border-border bg-surface/50 backdrop-blur-md sticky top-0 z-50 py-4 px-6 mb-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            AI Running Form & Performance Analyzer
          </h1>
          <p className="text-xs font-medium text-slate-400 mt-0.5">
            Browser-Side Pose Estimation • Landmark-Derived Motion Metrics • Experimental Scoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            Video Processed in Browser
          </span>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-success/10 text-success border border-success/20">
            No Video Upload
          </span>
        </div>
      </div>
    </header>
  );
};
