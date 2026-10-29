export function smoothArray(data: (number | null)[], windowSize = 7): (number | null)[] {
  if (data.length === 0 || windowSize < 1) return [...data];

  const half = Math.floor(windowSize / 2);
  return data.map((value, index) => {
    if (value === null || !Number.isFinite(value)) return null;

    let sum = 0;
    let count = 0;
    for (let cursor = Math.max(0, index - half); cursor <= Math.min(data.length - 1, index + half); cursor++) {
      const sample = data[cursor];
      if (sample !== null && Number.isFinite(sample)) {
        sum += sample;
        count++;
      }
    }
    return count > 0 ? sum / count : null;
  });
}
