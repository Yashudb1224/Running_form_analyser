import React from "react";
import { MetricResult } from "@/types/telemetry";

interface MetricValueProps {
  metric: MetricResult;
  digits?: number;
  className?: string;
  showProvenance?: boolean;
}

export function MetricValue({ metric, digits = 1, className = "", showProvenance = true }: MetricValueProps) {
  const value = metric.value === null
    ? "Unavailable"
    : `${Number.isInteger(metric.value) ? metric.value : metric.value.toFixed(digits)} ${metric.unit}`;
  const provenance = metric.status.replaceAll("-", " ");
  return (
    <span className={className} title={metric.explanation}>
      {value}
      {showProvenance && <span className="block text-[10px] font-normal text-slate-500 mt-1 capitalize">{provenance}</span>}
    </span>
  );
}
