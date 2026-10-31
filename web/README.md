# Claims Web App

This standalone React and Vite app is the evaluator's interface for submitting a claim and study summary, reading the assessment, and reviewing saved results.

## Install and run

From this folder:

```powershell
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`. The API must run separately from `../api`. Local `/api` requests are proxied to `http://localhost:3000`. Set `VITE_API_URL` in `.env` only when the API is hosted at a different origin.

## What the interface does

- Checks required form fields and disables submission while the API request is running.
- Displays the verdict, confidence, reasoning, evidence limitations, and whether the response came from demo mode.
- Loads saved claims and fetches assessment details when a claim is expanded.
- Lets the evaluator start another assessment for a saved claim. The request sends only the saved `claimId` and new `evidence`; the API loads the original claim details and adds the assessment to its history.

The browser never receives the model key or database URL. Use de-identified study summaries only.

## Code layout

- `src/App.tsx` owns form state and the assessment request.
- `src/components/ClaimForm.tsx` renders the submission form.
- `src/components/AssessmentPanel.tsx` renders the latest assessment result.
- `src/components/SavedClaims.tsx` loads claims and their expanded assessment history.
- `src/types/assessment.ts` defines the API response shapes.
- `src/style.css` contains the page layout and responsive styles.

Build the app with `npm run build`. This runs the TypeScript project check and Vite production build.
