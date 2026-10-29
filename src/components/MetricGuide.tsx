import React from "react";

const guideSections = [
  {
    title: "Summary score",
    metrics: [
      {
        name: "Experimental composite",
        unit: "0-100 points",
        meaning: "A weighted combination of the app's rule-based cadence, knee symmetry, step-time consistency, and posture components.",
        context: "This is an experimental index, not a validated form rating. It is withheld when tracking or required inputs are insufficient.",
      },
      {
        name: "Cadence score",
        unit: "0-100 points",
        meaning: "A rule score based on estimated steps per minute.",
        context: "Uses fixed demonstration bands, not an individualized target.",
      },
      {
        name: "Symmetry score",
        unit: "0-100 points",
        meaning: "A rule-based complement of the paired knee-angle asymmetry percentage.",
        context: "It summarizes this app's calculation only; it is not a clinical symmetry assessment.",
      },
      {
        name: "Consistency score",
        unit: "0-100 points",
        meaning: "A rule-based 100 minus the coefficient of variation of detected step intervals.",
        context: "Requires sufficient detected gait events and is not a validated performance score.",
      },
      {
        name: "Posture score",
        unit: "0-100 points",
        meaning: "A rule score based on mean absolute trunk angle in the image.",
        context: "Its 3-10 degree app band is experimental. Camera orientation is not calibrated, so it is not an ideal-posture target or true forward lean.",
      },
      {
        name: "Efficiency score",
        unit: "Unavailable",
        meaning: "Not calculated.",
        context: "The video analysis does not measure the physiological or mechanical inputs needed for an efficiency score.",
      },
    ],
  },
  {
    title: "Gait and symmetry",
    metrics: [
      {
        name: "Cadence",
        unit: "steps/min",
        meaning: "Estimated step rate from alternating peaks in tracked left and right ankle trajectories.",
        context: "An algorithmic estimate, not a direct foot-contact or sensor measurement.",
      },
      {
        name: "Mean step interval",
        unit: "seconds",
        meaning: "Average elapsed time between detected alternating ankle events.",
        context: "Depends on the gait-event detector and the sampled video.",
      },
      {
        name: "Step-time variation",
        unit: "percent",
        meaning: "Coefficient of variation of detected event intervals: standard deviation relative to their mean.",
        context: "Requires enough events; it is not an injury or diagnostic measure.",
      },
      {
        name: "Step-time consistency",
        unit: "0-100 heuristic points",
        meaning: "The app's rule score computed as 100 minus step-time variation, limited to a minimum of zero.",
        context: "A higher value means lower variation under this rule, not a clinical judgment.",
      },
      {
        name: "Knee-angle asymmetry",
        unit: "percent",
        meaning: "Mean paired left/right internal knee-angle difference, normalized by the paired mean angle.",
        context: "Only frames with valid angles on both sides are compared.",
      },
      {
        name: "Knee symmetry score",
        unit: "0-100 heuristic points",
        meaning: "The app's rule score computed as 100 minus knee-angle asymmetry, limited to a minimum of zero.",
        context: "A rule-based summary, not a clinical symmetry threshold.",
      },
      {
        name: "Elbow-angle comparison",
        unit: "percent",
        meaning: "Similarity of the mean left and right elbow angles.",
        context: "It does not measure arm-swing amplitude or overall running efficiency.",
      },
      {
        name: "Pelvis vertical range",
        unit: "% of image-space body height",
        meaning: "Vertical image-space range of the tracked pelvis center, normalized by mean shoulder-to-hip pixel distance.",
        context: "Uncalibrated and affected by camera placement and view.",
      },
      {
        name: "Ankle-hip image offset",
        unit: "% of image-space body height",
        meaning: "Mean horizontal ankle-to-hip separation at detected gait events, normalized by torso pixel height.",
        context: "An image-space estimate, not a calibrated distance or a definitive overstride measurement.",
      },
      {
        name: "Hip-line image tilt",
        unit: "degrees",
        meaning: "Maximum absolute image-plane angle of the line between the left and right hip landmarks.",
        context: "A 2D landmark-derived view; camera roll and perspective affect it.",
      },
    ],
  },
  {
    title: "Joint angles and motion traces",
    metrics: [
      {
        name: "Internal knee angle",
        unit: "degrees",
        meaning: "2D angle at the knee formed by hip, knee, and ankle landmarks. Values nearer 180 degrees indicate a straighter configuration.",
        context: "The reported maximum and minimum are observed internal angles; they are not labelled as knee flexion.",
      },
      {
        name: "Hip angle",
        unit: "degrees",
        meaning: "2D angle formed by shoulder, hip, and knee landmarks for each side.",
        context: "Projected image-plane angle; not a 3D joint measurement.",
      },
      {
        name: "Elbow angle",
        unit: "degrees",
        meaning: "2D angle formed by shoulder, elbow, and wrist landmarks for each side.",
        context: "Projected image-plane angle; not arm-swing amplitude.",
      },
      {
        name: "Mean trunk image angle",
        unit: "degrees",
        meaning: "Mean absolute angle between the shoulder-to-hip line and image vertical.",
        context: "Camera orientation is not calibrated, so this is not true forward lean.",
      },
    ],
  },
];

export const MetricGuide: React.FC = () => (
  <section aria-labelledby="metric-guide-heading">
    <div className="mb-5 border-b border-border pb-4">
      <p className="eyebrow">Reference</p>
      <h2 id="metric-guide-heading" className="mt-1 text-lg font-semibold text-slate-900">Metric guide</h2>
    </div>
    <div className="space-y-8">
      {guideSections.map((section) => (
        <section key={section.title} aria-labelledby={`guide-${section.title.toLowerCase().replaceAll(" ", "-")}`}>
          <h3 id={`guide-${section.title.toLowerCase().replaceAll(" ", "-")}`} className="text-sm font-semibold text-slate-800">
            {section.title}
          </h3>
          <dl className="mt-3 divide-y divide-border border-y border-border">
            {section.metrics.map((item) => (
              <div key={item.name} className="grid gap-1 py-3 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(0,2fr)] sm:gap-6">
                <div>
                  <dt className="text-sm font-medium text-slate-800">{item.name}</dt>
                  <dd className="mt-0.5 text-[11px] text-slate-500">{item.unit}</dd>
                </div>
                <div className="grid gap-1 text-xs leading-relaxed text-slate-600 sm:grid-cols-2 sm:gap-5">
                  <dd>{item.meaning}</dd>
                  <dd className="text-slate-500">{item.context}</dd>
                </div>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <p className="border-t border-border pt-3 text-xs leading-relaxed text-slate-500">
        Ground-contact time and flight time are not included because this video analysis does not directly detect foot-ground contact.
        Missing or insufficient landmarks leave the affected measurement unavailable.
      </p>
    </div>
  </section>
);
