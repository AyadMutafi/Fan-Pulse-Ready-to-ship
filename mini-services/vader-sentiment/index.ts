/**
 * VADER Sentiment Pre-Filter Service
 *
 * A Bun-based HTTP service that wraps the Python VADER sentiment library.
 * Runs on port 3031. Accepts POST requests with text, returns sentiment scores.
 *
 * Used by the Fan Pulse EPL sentiment scanner to pre-filter social media posts
 * BEFORE sending them to the LLM chain (Grok → Cerebras → Groq → Z.ai).
 * This reduces API costs by ~60% by filtering out neutral posts.
 *
 * Usage:
 *   POST /score — body: { "texts": ["post 1", "post 2", ...] }
 *   Returns: { "results": [{ "text": "...", "compound": 0.75, "pos": 0.5, "neg": 0.0, "neu": 0.5, "label": "positive", "should_send_to_llm": true }, ...] }
 *
 *   POST /score-single — body: { "text": "single post text" }
 *   Returns: { "compound": 0.75, "pos": 0.5, "neg": 0.0, "neu": 0.5, "label": "positive", "should_send_to_llm": true }
 *
 *   GET /health — returns: { "status": "ok", "service": "vader-sentiment" }
 */

import { spawnSync } from "node:child_process";

const PORT = 3031;

// Threshold: posts with |compound| < this value are considered "neutral"
// and should NOT be sent to the LLM (saves API cost).
// 0.3 is a good default — filters out ~60% of neutral noise.
const NEUTRAL_THRESHOLD = 0.3;

// The Python script that does the actual VADER scoring
const PYTHON_SCRIPT = `
import json
import sys
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

analyzer = SentimentIntensityAnalyzer()

# Read input from stdin
input_data = json.loads(sys.stdin.read())

if isinstance(input_data, list):
    results = []
    for text in input_data:
        scores = analyzer.polarity_scores(text)
        compound = scores["compound"]
        if compound >= 0.05:
            label = "positive"
        elif compound <= -0.05:
            label = "negative"
        else:
            label = "neutral"
        results.append({
            "text": text,
            "compound": round(compound, 4),
            "pos": round(scores["pos"], 4),
            "neg": round(scores["neg"], 4),
            "neu": round(scores["neu"], 4),
            "label": label,
        })
    print(json.dumps(results))
elif isinstance(input_data, str):
    scores = analyzer.polarity_scores(input_data)
    compound = scores["compound"]
    if compound >= 0.05:
        label = "positive"
    elif compound <= -0.05:
        label = "negative"
    else:
        label = "neutral"
    result = {
        "compound": round(compound, 4),
        "pos": round(scores["pos"], 4),
        "neg": round(scores["neg"], 4),
        "neu": round(scores["neu"], 4),
        "label": label,
    }
    print(json.dumps(result))
`;

function scoreWithVader(input: string | string[]): any {
  const result = spawnSync("python3", ["-c", PYTHON_SCRIPT], {
    input: JSON.stringify(input),
    encoding: "utf-8",
    timeout: 5000,
  });

  if (result.error) {
    throw new Error(`VADER Python error: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`VADER Python exited with status ${result.status}: ${result.stderr}`);
  }

  const output = result.stdout.trim();
  if (!output) {
    throw new Error("VADER Python returned empty output");
  }

  return JSON.parse(output);
}

/**
 * Determine if a post should be sent to the LLM for deeper analysis.
 * Posts with strong sentiment (|compound| >= threshold) are worth the LLM cost.
 * Neutral posts are skipped — they don't contribute to sentiment aggregation.
 */
function shouldSendToLLM(compound: number): boolean {
  return Math.abs(compound) >= NEUTRAL_THRESHOLD;
}

// ── HTTP Server ───────────────────────────────────────────────────────────

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === "/health" && req.method === "GET") {
      return Response.json(
        { status: "ok", service: "vader-sentiment", port: PORT },
        { headers: corsHeaders }
      );
    }

    // Score single post
    if (url.pathname === "/score-single" && req.method === "POST") {
      try {
        const body = await req.json();
        const text = body.text;

        if (!text || typeof text !== "string") {
          return Response.json(
            { error: "Missing 'text' field" },
            { status: 400, headers: corsHeaders }
          );
        }

        const scores = scoreWithVader(text);
        const should_llm = shouldSendToLLM(scores.compound);

        return Response.json(
          { ...scores, should_send_to_llm: should_llm },
          { headers: corsHeaders }
        );
      } catch (err: any) {
        return Response.json(
          { error: "Scoring failed", details: err.message },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // Score batch of posts (main endpoint)
    if (url.pathname === "/score" && req.method === "POST") {
      try {
        const body = await req.json();
        const texts: string[] = body.texts;

        if (!Array.isArray(texts)) {
          return Response.json(
            { error: "Missing 'texts' array field" },
            { status: 400, headers: corsHeaders }
          );
        }

        if (texts.length === 0) {
          return Response.json(
            { results: [], total: 0, sent_to_llm: 0, filtered_out: 0 },
            { headers: corsHeaders }
          );
        }

        // Score all texts with VADER (runs in a single Python process)
        const scores = scoreWithVader(texts);

        // Add should_send_to_llm flag
        const results = scores.map((s: any) => ({
          ...s,
          should_send_to_llm: shouldSendToLLM(s.compound),
        }));

        // Count how many would be sent to LLM vs filtered
        const sentToLLM = results.filter((r: any) => r.should_send_to_llm).length;
        const filteredOut = results.length - sentToLLM;

        return Response.json(
          {
            results,
            total: results.length,
            sent_to_llm: sentToLLM,
            filtered_out: filteredOut,
            filter_rate: `${Math.round((filteredOut / results.length) * 100)}% filtered (neutral posts removed)`,
          },
          { headers: corsHeaders }
        );
      } catch (err: any) {
        return Response.json(
          { error: "Batch scoring failed", details: err.message },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // 404
    return Response.json(
      { error: "Not found", endpoints: ["/health", "/score", "/score-single"] },
      { status: 404, headers: corsHeaders }
    );
  },
});

console.log(`[vader-sentiment] Running on port ${PORT}`);
console.log(`[vader-sentiment] Endpoints:`);
console.log(`  GET  /health          — health check`);
console.log(`  POST /score-single    — score a single text`);
console.log(`  POST /score           — score a batch of texts (pre-filter)`);
console.log(`[vader-sentiment] Neutral threshold: ${NEUTRAL_THRESHOLD} (posts with |compound| < ${NEUTRAL_THRESHOLD} are filtered)`);
