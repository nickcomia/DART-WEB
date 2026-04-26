/**
 * DART v4 – Client API
 * Detection, Analysis, and Real-Time Tracking of Deceptive Product Reviews
 */
const DART = (function () {

  // API key — stored here for GitHub Pages deployment
  const KEY = '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';
  const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

  function getLogs() {
    try { return JSON.parse(localStorage.getItem('dart_logs') || '[]'); } catch(_){ return []; }
  }
  function addLog(entry) {
    const logs = getLogs();
    logs.unshift({ ...entry, ts: new Date().toLocaleString() });
    if (logs.length > 60) logs.pop();
    localStorage.setItem('dart_logs', JSON.stringify(logs));
  }

  async function callText(messages, maxTokens) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + KEY,
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: maxTokens || 1200,
        messages: messages
      })
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error?.message || 'API error ' + res.status);
    }
    const data = await res.json();
    return parseJSON(data.choices[0].message.content);
  }

  async function callVision(messages, maxTokens) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + KEY,
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: maxTokens || 800,
        messages: messages
      })
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error?.message || 'Vision API error ' + res.status);
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

  async function compressImage(base64, mediaType) {
    return new Promise(function(resolve) {
      var img = new Image();
      img.onload = function() {
        var maxSize = 800, w = img.width, h = img.height;
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

  // LAYER 1: NLP Text Analysis
  async function analyzeText(reviewText, platform, productName) {
    return callText([{
      role: 'user',
      content: `You are DART (Detection, Analysis, and Real-Time Tracking of Deceptive Product Reviews). Analyze this review text using NLP for signs of deception.

Platform: ${platform || 'Unknown'}
Product: ${productName || 'Unknown'}
Review Text: """${reviewText}"""

Check for: fake or forced emotions, templated writing, keyword stuffing, unnatural sentence structures, AI-generated language patterns, copied content.

Return ONLY valid JSON:
{
  "textRiskLevel": "LOW" or "MEDIUM" or "HIGH",
  "textDeceptionScore": 0-100,
  "textVerdict": "one sentence",
  "findings": {
    "sentimentManipulation": "LOW|MEDIUM|HIGH – reason",
    "aiGeneratedLikelihood": "LOW|MEDIUM|HIGH – reason",
    "keywordStuffing": "LOW|MEDIUM|HIGH – reason",
    "linguisticUniformity": "LOW|MEDIUM|HIGH – reason"
  },
  "textSignals": ["signal1","signal2","signal3"]
}`
    }], 1000);
  }

  async function analyzePhoto(base64, mediaType, idx, total) {
    const compressed = await compressImage(base64, mediaType);
    const prompt = `You are DART. Analyze this review photo (${idx} of ${total}).

Check: Is it AI-generated? Is it a stock photo? Does it look like a real buyer took it? Any visual inconsistencies?

Return ONLY valid JSON:
{
  "photoRiskLevel": "LOW" or "MEDIUM" or "HIGH",
  "photoDeceptionScore": 0-100,
  "photoVerdict": "one sentence about this photo",
  "photoSignals": ["signal1","signal2"]
}`;

    const visionModels = [
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'llama-4-scout-17b-16e-instruct',
      'llama-3.2-11b-vision-preview',
      'llama-3.2-90b-vision-preview'
    ];

    for (var m = 0; m < visionModels.length; m++) {
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY },
          body: JSON.stringify({
            model: visionModels[m],
            max_tokens: 600,
            messages: [{
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + compressed } },
                { type: 'text', text: prompt }
              ]
            }]
          })
        });
        if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error?.message||'err'); }
        const data = await res.json();
        return parseJSON(data.choices[0].message.content);
      } catch(e) {
        console.warn('Model ' + visionModels[m] + ' failed:', e.message);
        if (m === visionModels.length - 1) throw new Error('Photo analysis failed: ' + e.message);
      }
    }
  }

  // LAYER 3: Behavioral Analytics
  async function analyzeBehavioral(reviewText, starRating, platform) {
    return callText([{
      role: 'user',
      content: `You are DART. Perform behavioral analytics on this review.

Platform: ${platform || 'Unknown'}
Star Rating: ${starRating || 'Not provided'} / 5
Review Text: """${reviewText}"""

Check: Does the star rating match the tone? Is the writing vague/generic/extreme? Does it feel manufactured or incentivized? Does it lack specific product details a real buyer would mention?

Return ONLY valid JSON:
{
  "behavioralRiskLevel": "LOW" or "MEDIUM" or "HIGH",
  "behavioralDeceptionScore": 0-100,
  "behavioralVerdict": "one sentence",
  "ratingTextMatch": "CONSISTENT" or "INCONSISTENT" or "NEUTRAL",
  "behavioralSignals": ["signal1","signal2"]
}`
    }], 700);
  }

  function combineResults(textResult, photoResults, behavioralResult) {
    var scores = [];
    var signals = [];

    if (textResult) {
      scores.push({ score: textResult.textDeceptionScore || 0, weight: 0.35 });
      if (textResult.textSignals) signals = signals.concat(textResult.textSignals);
    }
    photoResults.forEach(function(pr) {
      scores.push({ score: pr.photoDeceptionScore || 0, weight: 0.40 / photoResults.length });
      if (pr.photoSignals) signals = signals.concat(pr.photoSignals);
    });
    if (behavioralResult) {
      scores.push({ score: behavioralResult.behavioralDeceptionScore || 0, weight: 0.25 });
      if (behavioralResult.behavioralSignals) signals = signals.concat(behavioralResult.behavioralSignals);
    }

    var totalWeight = scores.reduce(function(a,s){return a+s.weight;}, 0) || 1;
    var weighted = Math.round(scores.reduce(function(a,s){return a+s.score*s.weight;},0) / totalWeight);
    var maxScore = scores.length ? Math.max.apply(null, scores.map(function(s){return s.score;})) : 0;
    var final = Math.min(100, Math.max(0, Math.round(weighted * 0.65 + maxScore * 0.35)));
    var risk = final >= 65 ? 'HIGH' : final >= 35 ? 'MEDIUM' : 'LOW';

    var verdicts = [];
    if (textResult && textResult.textVerdict) verdicts.push('Text: ' + textResult.textVerdict);
    photoResults.forEach(function(pr, i){ if(pr.photoVerdict) verdicts.push('Photo '+(i+1)+': '+pr.photoVerdict); });
    if (behavioralResult && behavioralResult.behavioralVerdict) verdicts.push('Behavioral: ' + behavioralResult.behavioralVerdict);

    return {
      overallRiskLevel: risk,
      overallDeceptionScore: final,
      verdict: verdicts.join(' | ') || 'Analysis complete.',
      signals: [...new Set(signals)]
    };
  }

  async function analyzeReview(opts, onProgress) {
    if (!opts.photos || opts.photos.length === 0) throw new Error('Please upload at least one review photo.');

    var textResult = null, photoResults = [], behavioralResult = null;

    // Layer 1: NLP Text
    if (opts.reviewText && opts.reviewText.trim()) {
      if (onProgress) onProgress('Layer 1: Analyzing review text (NLP)...');
      try { textResult = await analyzeText(opts.reviewText, opts.platform, opts.productName); }
      catch(e) { console.warn('Text analysis failed:', e.message); }
    }

    // Layer 2: Vision AI Photos
    for (var i = 0; i < opts.photos.length; i++) {
      if (onProgress) onProgress('Layer 2: Analyzing photo ' + (i+1) + ' of ' + opts.photos.length + '...');
      try {
        var pr = await analyzePhoto(opts.photos[i].base64, opts.photos[i].mediaType, i+1, opts.photos.length);
        photoResults.push(pr);
      } catch(e) { console.warn('Photo ' + (i+1) + ' failed:', e.message); }
    }

    if (photoResults.length === 0) throw new Error('Photo analysis failed — open browser console (F12) to see the exact error.');

    // Layer 3: Behavioral
    if (opts.reviewText || opts.starRating) {
      if (onProgress) onProgress('Layer 3: Running behavioral analytics...');
      try { behavioralResult = await analyzeBehavioral(opts.reviewText || '(no text)', opts.starRating, opts.platform); }
      catch(e) { console.warn('Behavioral failed:', e.message); }
    }

    if (onProgress) onProgress('Combining all layer results...');
    var combined = combineResults(textResult, photoResults, behavioralResult);
    addLog({ platform: opts.platform||'Unknown', product: opts.productName||'Unknown', riskLevel: combined.overallRiskLevel, score: combined.overallDeceptionScore, verdict: combined.verdict });

    return { textResult, photoResults, behavioralResult, combined };
  }

  return { analyzeReview, getLogs, addLog };
})();
