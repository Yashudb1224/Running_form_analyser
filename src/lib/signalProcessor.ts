/**
 * Signal Processing Utilities for Smoothing Kinematic Trajectories (Moving Average / Savitzky-Golay equivalent).
 */

export function smoothArray(data: number[], windowSize: number = 7): number[] {
  if (data.length === 0) return [];
  if (data.length < windowSize) return [...data];

  const half = Math.floor(windowSize / 2);
  const smoothed: number[] = new Array(data.length);

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(data.length - 1, i + half);

    let sum = 0;
    let count = 0;

    for (let j = start; j <= end; j++) {
      sum += data[j];
      count++;
    }

    smoothed[i] = sum / count;
  }

  return smoothed;
}
