/**
 * DART v3 – Groq API Client
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

  function parseJSON(text) {
    const clean = text.replace(/^```json\s*/i,'').replace(/\s*```$/,'').replace(/^```/,'').replace(/```$/,'').trim();
    try { return JSON.parse(clean); }
    catch(_) {
      const m = clean.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error('Could not parse AI response');
    }
  }

  async function fetchPage(url) {
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const r = await fetch(proxy, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error('Proxy error ' + r.status);
    const d = await r.json();
    if (!d.contents) throw new Error('Empty proxy response');
    return d.contents;
  }

  async function extractFromHTML(html, platformName, url) {
    const snippet = html.slice(0, 14000);
    return callGroq(`You are a web scraping AI. Extract from this ${platformName} product page HTML:
1. Product name
2. Main product image URL (full https URL)
3. Overall star rating (number)
4. Total review count
5. Up to 8 customer reviews with: author, stars (1-5), text

Return ONLY valid JSON, no markdown:
{
  "productName": "...",
  "productImage": "https://...",
  "overallRating": 4.3,
  "reviewCount": 1234,
  "reviews": [{"author":"...","stars":5,"text":"..."}]
}

Source URL: ${url}
HTML:
\`\`\`
${snippet}
\`\`\``, 1500);
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

  async function analyzeURL(url) {
    if (!getKey()) throw new Error('NO_API_KEY');
    const platform = detectPlatform(url);
    let html;
    try { html = await fetchPage(url); }
    catch(e) { throw new Error('Could not fetch the product page. The site may block automated access. Use Manual Review instead.'); }
    let productData;
    try { productData = await extractFromHTML(html, platform.name, url); }
    catch(e) { throw new Error('Could not extract product data: ' + e.message); }
    if (!productData.reviews || !productData.reviews.length)
      throw new Error('No reviews found. The site may load reviews via JavaScript. Use Manual Review instead.');
    const analysis = await analyzeReviews(productData.reviews, platform.name, productData.productName);
    addLog({ mode:'url', platform:platform.name, product:productData.productName, riskLevel:analysis.overallRiskLevel, score:analysis.overallDeceptionScore, verdict:analysis.verdict });
    return { platform, productData, analysis };
  }

  const PLATFORMS = [
    { id:'amazon',      name:'Amazon',      re:/amazon\./i },
    { id:'shopee',      name:'Shopee',      re:/shopee\./i },
    { id:'lazada',      name:'Lazada',      re:/lazada\./i },
    { id:'zalora',      name:'Zalora',      re:/zalora\./i },
    { id:'ebay',        name:'eBay',        re:/ebay\./i },
    { id:'temu',        name:'Temu',        re:/temu\.com/i },
    { id:'aliexpress',  name:'AliExpress',  re:/aliexpress/i },
    { id:'walmart',     name:'Walmart',     re:/walmart/i },
    { id:'yelp',        name:'Yelp',        re:/yelp\./i },
    { id:'tripadvisor', name:'TripAdvisor', re:/tripadvisor/i },
  ];

  function detectPlatform(url) {
    try {
      const h = new URL(url).hostname;
      for (const p of PLATFORMS) if (p.re.test(h)) return p;
    } catch(_){}
    return { id:'generic', name:'Unknown Platform' };
  }

  return { getKey, analyzeURL, analyzeReviews, analyzeSingle, addLog, getLogs, detectPlatform };
})();
