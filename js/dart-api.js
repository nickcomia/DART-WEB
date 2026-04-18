/**
 * DART v3 – Groq API Client (with Multi-Image Vision support)
 */
const DART = (function () {
  const getKey = () => localStorage.getItem('dart_api_key') || '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';

  function getLogs() {
    try { return JSON.parse(localStorage.getItem('dart_logs') || '[]'); } catch(_){ return []; }
  }
  function addLog(entry) {
    const logs = getLogs();
    logs.unshift({ ...entry, ts: new Date().toLocaleString() });
    if (logs.length > 60) logs.pop();
    localStorage.setItem('dart_logs', JSON.stringify(logs));
  }

  async function callGroq(prompt, maxTokens) {
    const apiKey = getKey();
    if (!apiKey) throw new Error('NO_API_KEY');
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: maxTokens || 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error('INVALID_API_KEY');
      throw new Error(e.error?.message || 'API error ' + res.status);
    }
    const data = await res.json();
    return parseJSON(data.choices[0].message.content);
  }

  async function callGroqVision(images, maxTokens) {
    const apiKey = getKey();
    if (!apiKey) throw new Error('NO_API_KEY');

    // Build content array: all images first, then the prompt text
    const content = images.map(function(img) {
      return {
        type: 'image_url',
        image_url: { url: 'data:' + img.mediaType + ';base64,' + img.base64 }
      };
    });

    content.push({
      type: 'text',
      text: `You are DART (Deceptive Assessment and Review Tracking), an expert at detecting fake and deceptive product reviews.

Analyze all ${images.length} screenshot(s) of product review pages. Extract ALL visible reviews across all images and analyze them for deception patterns.

Return ONLY valid JSON (no markdown, no explanation):
{
  "productName": "product name or Unknown",
  "platform": "detected platform or Unknown",
  "overallRiskLevel": "LOW" or "MEDIUM" or "HIGH",
  "overallDeceptionScore": 0-100,
  "suspiciousCount": number,
  "authenticCount": number,
  "verdict": "one sentence summary",
  "patternsSummary": "2-3 sentences about patterns found",
  "signals": ["signal1", "signal2", "signal3"],
  "findings": {
    "sentimentManipulation": "LOW|MEDIUM|HIGH – reason",
    "aiGeneratedLikelihood": "LOW|MEDIUM|HIGH – reason",
    "keywordStuffing": "LOW|MEDIUM|HIGH – reason",
    "linguisticUniformity": "LOW|MEDIUM|HIGH – reason"
  },
  "perReview": [{"index":1,"riskLevel":"LOW|MEDIUM|HIGH","deceptionScore":0-100,"text":"review text","flags":["flag"]}],
  "recommendation": "actionable advice for the consumer"
}`
    });

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: maxTokens || 2000,
        messages: [{ role: 'user', content: content }]
      })
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error('INVALID_API_KEY');
      throw new Error(e.error?.message || 'API error ' + res.status);
    }
    const data = await res.json();
    return parseJSON(data.choices[0].message.content);
  }

  function parseJSON(text) {
    const clean = text.replace(/^```json\s*/i,'').replace(/\s*```$/,'').replace(/^```/,'').replace(/```$/,'').trim();
    try { return JSON.parse(clean); }
    catch(_) {
      const m = clean.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error('Could not parse AI response');
    }
  }

  async function analyzeImages(images) {
    if (!getKey()) throw new Error('NO_API_KEY');
    const result = await callGroqVision(images);
    addLog({ mode:'image', platform: result.platform||'Unknown', product: result.productName||'Unknown', riskLevel: result.overallRiskLevel, score: result.overallDeceptionScore, verdict: result.verdict });
    return result;
  }

  async function analyzeReviews(reviews, platform, productName) {
    const block = reviews.map((r,i)=>`Review ${i+1} [${r.stars||'?'}★] by "${r.author||'Anonymous'}": "${r.text}"`).join('\n\n');
    const result = await callGroq(`You are DART (Deceptive Assessment and Review Tracking). Analyze these ${reviews.length} reviews from ${platform} for "${productName||'this product'}".

${block}

Return ONLY valid JSON:
{
  "overallRiskLevel": "LOW"|"MEDIUM"|"HIGH",
  "overallDeceptionScore": 0-100,
  "suspiciousCount": number,
  "authenticCount": number,
  "verdict": "one sentence",
  "patternsSummary": "2-3 sentences",
  "signals": ["signal1","signal2","signal3"],
  "findings": {
    "sentimentManipulation": "LOW|MEDIUM|HIGH – reason",
    "aiGeneratedLikelihood": "LOW|MEDIUM|HIGH – reason",
    "keywordStuffing": "LOW|MEDIUM|HIGH – reason",
    "linguisticUniformity": "LOW|MEDIUM|HIGH – reason"
  },
  "perReview": [{"index":1,"riskLevel":"LOW|MEDIUM|HIGH","deceptionScore":0-100,"flags":["flag"]}],
  "recommendation": "actionable advice"
}`, 1500);
    return result;
  }

  async function analyzeSingle(opts) {
    const result = await callGroq(`You are DART. Analyze this single product review:
Platform: ${opts.platform||'Unknown'}
Stars: ${opts.stars||'?'}
Reviewer: ${opts.reviewer||'Unknown'}
Text: """${opts.text}"""

Return ONLY valid JSON:
{
  "riskLevel": "LOW"|"MEDIUM"|"HIGH",
  "deceptionScore": 0-100,
  "verdict": "one sentence",
  "findings": {
    "sentimentManipulation": "LOW|MEDIUM|HIGH – reason",
    "aiGeneratedLikelihood": "LOW|MEDIUM|HIGH – reason",
    "keywordStuffing": "LOW|MEDIUM|HIGH – reason",
    "linguisticUniformity": "LOW|MEDIUM|HIGH – reason"
  },
  "signals": ["signal1","signal2","signal3"],
  "summary": "2-3 sentences",
  "recommendation": "actionable advice"
}`, 1000);
    return result;
  }

  function detectPlatform(url) {
    const PLATFORMS = [
      { id:'amazon', name:'Amazon', re:/amazon\./i },
      { id:'shopee', name:'Shopee', re:/shopee\./i },
      { id:'lazada', name:'Lazada', re:/lazada\./i },
      { id:'zalora', name:'Zalora', re:/zalora\./i },
      { id:'ebay',   name:'eBay',   re:/ebay\./i },
      { id:'temu',   name:'Temu',   re:/temu\.com/i },
      { id:'aliexpress', name:'AliExpress', re:/aliexpress/i },
      { id:'walmart', name:'Walmart', re:/walmart/i },
      { id:'yelp',   name:'Yelp',   re:/yelp\./i },
      { id:'tripadvisor', name:'TripAdvisor', re:/tripadvisor/i },
    ];
    try {
      const h = new URL(url).hostname;
      for (const p of PLATFORMS) if (p.re.test(h)) return p;
    } catch(_){}
    return { id:'generic', name:'Unknown Platform' };
  }

  return { getKey, analyzeImages, analyzeReviews, analyzeSingle, addLog, getLogs, detectPlatform };
})();
