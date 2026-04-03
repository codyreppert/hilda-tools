# Hilda Tools

AI-powered workflow tools for Enlightenment Financial Services.

---

## Local Development

```bash
npm install
cp .env.example .env   # then fill in your Airtable values
npm run dev
```

App runs at http://localhost:5173

---

## Deploy to Vercel (Step by Step)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
```

- Go to github.com → New repository → name it `hilda-tools`
- Copy the remote URL they give you, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/hilda-tools.git
git push -u origin main
```

### 2. Deploy on Vercel

- Go to vercel.com → Sign up with GitHub
- Click "Add New Project"
- Import your `hilda-tools` repo
- Vercel auto-detects Vite — no config needed
- Click Deploy

### 3. Add Environment Variables in Vercel

In your Vercel project → Settings → Environment Variables, add:

| Key | Value |
|-----|-------|
| `VITE_AIRTABLE_TOKEN` | your token |
| `VITE_AIRTABLE_BASE_ID` | your base ID |
| `VITE_AIRTABLE_TABLE` | Email Generator |

Redeploy after adding env vars.

### 4. Custom Domain (Optional)

In Vercel → Settings → Domains → add your domain.
Example: `tools.enlightenmentfinancialservices.com`

---

## Airtable Setup

1. Create a free account at airtable.com
2. Create a new Base called `CPA Tool Logs`
3. Rename the default table to `Email Generator`
4. Add these fields:

| Field Name | Type |
|------------|------|
| Timestamp | Date (include time) |
| CPA Name | Single line text |
| Client Name | Single line text |
| Tone | Single line text |
| Missing Docs | Long text |
| Deadline | Single line text |
| Context | Long text |
| Subject Generated | Single line text |

5. Go to airtable.com/create/tokens
6. Create token with scope: `data.records:write`
7. Add your base to the token's access list
8. Copy token → paste into `.env`

---

## Adding New Tools

1. Create `src/tools/YourToolName.jsx`
2. Add a route in `src/App.jsx`:
```jsx
import YourTool from './tools/YourToolName.jsx'
// In routes:
<Route path="/your-tool" element={<YourTool />} />
// In tools array in Nav:
{ path: '/your-tool', label: 'Your Tool Name' }
// In ToolCard list on Home:
<ToolCard to="/your-tool" icon="📄" title="Your Tool" desc="What it does." />
```

---

## Project Structure

```
hilda-tools/
├── src/
│   ├── tools/
│   │   └── ExtensionEmailGenerator.jsx
│   ├── App.jsx          # routing + nav + home
│   ├── main.jsx         # React entry
│   └── index.css        # global styles
├── index.html
├── vite.config.js
├── package.json
├── .env.example
└── .gitignore
```
