# DART – Deceptive Assessment and Review Tracking

> AI-powered fake review detection for any e-commerce platform.

---

## 🚀 How to Make It Live on GitHub Pages (Step-by-Step)

This is a **100% static website** — no server, no database, no hosting costs.
It runs entirely in the browser and calls the Anthropic API directly.

---

### Step 1: Create a GitHub Account

If you don't have one, go to **https://github.com** and sign up (free).

---

### Step 2: Create a New Repository

1. Click the **"+"** icon → **New repository**
2. Name it something like `DART-WEB` or `dart-reviews`
3. Set it to **Public** ✅ (required for free GitHub Pages)
4. Leave everything else as default
5. Click **Create repository**

---

### Step 3: Upload the Files

**Option A — Using GitHub web interface (easiest):**

1. Open your new repository
2. Click **"Add file"** → **"Upload files"**
3. Drag and drop ALL files and folders:
   ```
   index.html
   css/
   js/
   pages/
   README.md
   ```
4. Make sure the folder structure is preserved exactly as above
5. Click **"Commit changes"**

**Option B — Using Git (for developers):**

```bash
git init
git add .
git commit -m "Initial DART deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

---

### Step 4: Enable GitHub Pages

1. In your repository, click **Settings** (top tab)
2. Scroll down to **"Pages"** in the left sidebar
3. Under **"Source"**, select:
   - Branch: **main**
   - Folder: **/ (root)**
4. Click **Save**
5. Wait ~60 seconds. Refresh the page.
6. You'll see: `✅ Your site is live at https://YOUR_USERNAME.github.io/YOUR_REPO/`

---

### Step 5: Get Your Anthropic API Key

The AI analysis requires an Anthropic API key:

1. Go to **https://console.anthropic.com**
2. Sign up / log in
3. Go to **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-...`)
5. **Keep it secret** — don't share it publicly

---

### Step 6: Set Your API Key in DART

1. Open your live DART site
2. Click **"Analyze"** in the navbar
3. If prompted, click the **Settings** link
4. Or navigate to: `https://YOUR_USERNAME.github.io/YOUR_REPO/pages/settings.html`
5. Paste your API key and click **Save**
6. Your key is stored only in your browser — not on any server

---

### Step 7: Use DART

1. Go to the **Analyze** page
2. **Tab 1 – Product URL:** Paste a product link from Shopee, Lazada, Amazon, etc.
3. **Tab 2 – Manual Review:** Paste review text directly (more reliable — no scraping needed)
4. Click **Analyze** and wait for the AI results

---

## ⚠️ Important Notes About URL Analysis

### Why some URLs may not work:

| Platform | URL Analysis | Reason |
|----------|-------------|--------|
| Amazon | ⚠️ Inconsistent | Anti-bot protection |
| Shopee | ⚠️ Inconsistent | JavaScript-rendered content |
| Lazada | ⚠️ Inconsistent | Requires login for reviews |
| Temu | ✅ Often works | More open HTML |
| AliExpress | ⚠️ Inconsistent | Dynamic content |
| Yelp | ✅ Often works | More accessible |
| TripAdvisor | ✅ Often works | Good HTML structure |

### Why URL scraping is difficult:

Modern e-commerce sites (especially Shopee, Lazada, Amazon) use:
- **JavaScript-rendered content** — reviews only load after JS executes (can't be fetched with simple HTML)
- **Anti-bot protection** — they actively block automated access
- **Login walls** — reviews hidden behind authentication

### The recommended workflow:

**For reliable results, use the Manual Review tab:**
1. Open the product page in your browser
2. Copy the review texts manually
3. Paste them into DART's Manual Review tab
4. Get instant AI analysis

This is 100% reliable since you provide the review text directly.

---

## 🔑 API Key Security

- Your API key is stored in `localStorage` in **your browser only**
- It is sent directly from your browser to `api.anthropic.com` (Anthropic's own server)
- DART has **no backend** — no data is sent to any third-party server
- Each analysis costs a small amount of API credits (~$0.001–$0.01 per analysis depending on review length)
- You can monitor usage at https://console.anthropic.com/usage

---

## 📁 File Structure

```
dart-website/
├── index.html              ← Homepage (hero, platforms, how it works)
├── css/
│   └── style.css           ← Complete design system
├── js/
│   ├── nav.js              ← Mobile navigation toggle
│   └── dart-api.js         ← Anthropic API + URL scraping client
└── pages/
    ├── analyze.html        ← Main analysis page (URL + manual tabs)
    ├── about.html          ← Project background & research details
    └── settings.html       ← API key configuration
```

---

## 🔧 Troubleshooting

**"No API key configured" warning:**
→ Go to Settings and save your `sk-ant-...` key.

**"Could not fetch the product page":**
→ The platform blocks scraping. Use the Manual Review tab instead.

**"No reviews found on this page":**
→ Reviews are loaded by JavaScript and can't be fetched statically. Use Manual Review tab.

**"INVALID_API_KEY" error:**
→ Check that your key starts with `sk-ant-` and was copied correctly from console.anthropic.com.

**Site not loading after GitHub Pages setup:**
→ Wait 2–5 minutes and do a hard refresh (Ctrl+Shift+R).

---

## 📚 Research Background

**Project:** DART – Deceptive Assessment and Review Tracking  
**Institution:** College of Informatics and Computing Sciences (CICS), Batangas State University  
**Reference:** BatStateU-FO-COL-03 · April 07, 2026  
**Proponents:** Comia, Nick Aeron Ordero · Francine Pilapil · Kim Nicole  
**Adviser:** Mr. Noel Virrey
