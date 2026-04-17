/**
 * DART – Anthropic API Client
 * Sends review data to Claude for deceptive review analysis.
 */

const DART_API = (function () {

  function getApiKey() {
    return localStorage.getItem('dart_api_key') || '';
  }

  /**
   * Build the prompt for Claude
   */
  function buildPrompt(mode, data) {
    if (mode === 'text') {
      return `You are DART (Deceptive Assessment and Review Tracking), an AI system that detects deceptive, fake, or AI-generated product reviews.

Analyze the following product review and return a structured JSON analysis. Be thorough and evidence-based.

PLATFORM: ${data.platform || 'Unknown'}
REVIEW TEXT: """
${data.reviewText}
"""
STAR RATING: ${data.stars || 'Not provided'}
REVIEWER INFO: ${data.reviewerInfo || 'Not provided'}

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "deceptionScore": <number 0-100>,
  "verdict": "<one-sentence verdict>",
  "findings": {
    "sentimentManipulation": "<LOW|MEDIUM|HIGH> – <brief explanation>",
    "aiGeneratedLikelihood": "<LOW|MEDIUM|HIGH> – <brief explanation>",
    "keywordStuffing": "<LOW|MEDIUM|HIGH> – <brief explanation>",
    "linguisticUniformity": "<LOW|MEDIUM|HIGH> – <brief explanation>"
  },
  "signals": [
    "<signal 1>",
    "<signal 2>",
    "<signal 3>"
  ],
  "summary": "<2-3 sentence detailed explanation of findings>",
  "recommendation": "<actionable recommendation for the consumer>"
}`;
    }

    if (mode === 'batch') {
      const reviewLines = data.reviews.map((r, i) =>
        `Review ${i + 1} [${r.stars}★] by "${r.author || 'Unknown'}": "${r.text}"`
      ).join('\n\n');

      return `You are DART (Deceptive Assessment and Review Tracking), an AI system that detects deceptive, fake, or AI-generated product reviews.

Analyze the following ${data.reviews.length} product reviews from ${data.platform || 'an e-commerce platform'} and return a structured JSON analysis of the FULL BATCH.

REVIEWS:
${reviewLines}

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "overallRiskLevel": "LOW" | "MEDIUM" | "HIGH",
  "overallDeceptionScore": <number 0-100>,
  "suspiciousCount": <number>,
  "authenticCount": <number>,
  "verdict": "<one-sentence overall verdict>",
  "patternsSummary": "<2-3 sentences about patterns detected across reviews>",
  "perReview": [
    {
      "index": <1-based index>,
      "riskLevel": "LOW" | "MEDIUM" | "HIGH",
      "deceptionScore": <0-100>,
      "flags": ["<flag1>", "<flag2>"]
    }
  ],
  "signals": ["<signal 1>", "<signal 2>", "<signal 3>"],
  "recommendation": "<actionable recommendation>"
}`;
    }
  }

  /**
   * Call Anthropic API
   */
  async function callClaude(prompt) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('NO_API_KEY');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error('INVALID_API_KEY');
      throw new Error(err.error?.message || `API error ${response.status}`);
    }

    const data = await response.json();
    const text = data.content.map(b => b.text || '').join('');

    // Strip any markdown code fences
    const cleaned = text.replace(/```json[\s\S]*?```/g, match =>
      match.replace(/```json\n?/, '').replace(/\n?```/, '')
    ).replace(/```[\s\S]*?```/g, match =>
      match.replace(/```\n?/, '').replace(/\n?```/, '')
    ).trim();

    return JSON.parse(cleaned);
  }

  /**
   * Analyze a single review text
   */
  async function analyzeSingleReview(opts) {
    const prompt = buildPrompt('text', opts);
    return await callClaude(prompt);
  }

  /**
   * Analyze a batch of reviews
   */
  async function analyzeBatchReviews(opts) {
    const prompt = buildPrompt('batch', opts);
    return await callClaude(prompt);
  }

  return { analyzeSingleReview, analyzeBatchReviews, getApiKey };
})();
