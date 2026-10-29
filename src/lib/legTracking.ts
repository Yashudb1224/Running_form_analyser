import { FramePose, Landmark } from "../types/telemetry";

const MIN_VISIBILITY = 0.3;
/** Left/right landmark index pairs for the leg below the hip. */
const LEG_PAIRS: [number, number][] = [[25, 26], [27, 28], [29, 30], [31, 32]];
const TRACKING_PAIRS: [number, number][] = [[25, 26], [27, 28]];
/** Swap only when the swapped assignment is clearly more continuous than the current one. */
const SWAP_RATIO = 0.6;

function point(landmarks: (Landmark | null)[], index: number): Landmark | null {
  const value = landmarks[index];
  return value && (value.visibility ?? 0) >= MIN_VISIBILITY && Number.isFinite(value.x) && Number.isFinite(value.y) ? value : null;
}

function distance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function assignmentCost(current: (Landmark | null)[], previous: (Landmark | null)[], swapped: boolean): number | null {
  let total = 0;
  for (const [left, right] of TRACKING_PAIRS) {
    const currentLeft = point(current, left);
    const currentRight = point(current, right);
    const previousLeft = point(previous, left);
    const previousRight = point(previous, right);
    if (!currentLeft || !currentRight || !previousLeft || !previousRight) return null;
    total += swapped
      ? distance(currentLeft, previousRight) + distance(currentRight, previousLeft)
      : distance(currentLeft, previousLeft) + distance(currentRight, previousRight);
  }
  return total;
}

function swapLegs(landmarks: (Landmark | null)[]): (Landmark | null)[] {
  const swapped = [...landmarks];
  for (const [left, right] of LEG_PAIRS) {
    swapped[left] = landmarks[right];
    swapped[right] = landmarks[left];
  }
  return swapped;
}

/**
 * Pose models frequently swap the left and right legs in a side view, especially when the far leg is
 * occluded. Each frame's leg landmarks are re-assigned to whichever labelling moves the knees and
 * ankles least from the previous frame, so a leg keeps its identity through the clip.
 * Returns the corrected frames and the number of separate swap episodes that were fixed.
 */
export function correctLegSwaps(frames: FramePose[]): { frames: FramePose[]; swapEpisodes: number } {
  let previous: (Landmark | null)[] | null = null;
  let swapEpisodes = 0;
  let wasSwapped = false;

  const corrected = frames.map((frame) => {
    let landmarks = frame.landmarks;
    let isSwapped = false;
    if (previous) {
      const keep = assignmentCost(landmarks, previous, false);
      const swap = assignmentCost(landmarks, previous, true);
      if (keep !== null && swap !== null && swap < keep * SWAP_RATIO) {
        landmarks = swapLegs(landmarks);
        isSwapped = true;
      }
    }
    if (isSwapped && !wasSwapped) swapEpisodes++;
    if (assignmentCost(landmarks, landmarks, false) !== null) {
      previous = landmarks;
      wasSwapped = isSwapped;
    }
    return landmarks === frame.landmarks ? frame : { ...frame, landmarks };
  });

  return { frames: corrected, swapEpisodes };
}

/**
 * Share of frames (percent) where the two ankles and the two knees sit almost on top of each other,
 * a sign the pose model has placed both legs on the same physical leg.
 */
export function mergedLegFramePct(frames: FramePose[], torsoHeights: (number | null)[]): number | null {
  let checked = 0;
  let merged = 0;
  frames.forEach((frame, index) => {
    const torso = torsoHeights[index];
    if (!torso || torso <= 0) return;
    const leftAnkle = point(frame.landmarks, 27);
    const rightAnkle = point(frame.landmarks, 28);
    const leftKnee = point(frame.landmarks, 25);
    const rightKnee = point(frame.landmarks, 26);
    if (!leftAnkle || !rightAnkle || !leftKnee || !rightKnee) return;
    checked++;
    if (distance(leftAnkle, rightAnkle) < torso * 0.08 && distance(leftKnee, rightKnee) < torso * 0.08) merged++;
  });
  return checked ? (merged / checked) * 100 : null;
}
