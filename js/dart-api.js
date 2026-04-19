/**
 * DART v3 – Groq API Client (Multi-Image Vision)
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

  // Resize image to max 800px and compress to reduce base64 size
  async function compressImage(base64, mediaType) {
    return new Promise(function(resolve) {
      var img = new Image();
      img.onload = function() {
        var maxSize = 800;
        var w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        var compressed = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
        resolve(compressed);
      };
      img.onerror = function() { resolve(base64); };
      img.src = 'data:' + mediaType + ';base64,' + base64;
    });
  }

  // Analyze a single image via Groq vision
  async function callGroqVisionSingle(base64Image, mediaType, imgIndex, totalImgs) {
    const apiKey = getKey();
    if (!apiKey) throw new Error('NO_API_KEY');
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: 'data:image/jpeg;base64,' + base64Image }
            },
            {
              type: 'text',
              text: `You are DART (Deceptive Assessment and Review Tracking). This is screenshot ${imgIndex} of ${totalImgs} from a product review page.

Extract ALL visible customer reviews from this screenshot. For each review include the text, star rating if visible, and any suspicious patterns.

Return ONLY valid JSON:
{
  "productName": "product name or Unknown",
  "platform": "detected platform (Shopee/Lazada/Amazon/etc) or Unknown",
  "reviews": [
    {
      "index": 1,
      "text": "full review text",
      "stars": 5,
      "author": "reviewer name or Anonymous",
      "flags": ["any suspicious patterns noticed"]
    }
  ]
}`
            }
          ]
        }]
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

  async function analyzeImages(images, onProgress) {
    if (!getKey()) throw new Error('NO_API_KEY');

    // Step 1: Extract reviews from each image one by one
    var allReviews = [];
    var productName = 'Unknown';
    var platform = 'Unknown';

    for (var i = 0; i < images.length; i++) {
      if (onProgress) onProgress('Compressing image ' + (i+1) + ' of ' + images.length + '...');
      var compressed = await compressImage(images[i].base64, images[i].mediaType);

      if (onProgress) onProgress('Reading screenshot ' + (i+1) + ' of ' + images.length + '...');
      try {
        var extracted = await callGroqVisionSingle(compressed, 'image/jpeg', i+1, images.length);
        if (extracted.productName && extracted.productName !== 'Unknown') productName = extracted.productName;
        if (extracted.platform && extracted.platform !== 'Unknown') platform = extracted.platform;
        if (extracted.reviews && extracted.reviews.length) {
          extracted.reviews.forEach(function(r) { allReviews.push(r); });
        }
      } catch(e) {
        console.warn('Failed to extract from image ' + (i+1) + ':', e.message);
      }
    }

    if (allReviews.length === 0) {
      throw new Error('No reviews could be extracted from the screenshots. Make sure the screenshots clearly show review text.');
    }

    // Step 2: Analyze all extracted reviews together
    if (onProgress) onProgress('Analyzing ' + allReviews.length + ' reviews for deception...');
    var analysis = await analyzeReviews(allReviews, platform, productName);

    addLog({ mode:'image', platform: platform, product: productName, riskLevel: analysis.overallRiskLevel, score: analysis.overallDeceptionScore, verdict: analysis.verdict });

    return { productName, platform, analysis };
  }

  async function analyzeReviews(reviews, platform, productName) {
    const block = reviews.map((r,i) => {
      var text = r.text || (typeof r === 'string' ? r : JSON.stringify(r));
      var stars = r.stars || r.star || '?';
      var author = r.author || 'Anonymous';
      return 'Review ' + (i+1) + ' [' + stars + '★] by "' + author + '": "' + text + '"';
    }).join('\n\n');

    const result = await callGroq(`You are DART (Deceptive Assessment and Review Tracking). Analyze these ${reviews.length} reviews from ${platform||'Unknown'} for "${productName||'this product'}".

${block}

Return ONLY valid JSON:
{
  "overallRiskLevel": "LOW" or "MEDIUM" or "HIGH",
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

  return { getKey, analyzeImages, analyzeReviews, addLog, getLogs, detectPlatform };
})();
