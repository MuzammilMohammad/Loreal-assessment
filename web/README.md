# Claims Web App

This is a standalone React and Vite application for evaluators. It collects a proposed product claim and study summary, sends them to the Claims API, and displays the returned verdict, confidence, reasoning, and limitations.

## Install and run

From this folder:

```powershell
npm install
npm run dev
```

Open the URL printed by Vite (usually <http://localhost:5173>). The API must be running separately from `../api`. Local `/api` requests are proxied to `http://localhost:3000`, so they continue to work if Vite selects another port. Set `VITE_API_URL` in `.env` only when the API is hosted at a different origin; leave it empty for local development.

## Request behavior

The form sends `POST {VITE_API_URL}/api/claims/assess`. The API key and database connection are configured only in the API project; the browser app never receives those secrets.

The sample form values are illustrative. Submit de-identified study summaries only and do not enter patient-identifiable data.

## Code layout

- `src/main.tsx` contains form state, the API request, and result rendering.
- `src/style.css` contains the page layout and responsive styles.
- `vite.config.ts` configures the local web server.

The web app can be built independently with `npm run build`.
