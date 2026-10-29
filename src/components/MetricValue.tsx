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
  const provenance = metric.status.replace(/-/g, " ");
  return (
    <span className={className} aria-label={`${value}; ${provenance}`}>
      <span>{value}</span>
      {showProvenance && (
        <span className={`mt-1 block text-[10px] font-medium capitalize ${metric.status === "unavailable" ? "text-muted" : "text-primary"}`}>
          {provenance}
        </span>
      )}
    </span>
  );
}
