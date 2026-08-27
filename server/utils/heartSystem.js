export const calculateHearts = (hearts, lastMs) => {
  const MAX_HEARTS = 3;
  const REGEN_TIME_MS = 2 * 60 * 1000; // 2 minutes

  // Already full — nothing to regenerate.
  if (hearts >= MAX_HEARTS) return { hearts, lastMs: Date.now() };

  // No timestamp recorded yet — treat as "now" so no regeneration occurs.
  if (lastMs == null || isNaN(lastMs)) return { hearts, lastMs: Date.now() };

  const now = Date.now();
  const diff = now - lastMs;

  if (diff >= REGEN_TIME_MS) {
    const regained = Math.floor(diff / REGEN_TIME_MS);
    hearts = Math.min(MAX_HEARTS, hearts + regained);
    lastMs = now;
  }
  return { hearts, lastMs };
};
