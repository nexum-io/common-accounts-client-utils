# @nexum-io/common-accounts-client-utils

S2S HTTP client for [`core-accounts-storage-ms`](https://github.com/nexum-io/core-accounts-storage-ms) internal and user-scoped account routes.

Exports only:

- `CoreAccountsStorageClient` — axios transport (no `process.env` inside the package)
- `CoreAccountsStorageError` — transport error with `statusCode`, `errors`, `meta`

Product adapters and domain error maps stay in each MS.

**v0.2.0:** adds `CoreAccountsStorageClient#patchAccountMeta` (`PATCH /accounts/{id}/meta`, DEV-340). Storage client only — still no `CoreAccountsProcessorClient`.

## Install

```bash
npm install github:nexum-io/common-accounts-client-utils#v0.2.0
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

OpenAPI: `core-accounts-storage-ms/docs/openapi/internal-api.openapi.yaml`

## Develop

```bash
npm install
npm test
npm run ci:check
```
