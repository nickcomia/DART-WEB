# DART – Deceptive Assessment and Review Tracking

AI-powered fake review detector for any e-commerce platform.

---

## Deploy to GitHub Pages (Step-by-Step)

### Step 1 – Create a GitHub Account
Go to https://github.com and sign up (free).

### Step 2 – Create a New Repository
1. Click "+" → "New repository"
2. Name it (e.g. `DART-WEB`)
3. Set to **Public**
4. Click **Create repository**

### Step 3 – Upload Files
1. Click "Add file" → "Upload files"
2. Upload these files/folders, preserving the structure:
```
index.html          ← must be at root
js/
  dart-api.js
pages/
  analyze.html
  about.html
  settings.html
README.md
```
3. Click "Commit changes"

### Step 4 – Enable GitHub Pages
1. Go to repository **Settings** → **Pages**
2. Source: **Deploy from branch**
3. Branch: **main** / Folder: **/ (root)**
4. Click **Save**
5. Wait ~60 seconds → site goes live at:
   `https://YOUR_USERNAME.github.io/YOUR_REPO/`

### Step 5 – Get an Anthropic API Key
1. Go to https://console.anthropic.com
2. Sign up / log in
3. Go to **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-...`)

### Step 6 – Set Your Key in DART
1. Open your live site
2. Navigate to: `yoursite/pages/settings.html`
3. Paste your API key → click **Save**
4. Your key is stored only in your browser

### Step 7 – Use DART
- Go to **Analyze** page
- **Tab 1 – Product URL:** Paste a link from Shopee, Lazada, Amazon, etc.
- **Tab 2 – Manual Review:** Paste review text directly (always reliable)

---

## Files (self-contained, no build step needed)

```
index.html          Homepage
js/dart-api.js      Anthropic API client
pages/analyze.html  Main analysis tool
pages/about.html    Project background
pages/settings.html API key configuration
```

Each HTML file has all CSS embedded — no external stylesheet dependencies.

---

## Note on URL Scraping

Some platforms (Shopee, Amazon, Lazada) use JavaScript to load reviews,
which means URL scraping may not always work. The **Manual Review tab**
always works — just copy-paste review text from the product page.

---

## Research
**BatStateU CICS** · Ref: BatStateU-FO-COL-03 · April 2026  
Proponents: Comia, Nick Aeron Ordero · Francine Pilapil · Kim Nicole  
Adviser: Mr. Noel Virrey
