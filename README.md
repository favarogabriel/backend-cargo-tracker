# Cargo Tracker Backend

Node.js + Express API for the Cargo Tracker frontend. Uses PostgreSQL (Railway).

## Endpoints

- GET /health → simple healthcheck
- POST /rastreamentos/manual → create/update a shipment from the "Enviar Código" page
- GET /rastreamentos → list last 10 shipments for dashboard
- GET /rastreamentos/:codigo → details for tracking page shape { packageInfo, events }
- GET /etapas → list current step configuration
- POST /etapas → replace step configuration (array of { dia, titulo, mensagem })

## Environment

Copy `.env.example` to `.env.local` for local dev and set values:

- DATABASE_URL=postgresql://user:pass@host:5432/db
- PGSSL=true # Often needed for Railway managed PG
- PORT=8080

## Run locally

1. Install deps:

```powershell
cd backend; npm install
```

2. Start dev server:

```powershell
npm run dev
```

The API listens on http://localhost:8080 by default.

## Frontend integration

Set `VITE_API_BASE_URL` in the frontend `.env.local` to your backend URL, for example:

```
VITE_API_BASE_URL=http://localhost:8080
```

"Enviar Código" page already posts to `/rastreamentos/manual` when the env var is set. The tracking page can be wired to GET `/rastreamentos/:codigo` to display real data instead of the mock.

## Deploy on Railway

- Create a new Railway project
- Add a PostgreSQL database (Railway will provide DATABASE_URL)
- Deploy this repository; set the service root to the `backend` folder and the Start Command to `npm start`
- Add env var `DATABASE_URL` from the Railway database plugin
- Ensure `PORT` is not hardcoded; the app uses the provided `PORT` env

No build step is necessary for this plain JS backend.
