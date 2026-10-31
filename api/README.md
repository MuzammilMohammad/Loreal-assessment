# Claims API

This standalone NestJS service validates claim requests, calls the configured assessment provider, and stores each result in PostgreSQL with Prisma. `ClaimsController` handles HTTP routes, `ClaimsService` runs the assessment flow, the provider classes call OpenAI or Gemini, and `PrismaService` owns database access.

## Install and run

From this folder:

```powershell
npm install
Copy-Item .env.example .env
```

Set `DATABASE_URL` and choose `AI_PROVIDER` in `.env`. Add a provider key if using OpenAI or Gemini. Then run:

```powershell
npm run dev
```

The command starts the local PostgreSQL helper, applies committed migrations, and runs NestJS in watch mode on port 3000. The helper skips startup when the database host is not local. You can also use Docker with `docker compose up -d`, or point `DATABASE_URL` to a hosted PostgreSQL database.

For local web development, requests from localhost are allowed on Vite's default port and fallback ports. For production, set `WEB_ORIGIN` to the exact web origin or a comma-separated list.

## Routes

### `POST /api/claims/assess`

Send `productName`, `claimText`, `evidence`, and optional `population`. The API creates a Claim and its first Assessment and returns the saved rows.

To add a new assessment to an existing claim, include its `claimId` in the same request. A missing ID returns 404 before calling the model. Each successful request adds an Assessment and keeps the claim's existing history.

### `GET /api/claims`

Returns saved claims with their latest assessment summary. The React review-history panel uses this route.

### `GET /api/claims/:id/assessments`

Returns one claim and all its assessments, newest first. The React UI calls it when the user expands a saved claim. A claim that does not exist returns 404.

The assessment route is POST-only because it expects a JSON request body. Visiting it in a browser address bar sends GET and returns 404; use the web form or an API client.

## Assessment flow

1. The global `ValidationPipe` checks the DTO and rejects undeclared fields.
2. If `claimId` is supplied, the API checks that the claim exists.
3. `ClaimsService` calls the selected provider, or produces a clearly marked result if `AI_PROVIDER=demo`.
4. Provider output is parsed and validated before saving.
5. `PrismaService` saves a new Claim and its first Assessment together, or connects a new Assessment to the selected existing Claim.
6. The API returns the saved record to the web app.

OpenAI and Gemini requests have a 30-second timeout. Missing keys, invalid model output, timeouts, and database failures return errors; a real provider failure is not converted into a demo result. Demo mode is marked with `isDemo: true` and uses the `local-demo` model label.

## Data model

- **Claim:** claim wording, product name, optional target population, and creation time.
- **Assessment:** evidence summary, verdict, confidence, reasoning, limitations, model, demo flag, and creation time.
- **Relationship:** one Claim can have multiple Assessments. Each Assessment has a required foreign key to one Claim.

Do not submit patient-identifiable information. The system stores the supplied evidence summary for review history.

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install packages and generate Prisma Client |
| `npm run dev` | Start/check local PostgreSQL, apply migrations, and run the API |
| `npm run build` | Compile NestJS into `dist` |
| `npm test` | Build and run the backend behavior tests |
| `npm run db:generate` | Regenerate Prisma Client after editing the schema; stop the API first on Windows |
| `npm run db:migrate -- --name <change>` | Create and apply a development migration |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:studio` | Open Prisma Studio to inspect rows |
| `npm run db:local:start` | Start the local PostgreSQL process |
| `npm run db:local:stop` | Stop it without deleting records |

The local PostgreSQL files are kept outside the project under `Documents/Codex/.local-services/postgres`.

## Provider settings

Set `AI_PROVIDER="openai"` and `OPENAI_API_KEY` to use OpenAI. The default model is `gpt-4o-mini`. Set `AI_PROVIDER="gemini"` and `GEMINI_API_KEY` to use Gemini; the default model is `gemini-3.5-flash-lite`. Set `AI_PROVIDER="demo"` to avoid external model calls. No extra provider package is required because the integrations use Node's built-in `fetch`.

Keep API keys in this project's `.env`. Never put them in React configuration, `.env.example`, source files, or Git. A ChatGPT subscription does not itself provide API quota; confirm the API account has access and billing/quota available.

## Tests

`npm test` covers DTO validation, successful creation, reassessment of an existing claim, missing claim IDs, provider failure and timeout, invalid model output, database failure, and multiple assessments staying attached to one claim. Tests use the Node built-in test runner and do not require PostgreSQL or API keys.

## Limits

The model receives a user-provided text summary. It cannot check the original study report, authenticate source data, or grant scientific/regulatory approval. Confidence is not calibrated against expert-reviewed results. A qualified evaluator must review the result.
