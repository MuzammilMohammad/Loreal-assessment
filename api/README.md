# Claims API

This is a standalone NestJS service. It validates claim and study evidence, requests an assessment from the provider selected in configuration (OpenAI or Google Gemini), and stores the claim and result in PostgreSQL through Prisma.

## Install and run

From this folder:

```powershell
npm install
npm run dev
```

`npm install` generates Prisma Client once as part of installation. `npm run dev` starts the local PostgreSQL process if needed, applies migrations, and runs NestJS in watch mode on port 3000. It does not regenerate Prisma Client on every startup, which avoids Windows file-lock errors when Prisma's query engine is in use. Set `AI_PROVIDER` to `openai` or `gemini` and add that provider’s key to `.env`; see `.env.example`. The example defaults to OpenAI because that is what the assignment requests. Your local `.env` stays configured for Gemini until you choose to switch.

The web app is a separate project in `../web`. It calls this API using its own `VITE_API_URL` setting.

For local development, the API accepts browser requests from `localhost` and `127.0.0.1` on any port. This covers Vite's fallback to port 5174 when 5173 is busy. In production, set `WEB_ORIGIN` to the exact frontend origin or comma-separated list of origins.

## Request flow

1. `POST /api/claims/assess` receives a proposed claim and evidence summary.
2. The global `ValidationPipe` applies the rules in `src/claims/dto/assess-claim.dto.ts`.
3. `ClaimsService` calls the provider selected by `AI_PROVIDER` and asks for structured JSON. With `AI_PROVIDER="demo"`, it returns a clearly labeled `INCONCLUSIVE` demo result.
4. The service validates the verdict and confidence, then saves a Claim and related Assessment through Prisma.
5. The API returns the saved record to the caller.

This assessment route is POST-only because it requires a JSON body. Opening it in a browser address bar sends GET and returns 404; use the web form or an API client.

`GET /api/claims` returns saved claims with the latest assessment summary. The React review-history list calls it.

`GET /api/claims/:id/assessments` returns a selected claim and its saved assessments, newest first. The React UI calls it when a saved claim is expanded.

## Data model

- **Claim:** claim wording, product name, optional target population, and creation time.
- **Assessment:** evidence summary, verdict, confidence, reasoning, limitations, model name, demo flag, and creation time. One claim can have multiple assessments.

The Prisma schema and migrations are under `prisma/`. Do not send patient-identifiable information.

## API and database commands

Run commands from this `api` folder:

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies and generate Prisma Client |
| `npm run dev` | Start/check PostgreSQL, apply committed migrations, and run the API |
| `npm run db:generate` | Regenerate Prisma Client after editing the Prisma schema; stop the API first on Windows |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:migrate -- --name <change>` | Create a development migration |
| `npm run db:studio` | Open Prisma Studio to view database rows |
| `npm run db:local:start` | Start this PC's local PostgreSQL process |
| `npm run db:local:stop` | Stop it without deleting records |

The local PostgreSQL files are stored outside this project under `Documents/Codex/.local-services/postgres`. For Docker, run `docker compose up -d` from this folder. For a hosted database, set its SSL-enabled `DATABASE_URL` in `.env`; the local helper skips startup for a non-local host.

Set `AI_PROVIDER="openai"` with `OPENAI_API_KEY` to use OpenAI, or `AI_PROVIDER="gemini"` with `GEMINI_API_KEY` to use Gemini. Defaults are `gpt-4o-mini` and `gemini-3.5-flash-lite`; change the matching model variable if your account has different model access. Setting `AI_PROVIDER="demo"` disables model calls. Provider credentials stay in `api/.env`; do not put real keys in `.env.example`, frontend code, or source control. A key alone does not guarantee API quota or billing access.

To try OpenAI locally, set `AI_PROVIDER="openai"`, paste your replacement key into `OPENAI_API_KEY`, and restart the API. To switch back to Gemini, set `AI_PROVIDER="gemini"`. No frontend changes or extra npm package are needed.

Provider code is separated so the choice stays easy to follow:

- `src/claims/providers/openai-assessment.provider.ts` contains the OpenAI request and response handling.
- `src/claims/providers/gemini-assessment.provider.ts` contains the Gemini request and response handling.
- `src/claims/common/assessment.ts` contains shared assessment types, instructions, validation, and error helpers.
- `src/claims/claims.service.ts` selects the provider and owns the shared assessment flow and database saving.

After testing, you can remove the provider you do not want. Delete its file under `src/claims/providers/`, remove its import and constructor argument from `ClaimsService`, and remove its provider/model case from `ClaimsService` and `AssessmentProviderName`. Then remove that provider’s environment settings. Neither provider needs an extra npm package; both use Node’s built-in `fetch`.

## Limitations

Model output is decision support, not scientific or regulatory approval. Confidence is not calibrated against expert-reviewed cases. A production service should add report-page citations, evaluator sign-off, a versioned rubric, audit history, privacy controls, and monitoring.
