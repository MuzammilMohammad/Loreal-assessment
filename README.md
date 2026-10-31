# Claims Intelligence Engine

This repository contains two independent projects: a React web application and a NestJS API. Each project has its own dependencies, npm lockfile, environment configuration, README, and development command. Run `npm install` in each project to generate its lockfile. The API owns database access and migrations; the web app calls the API over HTTP.

## Run the projects separately

Install and start the API in one terminal:

```powershell
cd api
npm install
npm run dev
```

The API command generates Prisma Client, starts local PostgreSQL if needed, applies database migrations, and starts NestJS at <http://localhost:3000>.

Install and start the web app in a second terminal:

```powershell
cd web
npm install
npm run dev
```

The web app runs at <http://localhost:5173> and calls the API at `VITE_API_URL` (defaults to `http://localhost:3000`). There is no root package workspace or shared start command connecting the projects.

For service-specific setup and commands, see [api/README.md](api/README.md) and [web/README.md](web/README.md).

## API routes

- `POST /api/claims/assess` submits and saves an assessment.
- `GET /api/claims` loads the saved-claims list.
- `GET /api/claims/:id/assessments` loads full assessment details when a saved claim is expanded in the UI.

## Show saved database records

In a third terminal, from `api`, run `npm run db:studio`. Prisma Studio normally opens at <http://localhost:5555>. Submit a claim in the web app first, then inspect the `Claim` and `Assessment` models.

## Business process

The business proposes a product claim. Claim managers screen it for applicability and feasibility. An R&I scientist submits the formulation and study evidence. An evaluator checks whether the study supports the exact wording, effect size, timeframe, and population. This prototype implements the evaluator step and treats the model as decision support for human review.

## Architecture and research

- The web app owns only the form and result presentation. It can be developed or deployed independently by setting `VITE_API_URL`.
- The API owns request validation, claim assessment, and database persistence. NestJS keeps routing, DTO validation, and business logic in separate files.
- PostgreSQL stores Claims and their related Assessments. Prisma provides a typed data model and versioned migrations.
- The API calls the provider selected by `AI_PROVIDER` (`openai` or `gemini`). Both produce the same validated assessment shape; provider keys stay in `api/.env` and never go in the browser app. The assignment asks for OpenAI, so `.env.example` defaults to OpenAI while the existing local `.env` remains on Gemini until you switch it.
- NestJS validation follows the [official validation guidance](https://docs.nestjs.com/techniques/validation). Database modeling and migration decisions follow [Prisma's PostgreSQL documentation](https://www.prisma.io/docs/orm/overview/databases/postgresql) and [migration workflow](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production). Model integration uses the [OpenAI API documentation](https://platform.openai.com/docs/).

The model verdict is not scientific or regulatory approval. A production system should add report-page citations, expert review and sign-off, audit history, role-based access, privacy and retention controls, confidence calibration, model monitoring, and asynchronous evaluation for long-running requests.


