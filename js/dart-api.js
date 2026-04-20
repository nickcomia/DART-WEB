/**
 * DART v3 – Groq API Client
 * Text Analysis (NLP) + Photo Analysis (Groq Vision AI)
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

  // Compress image before sending
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
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.75).split(',')[1]);
      };
      img.onerror = function() { resolve(base64); };
      img.src = 'data:' + mediaType + ';base64,' + base64;
    });
  }

  // NLP text analysis via LLaMA 3.3 70B
  async function analyzeText(reviewText, platform, productName) {
    const apiKey = getKey();
    if (!apiKey) throw new Error('NO_API_KEY');
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: `You are DART (Deceptive Assessment and Review Tracking). Analyze this product review text for signs of deception using NLP.

Platform: ${platform || 'Unknown'}
Product: ${productName || 'Unknown'}
Review Text: """${reviewText}"""

Check for:
- Fake or forced emotions / unnatural sentiment
- Unnaturally uniform or templated writing style
- Keyword stuffing / overuse of product terms
- Unusual sentence structures
- AI-generated language patterns
- Signs of copied or duplicate content

Return ONLY valid JSON:
{
  "textRiskLevel": "LOW" or "MEDIUM" or "HIGH",
  "textDeceptionScore": 0-100,
  "textVerdict": "one sentence about the text",
  "findings": {
    "sentimentManipulation": "LOW|MEDIUM|HIGH – reason",
    "aiGeneratedLikelihood": "LOW|MEDIUM|HIGH – reason",
    "keywordStuffing": "LOW|MEDIUM|HIGH – reason",
    "linguisticUniformity": "LOW|MEDIUM|HIGH – reason"
  },
  "textSignals": ["signal1", "signal2", "signal3"]
}`
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

  // Photo analysis via Groq Vision AI (LLaMA 4 Scout)
  async function analyzePhoto(base64, mediaType, photoIndex, totalPhotos) {
    const apiKey = getKey();
    if (!apiKey) throw new Error('NO_API_KEY');
    const compressed = await compressImage(base64, mediaType);
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + compressed } },
            {
              type: 'text',
              text: `You are DART. Analyze this review photo (${photoIndex} of ${totalPhotos}) attached to a product review.

Check if this photo looks genuine or fake by examining:
- Is it an AI-generated image?
- Is it a stock photo or professional image not taken by a real buyer?
- Does it look like a real product photo taken by an actual customer?
- Are there any visual inconsistencies or signs of manipulation?

Return ONLY valid JSON:
{
  "photoRiskLevel": "LOW" or "MEDIUM" or "HIGH",
  "photoDeceptionScore": 0-100,
  "photoVerdict": "one sentence about this photo",
  "photoSignals": ["signal1", "signal2"]
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

  // Main analysis: text + photos combined
  async function analyzeReview(opts, onProgress) {
    // opts: { reviewText, platform, productName, photos: [{base64, mediaType}] }
    if (!getKey()) throw new Error('NO_API_KEY');

    var textResult = null;
    var photoResults = [];

    // Step 1: Analyze text
    if (opts.reviewText && opts.reviewText.trim()) {
      if (onProgress) onProgress('Analyzing review text...');
      textResult = await analyzeText(opts.reviewText, opts.platform, opts.productName);
    }

    // Step 2: Analyze each photo
    if (opts.photos && opts.photos.length > 0) {
      for (var i = 0; i < opts.photos.length; i++) {
        if (onProgress) onProgress('Analyzing photo ' + (i+1) + ' of ' + opts.photos.length + '...');
        try {
          var pr = await analyzePhoto(opts.photos[i].base64, opts.photos[i].mediaType, i+1, opts.photos.length);
          photoResults.push(pr);
        } catch(e) {
          console.warn('Photo ' + (i+1) + ' failed:', e.message);
        }
      }
    }

    // Step 3: Combine scores
    if (onProgress) onProgress('Combining results...');
    var combined = combineResults(textResult, photoResults);

    addLog({
      platform: opts.platform || 'Unknown',
      product: opts.productName || 'Unknown',
      riskLevel: combined.overallRiskLevel,
      score: combined.overallDeceptionScore,
      verdict: combined.verdict
    });

    return { textResult, photoResults, combined };
  }

  function combineResults(textResult, photoResults) {
    var scores = [];
    var signals = [];
    var verdicts = [];

    if (textResult) {
      scores.push(textResult.textDeceptionScore || 0);
      if (textResult.textSignals) signals = signals.concat(textResult.textSignals);
      if (textResult.textVerdict) verdicts.push('Text: ' + textResult.textVerdict);
    }

    photoResults.forEach(function(pr, i) {
      scores.push(pr.photoDeceptionScore || 0);
      if (pr.photoSignals) signals = signals.concat(pr.photoSignals);
      if (pr.photoVerdict) verdicts.push('Photo ' + (i+1) + ': ' + pr.photoVerdict);
    });

    var avgScore = scores.length > 0 ? Math.round(scores.reduce(function(a,b){return a+b;},0) / scores.length) : 0;
    var maxScore = scores.length > 0 ? Math.max.apply(null, scores) : 0;
    // Weighted: 60% average, 40% max
    var finalScore = Math.round(avgScore * 0.6 + maxScore * 0.4);

    var riskLevel = finalScore >= 65 ? 'HIGH' : finalScore >= 35 ? 'MEDIUM' : 'LOW';

    return {
      overallRiskLevel: riskLevel,
      overallDeceptionScore: finalScore,
      verdict: verdicts.join(' | ') || 'Analysis complete.',
      signals: signals,
      textResult: textResult,
      photoResults: photoResults
    };
  }

  return { getKey, analyzeReview, addLog, getLogs };
})();
