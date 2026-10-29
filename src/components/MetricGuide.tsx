import React from "react";
import { REFERENCE_RANGES } from "@/lib/researchReferences";

/** Every source behind the reference ranges, listed once each. */
const references = Array.from(
  new Map(Object.values(REFERENCE_RANGES).flatMap((range) => range.citations).map((citation) => [citation.short, citation.full])).values()
);

const definitions = [
  {
    name: "Cadence",
    definition: "How many steps you take per minute, counting both feet. Higher cadence usually means shorter, quicker steps.",
  },
  {
    name: "Shank angle at foot strike",
    definition: "The angle of your shin when your foot first touches the ground. A shin leaning forward means your foot lands out in front of your knee, which is called overstriding.",
  },
  {
    name: "Knee flexion at midstance",
    definition: "How much your knee bends while your foot is on the ground and carrying your weight. This bend absorbs the impact of landing.",
  },
  {
    name: "Forward trunk lean",
    definition: "How far your upper body leans forward from upright while you run.",
  },
  {
    name: "Left/right symmetry",
    definition: "How similar your left and right legs are, based on step timing and where each foot lands. 0% means both sides are identical.",
  },
  {
    name: "Stride-time variation",
    definition: "How consistent the timing of your strides is. A stride is two steps, one with each foot. Lower means a more even rhythm.",
  },
  {
    name: "Foot landing ahead of hip",
    definition: "How far in front of your hips your foot lands, shown as a percentage of your torso length.",
  },
  {
    name: "Vertical oscillation",
    definition: "How much your body bounces up and down with each step, shown as a percentage of your torso length.",
  },
];

export const MetricGuide: React.FC = () => (
  <section aria-labelledby="metric-guide-heading" className="space-y-5">
    <div>
      <p className="eyebrow">Reference</p>
      <h2 id="metric-guide-heading" className="mt-1 text-lg font-semibold text-ink">Metric guide</h2>
    </div>

    <dl className="panel divide-y divide-border">
      {definitions.map((item) => (
        <div key={item.name} className="grid gap-1 px-5 py-4 sm:grid-cols-[minmax(12rem,0.5fr)_minmax(0,2fr)] sm:gap-6">
          <dt className="text-sm font-semibold text-ink">{item.name}</dt>
          <dd className="text-sm leading-relaxed text-body">{item.definition}</dd>
        </div>
      ))}
    </dl>

    <div className="panel px-5 py-4">
      <h3 className="text-sm font-semibold text-ink">Research references</h3>
      <p className="mt-1 text-xs text-muted">Sources for the typical ranges used in the summary.</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-body">
        {references.map((reference) => (
          <li key={reference}>{reference}</li>
        ))}
      </ol>
    </div>
  </section>
);
