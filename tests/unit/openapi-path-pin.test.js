jest.mock('axios');

const axios = require('axios');
const { CoreAccountsStorageClient } = require('../../src');

/** Keep in sync with core-accounts-storage-ms tests/contract/accounts-client-openapi-paths.test.js */
const CLIENT_OPERATIONS = [
  ['POST', '/internal/owned'],
  ['GET', '/internal/owned'],
  ['PUT', '/internal/owned/{id}/members'],
  ['GET', '/networks'],
  ['POST', '/accounts'],
  ['GET', '/accounts'],
  ['GET', '/accounts/{id}'],
  ['PATCH', '/accounts/{id}'],
  ['PATCH', '/accounts/{id}/meta'],
  ['DELETE', '/accounts/{id}'],
  ['POST', '/accounts/{id}/provision'],
  ['POST', '/accounts/{id}/balances/sync'],
  ['POST', '/accounts/{id}/reconcile'],
];

const logger = { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() };
const ACCOUNT_ID = 'acct-1';
const OWNED_ID = 'owned-1';

function templatePath(url) {
  const path = url.replace('http://accounts.example:8093/api/v1', '');
  return path
    .replace(`/accounts/${ACCOUNT_ID}`, '/accounts/{id}')
    .replace(`/internal/owned/${OWNED_ID}`, '/internal/owned/{id}');
}

function recordedCalls() {
  const calls = [];
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    for (const call of axios[method].mock.calls) {
      const url = method === 'get' || method === 'delete' ? call[0] : call[0];
      calls.push([method.toUpperCase(), templatePath(url)]);
    }
  }
  return calls.sort((a, b) => `${a[0]} ${a[1]}`.localeCompare(`${b[0]} ${b[1]}`));
}

test('every public client method hits the pinned OpenAPI operations and nothing else', async () => {
  const ok = { data: { success: true, data: { ok: true } } };
  axios.get.mockResolvedValue(ok);
  axios.post.mockResolvedValue(ok);
  axios.put.mockResolvedValue(ok);
  axios.patch.mockResolvedValue(ok);
  axios.delete.mockResolvedValue(ok);

  const client = new CoreAccountsStorageClient({
    baseUrl: 'http://accounts.example:8093',
    apiKey: 'k',
    logger,
    maxRetries: 0,
  });

  await client.registerOwned({});
  await client.getOwned({});
  await client.replaceOwnedMembers(OWNED_ID, {});
  await client.listNetworks('user-1');
  await client.createAccount('user-1', {});
  await client.listAccounts('user-1', {});
  await client.getAccount('user-1', ACCOUNT_ID);
  await client.patchAccount('user-1', ACCOUNT_ID, {});
  await client.patchAccountMeta('user-1', ACCOUNT_ID, {});
  await client.archiveAccount('user-1', ACCOUNT_ID);
  await client.provisionAccount('user-1', ACCOUNT_ID);
  await client.syncAccountBalances('user-1', ACCOUNT_ID);
  await client.reconcileAccount('user-1', ACCOUNT_ID);

  const expected = [...CLIENT_OPERATIONS].sort((a, b) => `${a[0]} ${a[1]}`.localeCompare(`${b[0]} ${b[1]}`));
  expect(recordedCalls()).toEqual(expected);
});
