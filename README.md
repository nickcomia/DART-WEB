# DART – Detection, Analysis, and Real-Time Tracking of Deceptive Product Reviews

## Setup

1. Install dependencies:
```
npm install
```

2. Set your Groq API key in `.env`:
```
GROQ_API_KEY=your_key_here
```

3. Run the server:
```
npm start
```

4. Open browser at: http://localhost:3000

## File Structure
```
DART/
├── .env                  ← API key (NEVER commit this)
├── server.js             ← Proxy server (hides API key)
├── package.json
├── index.html            ← Home page
├── js/
│   └── dart-api.js       ← API client (calls /api/groq proxy)
└── pages/
    ├── analyze.html      ← 3-layer analysis tool
    └── about.html        ← About page
```

## How the API key is hidden
- Key is stored only in `.env`
- `server.js` reads the key and proxies all Groq API calls
- The browser never sees the key — it only calls `/api/groq`
- Add `.env` to `.gitignore` before pushing to GitHub
