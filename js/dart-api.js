/**
 * DART v4 – Client API
 * Detection, Analysis, and Real-Time Tracking of Deceptive Product Reviews
 *
 * All calls go through /api/groq (local proxy) — API key never exposed
 */
const DART = (function () {

  function getLogs() {
    try { return JSON.parse(localStorage.getItem('dart_logs') || '[]'); } catch(_){ return []; }
  }
  function addLog(entry) {
    const logs = getLogs();
    logs.unshift({ ...entry, ts: new Date().toLocaleString() });
    if (logs.length > 60) logs.pop();
    localStorage.setItem('dart_logs', JSON.stringify(logs));
  }

  // All API calls go through local proxy — key stays in .env
  async function callProxy(payload, maxTokens) {
    const body = {
      model: payload.model || 'llama-3.3-70b-versatile',
      max_tokens: maxTokens || 1200,
      messages: payload.messages
    };

    const res = await fetch('/api/groq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error?.message || 'API error ' + res.status);
    }
    const data = await res.json();
    return parseJSON(data.choices[0].message.content);
  }

  // Compress image before sending
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

  function parseJSON(text) {
    const clean = text.replace(/^```json\s*/i,'').replace(/\s*```$/,'').replace(/^```/,'').replace(/```$/,'').trim();
    try { return JSON.parse(clean); }
    catch(_) {
      const m = clean.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error('Could not parse AI response');
    }
  }

  // LAYER 1: NLP Text Analysis
  async function analyzeText(reviewText, platform, productName) {
    return callProxy({
      model: 'llama-3.3-70b-versatile',
      messages: [{
        role: 'user',
        content: `You are DART (Detection, Analysis, and Real-Time Tracking of Deceptive Product Reviews). Analyze this review text using NLP for signs of deception.

Platform: ${platform || 'Unknown'}
Product: ${productName || 'Unknown'}
Review Text: """${reviewText}"""

Check for:
1. Unusual writing patterns
2. Unnatural or forced emotions
3. Suspiciously similar / templated language
4. Unnatural sentence structures
5. Excessive keyword repetition
6. Duplicate or copied content indicators
7. AI-generated language patterns

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
  "textSignals": ["signal1", "signal2", "signal3"]
}`
      }]
    }, 1000);
  }

  // LAYER 2: AI Vision Photo Analysis
  async function analyzePhoto(base64, mediaType, photoIndex, totalPhotos) {
    const compressed = await compressImage(base64, mediaType);
    const res = await fetch('/api/groq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 700,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + compressed } },
            {
              type: 'text',
              text: `You are DART. Analyze this review photo (${photoIndex} of ${totalPhotos}).

Check if this photo looks genuine or fake:
- Is it AI-generated?
- Is it a stock photo or professional image (not from a real buyer)?
- Does it look like a real product photo taken by an actual customer?
- Any visual inconsistencies or signs of manipulation?

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
      throw new Error(e.error?.message || 'Photo API error ' + res.status);
    }
    const data = await res.json();
    return parseJSON(data.choices[0].message.content);
  }

  // LAYER 3: Behavioral Analytics
  async function analyzeBehavioral(reviewText, starRating, platform) {
    return callProxy({
      model: 'llama-3.3-70b-versatile',
      messages: [{
        role: 'user',
        content: `You are DART. Perform behavioral analytics on this review submission.

Platform: ${platform || 'Unknown'}
Star Rating Given: ${starRating || 'Not provided'} out of 5
Review Text: """${reviewText}"""

Check for behavioral signals of deception:
1. Does the star rating match the tone/sentiment of the review text?
2. Is the writing unusually vague, generic, or extreme?
3. Is the sentiment consistent with what a genuine buyer would write?
4. Are there signs the review was manufactured or incentivized?
5. Does the review lack specific product details a real buyer would mention?

Return ONLY valid JSON:
{
  "behavioralRiskLevel": "LOW" or "MEDIUM" or "HIGH",
  "behavioralDeceptionScore": 0-100,
  "behavioralVerdict": "one sentence",
  "ratingTextMatch": "CONSISTENT" or "INCONSISTENT" or "NEUTRAL",
  "behavioralSignals": ["signal1", "signal2"]
}`
      }]
    }, 800);
  }

  // Combine all layer results
  function combineResults(textResult, photoResults, behavioralResult) {
    var scores = [];
    var signals = [];
    var verdicts = [];

    if (textResult) {
      scores.push({ score: textResult.textDeceptionScore || 0, weight: 0.35 });
      if (textResult.textSignals) signals = signals.concat(textResult.textSignals);
      if (textResult.textVerdict) verdicts.push('Text: ' + textResult.textVerdict);
    }

    photoResults.forEach(function(pr, i) {
      scores.push({ score: pr.photoDeceptionScore || 0, weight: 0.40 / Math.max(photoResults.length, 1) });
      if (pr.photoSignals) signals = signals.concat(pr.photoSignals);
      if (pr.photoVerdict) verdicts.push('Photo ' + (i+1) + ': ' + pr.photoVerdict);
    });

    if (behavioralResult) {
      scores.push({ score: behavioralResult.behavioralDeceptionScore || 0, weight: 0.25 });
      if (behavioralResult.behavioralSignals) signals = signals.concat(behavioralResult.behavioralSignals);
      if (behavioralResult.behavioralVerdict) verdicts.push('Behavioral: ' + behavioralResult.behavioralVerdict);
    }

    var totalWeight = scores.reduce(function(a,s){return a+s.weight;}, 0) || 1;
    var weightedScore = Math.round(scores.reduce(function(a,s){return a + s.score * s.weight;}, 0) / totalWeight);
    var maxScore = scores.length > 0 ? Math.max.apply(null, scores.map(function(s){return s.score;})) : 0;
    var finalScore = Math.round(weightedScore * 0.65 + maxScore * 0.35);
    finalScore = Math.max(0, Math.min(100, finalScore));

    var riskLevel = finalScore >= 65 ? 'HIGH' : finalScore >= 35 ? 'MEDIUM' : 'LOW';

    return {
      overallRiskLevel: riskLevel,
      overallDeceptionScore: finalScore,
      verdict: verdicts.join(' | ') || 'Analysis complete.',
      signals: [...new Set(signals)]
    };
  }

  // Main: run all 3 layers
  async function analyzeReview(opts, onProgress) {
    // opts: { reviewText, starRating, platform, productName, photos }
    if (!opts.photos || opts.photos.length === 0) {
      throw new Error('Please upload at least one review photo.');
    }

    var textResult = null;
    var photoResults = [];
    var behavioralResult = null;

    // Layer 1: Text NLP (if text provided)
    if (opts.reviewText && opts.reviewText.trim()) {
      if (onProgress) onProgress('Layer 1: Analyzing review text (NLP)...');
      textResult = await analyzeText(opts.reviewText, opts.platform, opts.productName);
    }

    // Layer 2: Photo Vision AI
    for (var i = 0; i < opts.photos.length; i++) {
      if (onProgress) onProgress('Layer 2: Analyzing photo ' + (i+1) + ' of ' + opts.photos.length + ' (Vision AI)...');
      try {
        var pr = await analyzePhoto(opts.photos[i].base64, opts.photos[i].mediaType, i+1, opts.photos.length);
        photoResults.push(pr);
      } catch(e) {
        console.warn('Photo ' + (i+1) + ' analysis failed:', e.message);
      }
    }

    if (photoResults.length === 0) {
      throw new Error('Could not analyze the photos. Please try again with clearer images.');
    }

    // Layer 3: Behavioral Analytics (if text and/or star rating provided)
    if (opts.reviewText || opts.starRating) {
      if (onProgress) onProgress('Layer 3: Running behavioral analytics...');
      try {
        behavioralResult = await analyzeBehavioral(
          opts.reviewText || '(no text provided)',
          opts.starRating,
          opts.platform
        );
      } catch(e) {
        console.warn('Behavioral analysis failed:', e.message);
      }
    }

    if (onProgress) onProgress('Combining all layer results...');
    var combined = combineResults(textResult, photoResults, behavioralResult);

    addLog({
      platform: opts.platform || 'Unknown',
      product: opts.productName || 'Unknown',
      riskLevel: combined.overallRiskLevel,
      score: combined.overallDeceptionScore,
      verdict: combined.verdict
    });

    return { textResult, photoResults, behavioralResult, combined };
  }

  return { analyzeReview, getLogs, addLog };
})();
