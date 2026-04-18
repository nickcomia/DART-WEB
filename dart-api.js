/**
 * DART v2 – Anthropic API + URL Scraping Client
 * ─────────────────────────────────────────────
 * Detects the platform from a URL, fetches product
 * data via a CORS proxy, then sends reviews to
 * Claude for deceptive review analysis.
 */

const DART = (function () {

  /* ── Storage helpers ── */
  const getKey = () => localStorage.getItem('dart_api_key') || '';
  const getLogs = () => JSON.parse(localStorage.getItem('dart_logs') || '[]');
  const saveLogs = (logs) => localStorage.setItem('dart_logs', JSON.stringify(logs));

  function addLog(entry) {
    const logs = getLogs();
    logs.unshift({ ...entry, ts: new Date().toLocaleString() });
    if (logs.length > 60) logs.pop();
    saveLogs(logs);
  }

  /* ── Platform detection ── */
  const PLATFORMS = [
    { id: 'amazon',     name: 'Amazon',      pattern: /amazon\.(com|co|ca|uk|de|fr|jp|in|com\.br|com\.mx|com\.au|com\.sg)/i },
    { id: 'shopee',     name: 'Shopee',      pattern: /shopee\.(ph|com|sg|co\.id|co\.th|com\.my|vn|com\.br)/i },
    { id: 'lazada',     name: 'Lazada',      pattern: /lazada\.(com\.ph|sg|com\.my|co\.th|co\.id|com\.vn)/i },
    { id: 'zalora',     name: 'Zalora',      pattern: /zalora\.(com\.ph|sg|com\.my|co\.th|co\.id)/i },
    { id: 'ebay',       name: 'eBay',        pattern: /ebay\.(com|co\.uk|de|com\.au|it|fr|es)/i },
    { id: 'temu',       name: 'Temu',        pattern: /temu\.com/i },
    { id: 'aliexpress', name: 'AliExpress',  pattern: /aliexpress\.com/i },
    { id: 'walmart',    name: 'Walmart',     pattern: /walmart\.com/i },
    { id: 'google',     name: 'Google',      pattern: /google\.(com|co)\/.*(maps|review|place)/i },
    { id: 'yelp',       name: 'Yelp',        pattern: /yelp\.com/i },
    { id: 'tripadvisor',name: 'TripAdvisor', pattern: /tripadvisor\.(com|co\.uk|com\.ph)/i },
  ];

  function detectPlatform(url) {
    try {
      const hostname = new URL(url).hostname;
      for (const p of PLATFORMS) {
        if (p.pattern.test(hostname) || p.pattern.test(url)) return p;
      }
    } catch (_) {}
    return { id: 'generic', name: 'Unknown Platform' };
  }

  /* ── CORS proxy fetch ──
     We try allorigins.win which is free and reliable for public pages.
     For production the team should deploy their own proxy or backend. */
  async function fetchViaProxy(url) {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const r = await fetch(proxyUrl, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error('Proxy fetch failed (' + r.status + ')');
    const data = await r.json();
    if (!data.contents) throw new Error('Empty proxy response');
    return data.contents;
  }

  /* ── Extract product info from raw HTML ──
     Uses Claude AI itself to parse the HTML intelligently. */
  async function extractProductDataWithAI(html, platformName, url) {
    const apiKey = getKey();
    // Truncate HTML to keep tokens manageable (keep head + first 8000 chars)
    const snippet = html.slice(0, 12000);

    const prompt = `You are a web scraping AI. Given the following HTML snippet from a ${platformName} product page, extract:
1. Product name
2. Product image URL (the main product image, should be a full URL starting with https)
3. Overall star rating (as a number like 4.3)
4. Total review count
5. Up to 8 recent customer reviews, each with: author name, star rating (1-5), review text

If any field is not found, use null. Reviews text should be the actual review body, not truncated.

HTML snippet:
\`\`\`
${snippet}
\`\`\`

Source URL: ${url}

Respond ONLY with valid JSON — no markdown, no explanation:
{
  "productName": "...",
  "productImage": "https://...",
  "overallRating": 4.3,
  "reviewCount": 1234,
  "reviews": [
    { "author": "...", "stars": 5, "text": "..." }
  ]
}`;

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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error('INVALID_API_KEY');
      throw new Error(err.error?.message || 'API error ' + response.status);
    }

    const data = await response.json();
    const text = data.content.map(b => b.text || '').join('');
    return parseJSON(text);
  }

  /* ── Analyze reviews with Claude ── */
  async function analyzeReviews(reviews, platformName, productName) {
    const apiKey = getKey();
    if (!apiKey) throw new Error('NO_API_KEY');

    const reviewBlock = reviews.map((r, i) =>
      `Review ${i + 1} [${r.stars || '?'}★] by "${r.author || 'Anonymous'}": "${r.text}"`
    ).join('\n\n');

    const prompt = `You are DART (Deceptive Assessment and Review Tracking), an AI system that detects deceptive, fake, or AI-generated product reviews.

Analyze the following ${reviews.length} reviews from ${platformName} for the product "${productName || 'Unknown Product'}". Apply multi-layer analysis: NLP text patterns, behavioral signals, linguistic uniformity, and AI-generated content detection.

REVIEWS:
${reviewBlock}

Return ONLY valid JSON (no markdown):
{
  "overallRiskLevel": "LOW" | "MEDIUM" | "HIGH",
  "overallDeceptionScore": <0-100>,
  "suspiciousCount": <number>,
  "authenticCount": <number>,
  "verdict": "<one clear sentence summarizing overall authenticity>",
  "patternsSummary": "<2-3 sentences on patterns detected across the reviews>",
  "signals": ["<signal 1>", "<signal 2>", "<signal 3>"],
  "findings": {
    "sentimentManipulation": "<LOW|MEDIUM|HIGH> – <reason>",
    "aiGeneratedLikelihood": "<LOW|MEDIUM|HIGH> – <reason>",
    "keywordStuffing": "<LOW|MEDIUM|HIGH> – <reason>",
    "linguisticUniformity": "<LOW|MEDIUM|HIGH> – <reason>"
  },
  "perReview": [
    { "index": 1, "riskLevel": "LOW|MEDIUM|HIGH", "deceptionScore": <0-100>, "flags": ["<flag>"] }
  ],
  "recommendation": "<clear actionable advice for the consumer>"
}`;

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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error('INVALID_API_KEY');
      throw new Error(err.error?.message || 'API error ' + response.status);
    }

    const data = await response.json();
    const text = data.content.map(b => b.text || '').join('');
    return parseJSON(text);
  }

  /* ── Single review text analysis ── */
  async function analyzeSingleText(opts) {
    const apiKey = getKey();
    if (!apiKey) throw new Error('NO_API_KEY');

    const prompt = `You are DART (Deceptive Assessment and Review Tracking), an AI that detects fake or deceptive product reviews.

Analyze this single review:
Platform: ${opts.platform || 'Unknown'}
Stars: ${opts.stars || 'Not provided'}
Reviewer Info: ${opts.reviewerInfo || 'Not provided'}
Review Text: """
${opts.text}
"""

Return ONLY valid JSON (no markdown):
{
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "deceptionScore": <0-100>,
  "verdict": "<one clear sentence>",
  "findings": {
    "sentimentManipulation": "<LOW|MEDIUM|HIGH> – <reason>",
    "aiGeneratedLikelihood": "<LOW|MEDIUM|HIGH> – <reason>",
    "keywordStuffing": "<LOW|MEDIUM|HIGH> – <reason>",
    "linguisticUniformity": "<LOW|MEDIUM|HIGH> – <reason>"
  },
  "signals": ["<signal 1>", "<signal 2>", "<signal 3>"],
  "summary": "<2-3 sentence analysis>",
  "recommendation": "<actionable advice>"
}`;

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
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error('INVALID_API_KEY');
      throw new Error(err.error?.message || 'API error ' + response.status);
    }

    const data = await response.json();
    const text = data.content.map(b => b.text || '').join('');
    return parseJSON(text);
  }

  /* ── JSON parser (strips code fences) ── */
  function parseJSON(text) {
    const cleaned = text
      .replace(/^```json\s*/i, '').replace(/\s*```$/, '')
      .replace(/^```\s*/, '').replace(/\s*```$/, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      // Try to extract JSON object
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error('Failed to parse AI response as JSON');
    }
  }

  /* ── Full URL-based analysis flow ── */
  async function analyzeURL(url) {
    if (!getKey()) throw new Error('NO_API_KEY');

    const platform = detectPlatform(url);

    // Step 1: Fetch page HTML via proxy
    let html;
    try {
      html = await fetchViaProxy(url);
    } catch (e) {
      throw new Error('Could not fetch the product page. The platform may block scrapers, or the URL is invalid. Try the Manual Review tab instead.');
    }

    // Step 2: Extract product data using AI
    let productData;
    try {
      productData = await extractProductDataWithAI(html, platform.name, url);
    } catch (e) {
      throw new Error('Could not parse product data: ' + e.message);
    }

    if (!productData.reviews || productData.reviews.length === 0) {
      throw new Error('No reviews found on this page. The platform may require login, or reviews may be loaded dynamically. Try the Manual Review tab.');
    }

    // Step 3: Analyze reviews
    const analysis = await analyzeReviews(productData.reviews, platform.name, productData.productName);

    // Log
    addLog({
      mode: 'url',
      platform: platform.name,
      product: productData.productName,
      riskLevel: analysis.overallRiskLevel,
      score: analysis.overallDeceptionScore,
      verdict: analysis.verdict
    });

    return { platform, productData, analysis };
  }

  /* ── Expose public API ── */
  return {
    getKey,
    detectPlatform,
    analyzeURL,
    analyzeReviews,
    analyzeSingleText,
    addLog,
    getLogs,
    saveLogs,
  };

})();
