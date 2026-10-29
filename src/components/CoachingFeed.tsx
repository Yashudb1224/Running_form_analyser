import React from "react";
import { CompleteAnalysisReport } from "@/types/telemetry";
import { MetricValue } from "./MetricValue";

interface CoachingFeedProps {
  report: CompleteAnalysisReport;
}

export const CoachingFeed: React.FC<CoachingFeedProps> = ({ report }) => {
  const { gait, symmetry, formScore } = report;
  const cards = [
    { title: "Cadence events", metric: gait.cadenceSpm },
    { title: "Paired knee-angle comparison", metric: symmetry.kneeAngleAsymmetryPct },
    { title: "Step-time consistency index", metric: symmetry.strideConsistencyScore },
    { title: "Trunk posture score", metric: formScore.subScores.posture },
  ];

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-100 mb-1">Analysis Notes</h3>
        <p className="text-xs text-slate-400">
          These observations describe what the current 2D landmark pipeline can and cannot infer. They are not clinical coaching or injury-risk advice.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map(({ title, metric }) => (
          <div key={title} className="bg-surface rounded-xl p-5 border border-border">
            <h4 className="text-sm font-bold text-slate-100">{title}</h4>
            <div className="text-lg font-semibold text-primary mt-2"><MetricValue metric={metric} /></div>
            <p className="text-xs text-slate-400 mt-2">{metric.explanation}</p>
          </div>
        ))}
      </div>
      <div className="bg-surface rounded-xl p-5 border border-border">
        <h4 className="text-sm font-bold text-slate-100 mb-3">What the analysis found</h4>
        <ul className="space-y-2 text-sm text-slate-300 list-disc pl-5">
          {formScore.observations.map((observation, index) => <li key={`${index}-${observation}`}>{observation}</li>)}
        </ul>
      </div>
    </section>
  );
};
