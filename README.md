# Deployment Tracker — Milestone 1

A deliberately small React frontend, Node/Express API, and PostgreSQL database for recording deployments. This milestone includes local Docker tooling only. There are no AWS, Terraform, Kubernetes, or CI/CD resources.

## Run locally with Docker

Install and start Docker Desktop (Linux containers) or Docker Engine with the Compose plugin. From this directory:

```sh
docker compose up --build -d --wait
```

- Frontend: http://localhost:8080
- API health: http://localhost:3000/health — HTTP 200 with `{"status":"ok"}`
- API records: http://localhost:3000/deployments

Enter an application name, environment, version, and status, then select **Create deployment**. Records appear newest first. Environment is free text (for example, `development`, `staging`, or `production`). Status is one of `pending`, `in_progress`, `succeeded`, or `failed`. All fields are required and limited to 100 characters after trimming.

The frontend serves a compiled React build through Nginx. Requests to `/api/` are proxied to Express, so the browser uses one origin. Compose waits for PostgreSQL and API health checks before starting their dependents, using [Docker's documented startup ordering](https://docs.docker.com/compose/how-tos/startup-order/). The API creates its table idempotently at startup; there is no separate migration service. `/health` is a process liveness endpoint, not an ongoing database readiness check.

Images use explicit version tags: Node `24.14.0-alpine3.23`, Nginx `1.28.2-alpine`, and PostgreSQL `17.9-alpine3.23`. No image uses `latest`. Tags are versioned but not immutable digest pins. npm lockfiles pin the resolved application dependencies, and Docker builds use `npm ci`.

## API

| Method | Path | Result |
| --- | --- | --- |
| GET | `/health` | 200, `{"status":"ok"}` |
| GET | `/deployments` | 200, array of deployment records |
| POST | `/deployments` | 201, created deployment record |

Example request body:

```json
{
  "application_name": "payments-api",
  "environment": "staging",
  "version": "1.0.0",
  "status": "succeeded"
}
```

Records also include an integer `id` and a `created_at` timestamp. Validation errors return 400 with a JSON `error`; oversized bodies return 413; unexpected database failures return 500 with a generic JSON `error`. Queries use PostgreSQL parameters.

PowerShell example:

```powershell
$body = @{ application_name = 'payments-api'; environment = 'staging'; version = '1.0.0'; status = 'succeeded' } | ConvertTo-Json
Invoke-RestMethod http://localhost:3000/deployments -Method Post -ContentType 'application/json' -Body $body
Invoke-RestMethod http://localhost:3000/deployments
```

## Persistence and lifecycle

Data lives in the Compose-managed `postgres_data` named volume. Stop containers without deleting records:

```sh
docker compose down
docker compose up -d --wait
```

Refresh the frontend after restarting to confirm the same records remain. To intentionally delete **all local deployment data**:

```sh
docker compose down -v
```

These are local demo credentials (`tracker` / `tracker_local`, database `deployments`), not production credentials. There is no authentication. The frontend and API ports bind to loopback only; PostgreSQL is available only on the Compose network. Change host ports in `docker-compose.yml` if 8080 or 3000 is occupied.

## Development and validation

Node.js 24+ is needed only for running npm commands outside Docker. On Windows PowerShell, use `npm.cmd` in place of `npm` if script execution policy blocks `npm.ps1`.

```sh
cd backend
npm ci
npm test
cd ../frontend
npm ci
npm run build
cd ..
docker compose config --quiet
```

API tests use Node's built-in test runner, real HTTP requests, and a stubbed database query interface. They cover health, listing, parameterized creation, invalid input, malformed/oversized JSON, database errors, and missing routes. They do not prove PostgreSQL persistence or container networking.

For frontend development with the Compose API running:

```sh
cd frontend
npm ci
npm run dev
```

Open the URL printed by Vite (normally http://localhost:5173). Its `/api` proxy targets the API at `127.0.0.1:3000`. To run the API separately, set `DATABASE_URL` to a reachable PostgreSQL connection string and run `npm start` in `backend`; `PORT` defaults to 3000. The Compose database does not publish a host port by default.

End-to-end manual check: start the Compose stack, open the frontend, create a record, refresh, then stop and restart with `docker compose down` / `docker compose up -d --wait` and confirm the record remains. Verify `/health` returns 200 and JSON. Use `docker compose ps` and `docker compose logs api db frontend` to troubleshoot. If Docker reports a missing engine pipe or daemon connection error, start Docker Desktop and ensure Linux containers are enabled.

## Files

- `frontend/`: React form and table, styling, Vite development proxy, production Nginx configuration and Dockerfile.
- `backend/`: Express routes, PostgreSQL connection/startup, SQL schema, HTTP tests and Dockerfile.
- `docker-compose.yml`: the three local services, health checks and persistent database volume.

## Implementation verification

Verified in the implementation environment:

- Clean `npm ci` installs for frontend and backend; both npm audits reported zero vulnerabilities.
- All seven backend HTTP tests passed.
- Frontend production build passed with Vite 7.3.6.
- Backend JavaScript syntax checks passed.
- `docker compose config --quiet` passed.
- Registry manifest checks confirmed all three versioned base/service image tags exist.

The Docker engine was unavailable (missing Docker Desktop Linux engine pipe). Container image builds, full-stack startup, browser interaction, and real PostgreSQL persistence were therefore not verified here. Run the end-to-end manual check above once Docker is running.
