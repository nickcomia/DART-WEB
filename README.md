# DART – Deceptive Assessment and Review Tracking

An AI-powered web application for detecting fake and deceptive product reviews across any e-commerce platform.

## 🚀 Deploying to GitHub Pages

1. **Fork or upload** this repository to GitHub
2. Go to **Settings → Pages**
3. Under *Source*, select **Deploy from a branch**
4. Choose **main** branch and **/ (root)** folder
5. Click **Save** — your site will be live at `https://yourusername.github.io/your-repo-name/`

## 🔑 Setting Your API Key

After opening the site:
1. Click **API Key** in the navigation
2. Enter your Anthropic API key (starts with `sk-ant-`)
3. Get one at [console.anthropic.com](https://console.anthropic.com)
4. Click **Save**

Your key is stored **only in your browser's localStorage** — it never leaves your device except when making direct API calls to Anthropic.

## 📁 File Structure

```
dart-website/
├── index.html          ← Landing page
├── css/
│   └── style.css       ← Global styles
├── js/
│   ├── nav.js          ← Mobile navigation
│   └── dart-api.js     ← Anthropic API client
└── pages/
    ├── analyze.html    ← Main analysis tool (single + batch)
    ├── about.html      ← Project background & objectives
    ├── admin.html      ← Analysis history dashboard
    └── settings.html   ← API key configuration
```

## 🔍 Features

- **Single Review Analysis** – Paste any review text for instant AI analysis
- **Batch Analysis** – Add up to 10 reviews for comparative fraud detection
- **Risk Scoring** – LOW / MEDIUM / HIGH classification with 0–100 deception score
- **NLP Findings** – Sentiment manipulation, AI-generated content, keyword stuffing, linguistic uniformity
- **Detection Signals** – Human-readable explanation of red flags
- **Admin Dashboard** – Local history log of all past analyses with statistics
- **Platform Support** – Amazon, Shopee, Lazada, eBay, Temu, AliExpress, Google, Yelp, TripAdvisor, and more

## 🛡️ Privacy

- No backend server — all analysis runs through direct browser-to-Anthropic API calls
- API key stored in `localStorage` only
- Analysis logs stored in `localStorage` only
- No data sent to any third-party service

## 📚 Research Background

DART is a research project from the **College of Informatics and Computing Sciences (CICS)**, Batangas State University (BatStateU).

**Proponents:** Comia, Nick Aeron Ordero · Francine Pilapil · Kim Nicole  
**Adviser:** Mr. Noel Virrey  
**Reference No.:** BatStateU-FO-COL-03 · April 07, 2026
