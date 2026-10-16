// ============================================================================
// SCORING
// Turns raw PaintGrid stats + elapsed time into the final results breakdown.
// Weights are configurable and intentionally exported so they're easy to
// tune later without touching the math.
// ============================================================================

export const SCORE_WEIGHTS = {
  completion: 0.25,
  accuracy: 0.40,
  cleanliness: 0.15,
  time: 0.20,
};

function timeScore(elapsedSeconds, parTimeSeconds) {
  const ratio = elapsedSeconds / parTimeSeconds;
  if (ratio <= 1) return 1;
  return Math.max(0, 1 - (ratio - 1) * 0.8);
}

export function computeScore(paintStats, elapsedSeconds, job, weights = SCORE_WEIGHTS) {
  const completion = clamp01(paintStats.completion);
  const accuracy = clamp01(paintStats.accuracy);
  const cleanliness = clamp01(paintStats.cleanliness);
  const time = clamp01(timeScore(elapsedSeconds, job.parTimeSeconds));

  const total = completion * weights.completion
    + accuracy * weights.accuracy
    + cleanliness * weights.cleanliness
    + time * weights.time;

  return {
    completion, accuracy, cleanliness, time,
    total: clamp01(total),
    elapsedSeconds,
  };
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
