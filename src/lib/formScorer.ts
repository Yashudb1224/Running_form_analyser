import { FormScoreData, GaitMetrics, KinematicSequence, SymmetryMetrics } from "@/types/telemetry";

export function calculateFormScore(
  kinematics: KinematicSequence,
  gait: GaitMetrics,
  symmetry: SymmetryMetrics
): FormScoreData {
  // 1. Cadence Sub-score
  const spm = gait.cadenceSpm;
  let cadenceScore = 90.0;
  let cadenceMsg = "";

  if (spm >= 165 && spm <= 185) {
    cadenceScore = 100.0;
    cadenceMsg = `Cadence of <strong>${spm} steps/min</strong> is in the optimal target zone (165–185 spm).`;
  } else if (spm >= 155 && spm < 165) {
    cadenceScore = 85.0;
    cadenceMsg = `Cadence of <strong>${spm} steps/min</strong> is slightly low. Target 165–180 spm to reduce stride impact force.`;
  } else if (spm < 155) {
    cadenceScore = 70.0;
    cadenceMsg = `Cadence of <strong>${spm} steps/min</strong> indicates overstriding. Consider taking shorter, quicker steps.`;
  } else {
    cadenceScore = 92.0;
    cadenceMsg = `Cadence of <strong>${spm} steps/min</strong> is high, suitable for sprint paces.`;
  }

  // 2. Posture Sub-score
  const trunkLeanArr = kinematics.trunkLeanAngles;
  const meanTrunk = trunkLeanArr.length > 0 ? trunkLeanArr.reduce((a, b) => a + b, 0) / trunkLeanArr.length : 6.0;
  let postureScore = 90.0;
  let postureMsg = "";

  if (meanTrunk >= 3.0 && meanTrunk <= 10.0) {
    postureScore = 100.0;
    postureMsg = `Average forward lean is <strong>${meanTrunk.toFixed(1)}°</strong>, representing optimal forward posture.`;
  } else if (meanTrunk >= 0.0 && meanTrunk < 3.0) {
    postureScore = 80.0;
    postureMsg = `Average forward lean is <strong>${meanTrunk.toFixed(1)}°</strong>, which is slightly upright. Lean forward from the ankles.`;
  } else if (meanTrunk > 10.0 && meanTrunk <= 15.0) {
    postureScore = 82.0;
    postureMsg = `Average forward lean is <strong>${meanTrunk.toFixed(1)}°</strong>, showing noticeable forward incline from the waist.`;
  } else {
    postureScore = 70.0;
    postureMsg = `Trunk lean of <strong>${meanTrunk.toFixed(1)}°</strong> deviates noticeably from optimal posture bounds.`;
  }

  // 3. Efficiency Sub-score (Ground Contact Time, Vertical Oscillation, Overstriding, Pelvic Drop)
  let gctScore = gait.groundContactTimeMs <= 230 ? 100 : Math.max(65, 100 - (gait.groundContactTimeMs - 230) * 0.5);
  let oscScore = gait.verticalOscillationCm <= 8.5 ? 100 : Math.max(65, 100 - (gait.verticalOscillationCm - 8.5) * 6.0);
  let overstrideScore = gait.overstrideDistanceCm <= 8.0 ? 100 : Math.max(60, 100 - (gait.overstrideDistanceCm - 8.0) * 5.0);
  let dropScore = gait.pelvicDropMaxDeg <= 4.5 ? 100 : Math.max(65, 100 - (gait.pelvicDropMaxDeg - 4.5) * 8.0);

  const efficiencyScore = Math.round((gctScore + oscScore + overstrideScore + dropScore) / 4);

  // 4. Composite Weighted Score
  const overallScore = Math.round(
    0.25 * symmetry.overallSymmetryScore +
    0.25 * symmetry.strideConsistencyScore +
    0.20 * cadenceScore +
    0.15 * postureScore +
    0.15 * efficiencyScore
  );

  let category = "Elite Running Form";
  if (overallScore < 75) {
    category = "Sub-optimal Form - Adjust Cadence & Overstriding";
  } else if (overallScore < 88) {
    category = "Good Form - Minor Efficiency Adjustments Advised";
  }

  const observations: string[] = [
    cadenceMsg,
    postureMsg,
    `Ground Contact Time is <strong>${gait.groundContactTimeMs}ms</strong> with a Duty Factor of <strong>${gait.dutyFactorPct}%</strong>.`,
    `Vertical Oscillation is <strong>${gait.verticalOscillationCm} cm</strong>, keeping energy directed forward.`,
    `Landing Brake Distance is <strong>${gait.overstrideDistanceCm} cm</strong> ahead of hip center.`,
    `Max Pelvic Drop is <strong>${gait.pelvicDropMaxDeg}°</strong>, indicating hip stability status.`
  ];

  if (gait.overstrideDistanceCm > 10.0) {
    observations.push(
      `Noticed overstriding brake force (<strong>${gait.overstrideDistanceCm} cm</strong> ahead of pelvis). Focus on landing feet under hips.`
    );
  }

  if (gait.pelvicDropMaxDeg > 5.0) {
    observations.push(
      `Lateral hip drop of <strong>${gait.pelvicDropMaxDeg}°</strong> detected. Gluteus medius strengthening exercises recommended.`
    );
  }

  return {
    overallScore,
    category,
    observations,
    subScores: {
      symmetry: symmetry.overallSymmetryScore,
      consistency: symmetry.strideConsistencyScore,
      cadence: cadenceScore,
      posture: postureScore,
      efficiency: efficiencyScore
    }
  };
}

