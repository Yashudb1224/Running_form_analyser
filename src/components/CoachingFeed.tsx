import React from "react";
import { CompleteAnalysisReport } from "@/types/telemetry";

interface CoachingFeedProps {
  report: CompleteAnalysisReport;
}

export const CoachingFeed: React.FC<CoachingFeedProps> = ({ report }) => {
  const { cadence } = { cadence: report.gait.cadenceSpm };
  const symmetryScore = report.symmetry.overallSymmetryScore;
  const trunkLeanArr = report.kinematics.trunkLeanAngles;
  const meanTrunk = trunkLeanArr.length > 0 ? trunkLeanArr.reduce((a, b) => a + b, 0) / trunkLeanArr.length : 6.0;

  // Cadence Card Info
  let cadTitle = "Step Rate & Cadence: Optimal Stride Frequency";
  let cadColor = "#00FF66";
  let cadDesc = `Your cadence of <strong>${cadence} steps per minute</strong> falls within the ideal target zone (165–185 spm). This step frequency minimizes vertical impact forces and protects your joints.`;
  let cadAction = "<strong>Maintain Form:</strong> Keep up this rhythmic stride pattern during long runs.";

  if (cadence < 165) {
    cadTitle = "Step Rate & Cadence: Low Cadence (Overstriding Risk)";
    cadColor = "#FFB800";
    cadDesc = `Your current cadence is <strong>${cadence} steps per minute</strong>. Taking slower, longer steps increases ground impact force and causes your foot to land far in front of your hips.`;
    cadAction = "<strong>Actionable Correction:</strong> Increase your step rate by taking shorter, quicker strides. Focus on landing feet closer under your center of mass.";
  } else if (cadence > 185) {
    cadTitle = "Step Rate & Cadence: High Step Rate";
    cadColor = "#00E5FF";
    cadDesc = `Your current cadence is <strong>${cadence} steps per minute</strong>. Quick steps reduce ground contact time, but ensure your stride maintains adequate hip extension behind your body.`;
    cadAction = "<strong>Actionable Correction:</strong> Focus on pushing backward through your glutes to maximize forward drive.";
  }

  // Posture Card Info
  let posTitle = "Body Posture & Lean: Optimal Forward Incline";
  let posColor = "#00FF66";
  let posDesc = `Your average forward lean is <strong>${meanTrunk.toFixed(1)}°</strong> (ideal target: 5°–10°). You are maintaining an efficient posture that promotes forward momentum.`;
  let posAction = "<strong>Maintain Form:</strong> Keep shoulders relaxed and maintain this ankle-driven forward incline.";

  if (meanTrunk < 3.0) {
    posTitle = "Body Posture & Lean: Upright / Leaning Backward";
    posColor = "#FF4B4B";
    posDesc = `Your average forward lean angle is <strong>${meanTrunk.toFixed(1)}°</strong>. Running overly vertical forces your quadriceps to absorb extra shock and limits forward momentum.`;
    posAction = "<strong>Actionable Correction:</strong> Lean forward slightly from the ankles (not from the waist), allowing gravity to assist your forward movement.";
  } else if (meanTrunk > 10.0) {
    posTitle = "Body Posture & Lean: Excessive Forward Bending";
    posColor = "#FFB800";
    posDesc = `Your average forward lean angle is <strong>${meanTrunk.toFixed(1)}°</strong>. Bending forward excessively at the waist can cause lower back fatigue and restrict deep breathing.`;
    posAction = "<strong>Actionable Correction:</strong> Engage your core, keep your chest open, and maintain a tall spine.";
  }

  // Symmetry Card Info
  let symTitle = "Limb Symmetry: Balanced Left & Right Movement";
  let symColor = "#00FF66";
  let symDesc = `Your bilateral symmetry score is <strong>${symmetryScore}%</strong>. Your left and right legs move with equal power and flexion angles.`;
  let symAction = "<strong>Benefit:</strong> Equal workload distribution minimizes your risk of single-sided overuse injuries.";

  if (symmetryScore < 90) {
    symTitle = "Limb Symmetry: Asymmetry Detected";
    symColor = "#FFB800";
    symDesc = `Your bilateral symmetry score is <strong>${symmetryScore}%</strong>. There is a noticeable difference in knee flexion or stride dynamics between your left and right legs.`;
    symAction = "<strong>Actionable Correction:</strong> Perform single-leg strength exercises (lunges, single-leg deadlifts) to balance limb strength.";
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-100 mb-2">
        Form Breakdown & Plain-English Coaching Feedback
      </h3>

      {/* Cadence Card */}
      <div className="bg-surface rounded-xl p-5 border border-border" style={{ borderLeftWidth: "5px", borderLeftColor: cadColor }}>
        <h4 className="text-base font-bold mb-2" style={{ color: cadColor }}>{cadTitle}</h4>
        <p className="text-sm text-slate-300 leading-relaxed mb-3" dangerouslySetInnerHTML={{ __html: cadDesc }} />
        <div className="bg-card/70 px-4 py-2.5 rounded-lg text-xs text-slate-200" dangerouslySetInnerHTML={{ __html: cadAction }} />
      </div>

      {/* Posture Card */}
      <div className="bg-surface rounded-xl p-5 border border-border" style={{ borderLeftWidth: "5px", borderLeftColor: posColor }}>
        <h4 className="text-base font-bold mb-2" style={{ color: posColor }}>{posTitle}</h4>
        <p className="text-sm text-slate-300 leading-relaxed mb-3" dangerouslySetInnerHTML={{ __html: posDesc }} />
        <div className="bg-card/70 px-4 py-2.5 rounded-lg text-xs text-slate-200" dangerouslySetInnerHTML={{ __html: posAction }} />
      </div>

      {/* Symmetry Card */}
      <div className="bg-surface rounded-xl p-5 border border-border" style={{ borderLeftWidth: "5px", borderLeftColor: symColor }}>
        <h4 className="text-base font-bold mb-2" style={{ color: symColor }}>{symTitle}</h4>
        <p className="text-sm text-slate-300 leading-relaxed mb-3" dangerouslySetInnerHTML={{ __html: symDesc }} />
        <div className="bg-card/70 px-4 py-2.5 rounded-lg text-xs text-slate-200" dangerouslySetInnerHTML={{ __html: symAction }} />
      </div>
    </div>
  );
};
