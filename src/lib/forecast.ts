/**
 * FanPulse forecast engine — pure TypeScript, zero runtime dependencies.
 *
 * Powers GET /api/forecast and the Momentum / Crisis Radar UI:
 *   1. buildHourlySeries()  — bucket posts into an hourly mean-sentiment series
 *   2. holtForecast()       — Holt double-exponential smoothing (level + trend)
 *   3. detectDeltaAnomalies() — z-score on the DELTA stream (first differences),
 *                              flags negative shocks only (crashes, not spikes)
 *   4. assessCrisis()       — combined verdict for a scope
 *
 * Design notes:
 *   - Chosen deliberately over heavier models (Chronos-2, TimesFM): fan
 *     sentiment series are short (48–72 points) and event-driven; Holt with
 *     sensible parameters performs comparably while running in-process with
 *     zero infrastructure. Swap-in path: keep the return shape of
 *     holtForecast() stable and a Python sidecar can replace the internals
 *     later without touching callers.
 *   - Raw-value z-score misses crashes on trending series (a 78→41 drop on a
 *     high plateau is not an outlier vs the global mean). Scoring the DELTA
 *     stream catches exactly the shocks fans perceive as crises.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface TimestampedScore {
  /** When the post/snapshot was made. Accepts Date or ISO string. */
  postedAt: Date | string;
  /** Sentiment score (0–100). null entries are skipped. */
  sentimentScore: number | null;
}

export interface SnapshotLike {
  takenAt: Date | string;
  sentiment: number | null | undefined;
}

export interface SeriesPoint {
  /** Epoch ms of the bucket start (floored to the hour). */
  t: number;
  /** Mean sentiment in the bucket (0–100 scale). */
  v: number;
}

export interface HoltForecast {
  /** Smoothed level at the end of the series. */
  level: number;
  /** Smoothed per-step trend (signed). */
  trend: number;
  /** `horizon` forecast points: level + (i+1) * trend. */
  forecast: number[];
  /** ± half-width of an ~80% prediction band. */
  band: number;
  /** Number of observations used. */
  n: number;
}

export interface Anomaly {
  /** Index in the input series of the point AFTER the shock. */
  index: number;
  /** Signed change at the shock (negative for crashes). */
  delta: number;
  /** Z-score of the delta vs the delta distribution (negative = shock). */
  z: number;
}

export type Momentum = 'RISING' | 'STABLE' | 'FALLING';

export interface CrisisAssessment {
  momentum: Momentum;
  anomalies: Anomaly[];
  /** True when at least one negative shock cleared the z-threshold. */
  isCrisis: boolean;
  forecast: HoltForecast | null;
}

const HOUR_MS = 3_600_000;

// ── Series building ──────────────────────────────────────────────────────────

/**
 * Bucket posts into hourly mean-sentiment points.
 *
 * Empty hours inside the window are carry-forward filled: a silent hour is NOT
 * a crash, and filling prevents spurious delta anomalies at gap boundaries.
 * Only buckets from the first to the last data point are emitted; when the
 * series exceeds `windowHours`, the newest window is kept.
 */
export function buildHourlySeries(posts: TimestampedScore[], windowHours = 48): SeriesPoint[] {
  const clean: { t: number; v: number }[] = [];
  for (const p of posts) {
    if (p == null || p.sentimentScore == null) continue;
    const t = typeof p.postedAt === 'string' ? Date.parse(p.postedAt) : p.postedAt.getTime();
    if (!Number.isFinite(t) || !Number.isFinite(p.sentimentScore)) continue;
    clean.push({ t, v: p.sentimentScore });
  }
  if (clean.length === 0) return [];
  clean.sort((a, b) => a.t - b.t);

  const startHour = Math.floor(clean[0].t / HOUR_MS);
  const endHour = Math.floor(clean[clean.length - 1].t / HOUR_MS);
  const buckets = new Map<number, { sum: number; n: number }>();
  for (const p of clean) {
    const h = Math.floor(p.t / HOUR_MS);
    const b = buckets.get(h) ?? { sum: 0, n: 0 };
    b.sum += p.v;
    b.n += 1;
    buckets.set(h, b);
  }

  const series: SeriesPoint[] = [];
  let last = clean[0].v; // carry-forward seed
  for (let h = startHour; h <= endHour; h++) {
    const b = buckets.get(h);
    if (b) last = b.sum / b.n;
    series.push({ t: h * HOUR_MS, v: last });
  }
  return series.length > windowHours ? series.slice(series.length - windowHours) : series;
}

