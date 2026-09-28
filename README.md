# @nexum-io/common-accounts-client-utils

S2S HTTP client for [`core-accounts-storage-ms`](https://github.com/nexum-io/core-accounts-storage-ms) internal and user-scoped account routes.

Exports only:

- `CoreAccountsStorageClient` — axios transport (no `process.env` inside the package)
- `CoreAccountsStorageError` — transport error with `statusCode`, `errors`, `meta`

Product adapters and domain error maps stay in each MS.

**v0.3.0 (ARCH-005):** optional constructor `getDelegationJwt`. When set, user-scoped methods send `X-Delegation-JWT` and **do not** send `X-User-Subject`. Without the callback, legacy `X-User-Subject` behavior remains (Escrow carve-out). Owned `/internal/*` methods never send either header.

## Install

```bash
npm install github:nexum-io/common-accounts-client-utils#v0.4.0
```

## Usage

```js
const {
  CoreAccountsStorageClient,
  CoreAccountsStorageError,
} = require('@nexum-io/common-accounts-client-utils');

const client = new CoreAccountsStorageClient({
  baseUrl: process.env.CORE_ACCOUNTS_STORAGE_BASE_URL, // bare origin only
  apiKey: process.env.CORE_ACCOUNTS_STORAGE_API_KEY,
  logger,
  timeoutMs: Number(process.env.CORE_ACCOUNTS_STORAGE_HTTP_TIMEOUT_MS) || 30000,
  maxRetries: Number(process.env.CORE_ACCOUNTS_STORAGE_HTTP_MAX_RETRIES) || 2,
  retryBaseDelayMs: Number(process.env.CORE_ACCOUNTS_STORAGE_RETRY_BASE_DELAY_MS) || 250,
  // Business (ARCH-005): exchange access → delegation for aud=core-accounts-storage-ms
  getDelegationJwt: async ({ userSubject }) => exchangeDelegationJwt({ userSubject }),
});
```

`baseUrl` must be the bare service origin (e.g. `http://core-accounts-storage-ms:8093`). Do **not** suffix `/api` or `/api/v1` — the client appends `/api/v1` itself.

During migration, consumers may resolve `baseUrl` from `CORE_ACCOUNTS_STORAGE_API_ENDPOINT` instead of `CORE_ACCOUNTS_STORAGE_BASE_URL`.

## Consumer ENV

| Variable | Description |
|----------|-------------|
| `CORE_ACCOUNTS_STORAGE_BASE_URL` | Bare origin (canonical) |
| `CORE_ACCOUNTS_STORAGE_API_ENDPOINT` | Alias during migration |
| `CORE_ACCOUNTS_STORAGE_API_KEY` | Product `api-key` |
| `CORE_ACCOUNTS_STORAGE_HTTP_TIMEOUT_MS` | default `30000` |
| `CORE_ACCOUNTS_STORAGE_HTTP_MAX_RETRIES` | default `2` |
| `CORE_ACCOUNTS_STORAGE_RETRY_BASE_DELAY_MS` | default `250` |

## Contract

Provider OpenAPI `info.version` **0.3.3**: `core-accounts-storage-ms/docs/openapi/internal-api.openapi.yaml`.

Package tag **v0.3.0** spoke OpenAPI `0.3.0`. Tag **v0.4.0** speaks OpenAPI **`0.3.3`** (same wire; account DTO documented on create, list, get, patch, archive, and patch-meta) and adds outbound `x-correlation-id` / `x-request-id` (ALS `correlation_id` when `@nexum-io/common-observability-logging-package` is installed in the host; otherwise a UUID). The observability package is an optional peer. Response-schema fixtures live under `tests/unit/fixtures/accounts-client-response-schemas.json` and must stay in sync with the provider fixture. A later package tag may keep speaking OpenAPI `0.3.3` until the HTTP surface changes. Package version and `info.version` are not required to stay equal.

Release order for a surface change: update the provider OpenAPI, deploy the provider, tag the client, then bump consumer pins.

Floor: new consumer pins use `#v0.3.0` or newer. Business, Escrow, and Partners already pin `#v0.3.0` / `#v0.4.0`. Do not remove an operation that tag calls unless the floor is raised and those pins have moved.

## Develop

```bash
npm install
npm test
npm run ci:check
```
