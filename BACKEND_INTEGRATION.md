# AWS integration

The React application calls the Express API. Only the backend accesses DynamoDB and Cognito. Browser route guards help navigation; every sensitive API route independently verifies authentication and permissions.

```text
React browser → Express API (or API Gateway → Lambda → Express)
                           ├─ Amazon Cognito access-token verification
                           └─ Amazon DynamoDB single-table repository
```

## Configuration

Backend variables are documented in `backend/.env.example`. Set the region, DynamoDB table name, Cognito pool ID, app client ID, optional backend-only client secret, strong local-session signing secret, and exact allowed frontend origins. Leave `DYNAMODB_ENDPOINT` unset for AWS. Use the AWS SDK credential chain or a workload IAM role.

Set `AUTH_PROVIDER=cognito` for explicit AWS authentication. Missing required Cognito configuration fails instead of silently enabling local authentication. `AUTH_PROVIDER=local` is used only by the explicit isolated demo/test entry points. Legacy staff profiles with password hashes can still authenticate locally; replacing those profiles with managed Cognito staff identities is a release task.

Frontend `VITE_API_GATEWAY_URL=/api` supports the Vite proxy and unified Express deployment. For a separate API origin, use the actual HTTPS base URL **including its `/api` prefix** and allow that frontend origin in `CORS_ORIGINS`. Rebuild after changing frontend environment variables. `VITE_ENABLE_DEMO_HINTS` must be false for AWS builds.

The DynamoDB table requires string partition key `pk` and string sort key `sk`. Core queue correctness uses strong primary-table reads, conditional writes, and transactions; the new implementation does not require the legacy GSIs. Before introducing this schema into an existing populated table, reconcile legacy records and establish claims and counters described in `docs/RELEASE_READINESS.md`.

The backend role needs table-scoped `GetItem`, `BatchGetItem`, `Query`, `Scan`, `PutItem`, `UpdateItem`, `DeleteItem`, and `ConditionCheckItem` permissions. DynamoDB transactions use the underlying item-operation permissions; their condition checks require `dynamodb:ConditionCheckItem`. See [AWS transaction IAM documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis-iam.html). Local demo tooling additionally creates its dedicated local table and writes synthetic batches. Do not grant deployed application roles table creation/deletion rights for demo tooling. The expanded local dataset explicitly enables backfilled read models; do not create the `READ_MODELS/V1` activation marker in AWS until catalog, appointment, clinic visit and patient membership backfills have been reconciled.

## API surface

All paths below start with `/api`. Sensitive routes require `Authorization: Bearer <access token>`.

| Area | Routes | Access |
| --- | --- | --- |
| Authentication | `POST /auth/login`, `/auth/register`, `/auth/confirm-registration`, `/auth/forgot-password`, `/auth/confirm-forgot-password`; `GET /auth/me` | Public flows; verified session for `/me` |
| Directories | `GET /clinics`, `/doctors`, `/doctors/:id`, `/doctors/:id/slots?date=YYYY-MM-DD` | Public |
| Clinic configuration | `PATCH /clinics/:id`; `GET /settings`; `PUT /settings` | Assigned staff; admin-only edits |
| Doctor administration | `POST /doctors`; `PATCH /doctors/:id` | Assigned clinic administrator |
| Patients | `GET /patients`, `/patients/:id`, `/patients/me/status`; `PATCH /patients/:id` | Self or assigned staff; doctor patient scope |
| Appointments | `GET /appointments`; `POST /appointments`; `POST /appointments/:id/cancel` | Patient ownership or assigned staff; self-booking only |
| Queues | `GET /queues/all`, `/queues/doctor/:doctorId`; `POST /queues/join`, `/queues/call-next`, `/queues/pause` | Redacted patient view; assigned staff actions |
| Token transitions | `POST /tokens/:id/serve`, `/skip`, `/cancel` | Assigned staff; patients may cancel their own waiting token |
| Analytics | `GET /analytics`; `POST /analytics/models/refresh` | Assigned admin/health worker; admin-only model refresh |
| Liveness | `GET /health` | Public; does not verify downstream database connectivity |

Registration always creates a patient role. Cognito registration returns a pending confirmation state; the UI requests the real Cognito code before sign-in. Access tokens validate their signature, issuer, expiry, token use, and app-client ID with `aws-jwt-verify`, following [AWS token-verification guidance](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html). Local recovery cannot reset accounts using a fabricated OTP. Appointment names and phone numbers come from the verified patient profile. Unknown API routes return JSON 404, rather than the frontend HTML.

## Deployment verification

Build locally with `npm run build`. For a server deployment, `npm start` serves frontend assets and API on `PORT`. For Lambda, package the compiled backend and runtime dependencies, configure `backend/dist/lambda.handler`, and route API Gateway requests to it. Frontend static hosting is a separate deployment concern for Lambda.

The included integration suite verifies the adapter locally. It does not validate your deployed Gateway paths, Cognito pool settings, provider delivery, IAM policies, networking, or AWS throttling. Perform those checks on a dedicated AWS staging table with synthetic accounts before moving to production.