/** Adapter: build an hourly series from PulseSnapshot-like rows. */
export function seriesFromSnapshots(snaps: SnapshotLike[], windowHours = 48): SeriesPoint[] {
  return buildHourlySeries(
    snaps.map((s) => ({ postedAt: s.takenAt, sentimentScore: s.sentiment ?? null })),
    windowHours
  );
}

// ── Forecasting (Holt double-exponential smoothing) ──────────────────────────

/**
 * Holt's linear method with warm start:
 *   level₀ = s₀, trend₀ = s₁ − s₀
 *   levelₜ = α·sₜ + (1−α)·(levelₜ₋₁ + trendₜ₋₁)
 *   trendₜ = β·(levelₜ − levelₜ₋₁) + (1−β)·trendₜ₋₁
 *
 * The prediction band is 1.2816σ of one-step-ahead residuals (~80% two-sided
 * interval). Returns null for series shorter than 2 points.
 */
export function holtForecast(
  series: number[],
  horizon = 6,
  alpha = 0.5,
  beta = 0.25
): HoltForecast | null {
  if (!Array.isArray(series) || series.length < 2) return null;

  let level = series[0];
  let trend = series[1] - series[0];
  const residuals: number[] = [];

  for (let i = 1; i < series.length; i++) {
    const pred = level + trend; // one-step-ahead prediction for series[i]
    residuals.push(series[i] - pred);
    const prevLevel = level;
    level = alpha * series[i] + (1 - alpha) * pred;
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  const forecast: number[] = [];
  for (let h = 1; h <= horizon; h++) forecast.push(level + h * trend);

  const mean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  const variance =
    residuals.length > 1
      ? residuals.reduce((a, r) => a + (r - mean) ** 2, 0) / (residuals.length - 1)
      : 0;

  return { level, trend, forecast, band: 1.2816 * Math.sqrt(variance), n: series.length };
}

// ── Crisis detection (delta-stream z-score) ──────────────────────────────────

/**
 * Z-score the DELTA stream (first differences) and flag negative shocks only.
 * Positive spikes (viral wins) are not crises — only collapses are.
 * Returns [] for series shorter than 3 points or with a degenerate delta
 * distribution (σ ≈ 0).
 */
export function detectDeltaAnomalies(series: number[], zThreshold = 2.0): Anomaly[] {
  if (!Array.isArray(series) || series.length < 3) return [];

  const deltas: number[] = [];
  for (let i = 1; i < series.length; i++) deltas.push(series[i] - series[i - 1]);

  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const variance = deltas.reduce((a, d) => a + (d - mean) ** 2, 0) / deltas.length;
  const std = Math.sqrt(variance);
  if (std < 1e-9) return [];

  const out: Anomaly[] = [];
  for (let i = 0; i < deltas.length; i++) {
    const z = (deltas[i] - mean) / std;
    if (z <= -zThreshold) out.push({ index: i + 1, delta: deltas[i], z });
  }
  return out;
}

export function assessMomentum(trend: number, threshold = 0.5): Momentum {
  if (trend > threshold) return 'RISING';
  if (trend < -threshold) return 'FALLING';
  return 'STABLE';
}

/**
 * Combined crisis verdict for a scope:
 *   1. Detect negative shocks (delta z-score ≤ −zThreshold).
 *   2. Trim the shocked points out of the series so the forecast isn't
 *      dragged by the outlier (shocks contaminate Holt's level/trend).
 *   3. Refit the forecast on the trimmed series; derive momentum from trend.
 */
export function assessCrisis(
  series: number[],
  opts: { horizon?: number; zThreshold?: number; momentumThreshold?: number } = {}
): CrisisAssessment {
  const { horizon = 6, zThreshold = 2.0, momentumThreshold = 0.5 } = opts;
  const anomalies = detectDeltaAnomalies(series, zThreshold);

  const trimmed = [...series];
  for (let i = anomalies.length - 1; i >= 0; i--) trimmed.splice(anomalies[i].index, 1);

  const forecast = holtForecast(trimmed.length >= 2 ? trimmed : series, horizon);
  return {
    momentum: forecast ? assessMomentum(forecast.trend, momentumThreshold) : 'STABLE',
    anomalies,
    isCrisis: anomalies.length > 0,
    forecast,
  };
}
