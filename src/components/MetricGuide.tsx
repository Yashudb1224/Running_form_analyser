import React from "react";
import { BASIS_LABELS, REFERENCE_RANGES } from "@/lib/researchReferences";

const definitions = [
  {
    name: "Cadence",
    unit: "steps/min",
    meaning: "60 divided by the median time between alternating left/right stance events, detected from the ankle trajectories with sub-frame peak timing.",
  },
  {
    name: "Shank angle at foot strike",
    unit: "degrees",
    meaning: "Angle of the knee-to-ankle line from vertical at the approximate moment of foot strike. Positive means the ankle lands ahead of the knee.",
  },
  {
    name: "Knee flexion at midstance",
    unit: "degrees",
    meaning: "Greatest knee bend (180° minus the internal knee angle) while the foot is on the ground.",
  },
  {
    name: "Forward trunk lean",
    unit: "degrees",
    meaning: "Mean angle of the hip-to-shoulder line from vertical, signed so that leaning in the running direction is positive.",
  },
  {
    name: "Symmetry index",
    unit: "percent",
    meaning: "|left − right| ÷ mean of both sides, for midstance knee flexion and for step time. The larger of the two is scored.",
  },
  {
    name: "Step-time variation",
    unit: "percent",
    meaning: "Coefficient of variation of step durations after removing intervals caused by missed events.",
  },
  {
    name: "Foot landing ahead of hip",
    unit: "% of torso length",
    meaning: "Horizontal distance from hip to ankle at foot strike, relative to shoulder-to-hip length. Reported without a score.",
  },
  {
    name: "Vertical oscillation",
    unit: "% of torso length",
    meaning: "Median per-step vertical range of the pelvis in the image. Not converted to centimetres.",
  },
];

export const MetricGuide: React.FC = () => (
  <section aria-labelledby="metric-guide-heading" className="space-y-6">
    <div>
      <p className="eyebrow">Reference</p>
      <h2 id="metric-guide-heading" className="mt-1 text-lg font-semibold text-ink">Metric guide and sources</h2>
    </div>

    <div className="panel p-5 text-sm leading-relaxed text-body">
      <h3 className="font-semibold text-ink">Are there official optimal values?</h3>
      <p className="mt-2">
        No. No sports-science body publishes a single correct cadence, lean or joint angle, and good form varies with speed,
        body size and injury history. What the research does provide is the ranges typically observed in healthy runners,
        clinical guidance on what to look for in video, and evidence for some directional changes, such as raising cadence
        by 5–10% to reduce knee and hip loading. This app compares your values with those ranges and cites the source for each.
      </p>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      {Object.values(REFERENCE_RANGES).map((reference) => (
        <article key={reference.id} className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">{reference.label}</h3>
            <span className="status-pill bg-success/10 text-success">{reference.minimum}–{reference.maximum} {reference.unit}</span>
          </div>
          <p className="mt-1 text-[11px] font-medium text-muted">{BASIS_LABELS[reference.basis]}</p>
          <p className="mt-3 text-xs leading-relaxed text-body">{reference.summary}</p>
          <p className="mt-2 text-xs leading-relaxed text-body">{reference.bandNote}</p>
          <ul className="mt-3 space-y-1 border-t border-border pt-3">
            {reference.citations.map((citation) => (
              <li key={citation.short} className="text-[11px] leading-relaxed text-muted">{citation.full}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>

    <div className="panel overflow-hidden">
      <h3 className="border-b border-border px-5 py-3 text-sm font-semibold text-ink">How each measure is calculated</h3>
      <dl className="divide-y divide-border">
        {definitions.map((item) => (
          <div key={item.name} className="grid gap-1 px-5 py-3 sm:grid-cols-[minmax(12rem,0.6fr)_minmax(0,2fr)] sm:gap-6">
            <div>
              <dt className="text-[13px] font-medium text-ink">{item.name}</dt>
              <dd className="mt-0.5 text-[11px] text-muted">{item.unit}</dd>
            </div>
            <dd className="text-xs leading-relaxed text-body">{item.meaning}</dd>
          </div>
        ))}
      </dl>
    </div>

    <div className="panel p-5 text-xs leading-relaxed text-body">
      <h3 className="text-sm font-semibold text-ink">Limits of 2D video</h3>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        <li>Angles are measured in the image plane. A camera that is not side-on, or one that is tilted, changes them.</li>
        <li>Foot strike is estimated from the ankle trajectory. At 30 frames/s, one frame is about 33 ms, so contact and flight times are not reported.</li>
        <li>Pose models occasionally swap the left and right legs in a side view, which can inflate asymmetry. Check the overlay if symmetry looks unusual.</li>
        <li>Distances are relative to torso length, not centimetres.</li>
        <li>This is a screening tool, not a medical or injury-risk assessment.</li>
      </ul>
    </div>
  </section>
);
