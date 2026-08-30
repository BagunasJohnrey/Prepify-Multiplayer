import api from './api';

const QUIZ_CACHE_KEY = 'prepify_quiz_cache_v1';

export function getCachedQuizzes() {
  try {
    const raw = localStorage.getItem(QUIZ_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.quizzes) || typeof parsed.version !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setCachedQuizzes(quizzes, version) {
  try {
    localStorage.setItem(QUIZ_CACHE_KEY, JSON.stringify({ quizzes, version, cachedAt: Date.now() }));
  } catch {
    // storage full / unavailable — skip caching
  }
}

export function clearQuizCache() {
  try {
    localStorage.removeItem(QUIZ_CACHE_KEY);
  } catch { /* noop */ }
}

/**
 * Loads quizzes with cache-first strategy:
 * 1. Return cached list immediately (sync).
 * 2. Check the cheap /quizzes/version endpoint; only refetch the full list when it changed.
 * Returns { quizzes, fromCache, refreshed }.
 */
export async function loadQuizzesWithCache() {
  const cached = getCachedQuizzes();

  // No cache: must fetch everything
  if (!cached) {
    const { data } = await api.get('/quizzes');
    const list = Array.isArray(data) ? data : [];
    let version = null;
    try {
      const v = await api.get('/quizzes/version');
      version = v.data?.version;
    } catch { /* version endpoint optional */ }
    if (version) setCachedQuizzes(list, version);
    return { quizzes: list, fromCache: false, refreshed: true };
  }

  // Have cache: verify version cheaply
  try {
    const { data } = await api.get('/quizzes/version');
    if (data?.version === cached.version) {
      return { quizzes: cached.quizzes, fromCache: true, refreshed: false };
    }
    // Version changed: refetch full list
    const full = await api.get('/quizzes');
    const list = Array.isArray(full.data) ? full.data : [];
    setCachedQuizzes(list, data.version);
    return { quizzes: list, fromCache: false, refreshed: true };
  } catch {
    // Version check failed (offline etc.): fall back to cache
    return { quizzes: cached.quizzes, fromCache: true, refreshed: false };
  }
}
