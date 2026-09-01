jest.mock('axios');
const axios = require('axios');
const { CoreAccountsStorageClient, CoreAccountsStorageError } = require('../../src');

const logger = { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() };

function buildClient(overrides = {}) {
  return new CoreAccountsStorageClient({
    baseUrl: 'http://accounts-storage.example:8093',
    apiKey: 'test-api-key',
    logger,
    maxRetries: 2,
    retryBaseDelayMs: 1,
    ...overrides,
  });
}

describe('CoreAccountsStorageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('construction', () => {
    test('requires a logger', () => {
      expect(() => new CoreAccountsStorageClient({ baseUrl: 'http://x:8093', apiKey: 'k' }))
        .toThrow(/Logger is required/);
    });

    test('is enabled when baseUrl and apiKey resolve', () => {
      const client = buildClient();
      expect(client.enabled).toBe(true);
      expect(client.apiRoot).toBe('http://accounts-storage.example:8093/api/v1');
    });

    test('is disabled when endpoint/apiKey missing', () => {
      const client = new CoreAccountsStorageClient({ baseUrl: '', apiKey: '', logger });
      expect(client.enabled).toBe(false);
      expect(client.apiRoot).toBeNull();
    });

    test.each([
      'http://accounts-storage.example:8093/api',
      'http://accounts-storage.example:8093/api/v1',
    ])('rejects baseUrl already ending in /api suffix: %s', (baseUrl) => {
      expect(() => new CoreAccountsStorageClient({ baseUrl, apiKey: 'k', logger }))
        .toThrow(/bare service origin/);
    });
  });

  describe('registerOwned', () => {
    test('rejects when disabled', async () => {
      const client = new CoreAccountsStorageClient({ baseUrl: '', apiKey: '', logger });
      await expect(client.registerOwned({ ownedType: 'company', externalId: 'x' }))
        .rejects.toThrow(/not configured/);
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('POSTs /internal/owned without X-User-Subject and unwraps data', async () => {
      axios.post.mockResolvedValue({
        data: { success: true, data: { id: 'owned-1', ownedType: 'company' } },
      });
      const client = buildClient();
      const result = await client.registerOwned({ ownedType: 'company', externalId: 'ext-1' });
      expect(result).toEqual({ id: 'owned-1', ownedType: 'company' });
      expect(axios.post).toHaveBeenCalledWith(
        'http://accounts-storage.example:8093/api/v1/internal/owned',
        { ownedType: 'company', externalId: 'ext-1' },
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json', 'api-key': 'test-api-key' },
        })
      );
      const headers = axios.post.mock.calls[0][2].headers;
      expect(headers['X-User-Subject']).toBeUndefined();
    });
  });

  describe('getOwned', () => {
    test('GETs /internal/owned with query params and no X-User-Subject', async () => {
      axios.get.mockResolvedValue({ data: { data: { id: 'owned-1' } } });
      const client = buildClient();
      const result = await client.getOwned({ ownedType: 'user', externalId: 'u1' });
      expect(result).toEqual({ id: 'owned-1' });
      expect(axios.get).toHaveBeenCalledWith(
        'http://accounts-storage.example:8093/api/v1/internal/owned',
        expect.objectContaining({
          params: { ownedType: 'user', externalId: 'u1' },
          headers: expect.objectContaining({ 'api-key': 'test-api-key' }),
        })
      );
      expect(axios.get.mock.calls[0][1].headers['X-User-Subject']).toBeUndefined();
    });
  });

  describe('replaceOwnedMembers', () => {
    test('PUTs /internal/owned/:id/members without X-User-Subject', async () => {
      axios.put.mockResolvedValue({ data: { data: { id: 'owned-1', members: [] } } });
      const client = buildClient();
      await client.replaceOwnedMembers('owned-1', { members: ['0x1111111111111111111111111111111111111111'] });
      expect(axios.put).toHaveBeenCalledWith(
        'http://accounts-storage.example:8093/api/v1/internal/owned/owned-1/members',
        { members: ['0x1111111111111111111111111111111111111111'] },
        expect.objectContaining({
          headers: expect.objectContaining({ 'api-key': 'test-api-key' }),
        })
      );
      expect(axios.put.mock.calls[0][2].headers['X-User-Subject']).toBeUndefined();
    });
  });

  describe('listNetworks', () => {
    test('GETs /networks with X-User-Subject', async () => {
      axios.get.mockResolvedValue({ data: { data: [{ id: 'polygon' }] } });
      const client = buildClient();
      const result = await client.listNetworks('user-1', { active: true });
      expect(result).toEqual([{ id: 'polygon' }]);
      expect(axios.get).toHaveBeenCalledWith(
        'http://accounts-storage.example:8093/api/v1/networks',
        expect.objectContaining({
          params: { active: true },
          headers: expect.objectContaining({ 'X-User-Subject': 'user-1' }),
        })
      );
    });
  });

  describe('createAccount', () => {
    test('forwards X-User-Subject and posts /accounts', async () => {
      axios.post.mockResolvedValue({
        data: { success: true, data: { id: 'acct-1', status: 'PENDING' } },
      });
      const client = buildClient();
      await client.createAccount('user-1', {
        ownedType: 'company',
        externalId: 'ext-1',
        network: 'polygon',
        owners: ['0x1111111111111111111111111111111111111111'],
        threshold: 1,
      });
      expect(axios.post).toHaveBeenCalledWith(
        'http://accounts-storage.example:8093/api/v1/accounts',
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'api-key': 'test-api-key',
            'X-User-Subject': 'user-1',
          }),
        })
      );
    });
  });

  describe('listAccounts', () => {
    test('GETs /accounts with query params', async () => {
      axios.get.mockResolvedValue({ data: { data: [{ id: 'a1' }] } });
      const client = buildClient();
      const result = await client.listAccounts('user-1', {
        ownedType: 'user',
        externalId: 'user-1',
      });
      expect(result).toEqual([{ id: 'a1' }]);
      expect(axios.get).toHaveBeenCalledWith(
        'http://accounts-storage.example:8093/api/v1/accounts',
        expect.objectContaining({
          params: { ownedType: 'user', externalId: 'user-1' },
          headers: expect.objectContaining({ 'X-User-Subject': 'user-1' }),
        })
      );
    });
  });

  describe('getAccount', () => {
    test('GETs /accounts/:id with X-User-Subject', async () => {
      axios.get.mockResolvedValue({ data: { data: { id: 'acct-1' } } });
      const client = buildClient();
      const result = await client.getAccount('user-1', 'acct-1');
      expect(result).toEqual({ id: 'acct-1' });
      expect(axios.get).toHaveBeenCalledWith(
        'http://accounts-storage.example:8093/api/v1/accounts/acct-1',
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-User-Subject': 'user-1' }),
        })
      );
    });
  });

  describe('patchAccount', () => {
    test('PATCHes /accounts/:id with body and X-User-Subject', async () => {
      axios.patch.mockResolvedValue({ data: { data: { id: 'acct-1', label: 'Treasury' } } });
      const client = buildClient();
      await client.patchAccount('user-1', 'acct-1', { label: 'Treasury' });
      expect(axios.patch).toHaveBeenCalledWith(
        'http://accounts-storage.example:8093/api/v1/accounts/acct-1',
        { label: 'Treasury' },
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-User-Subject': 'user-1' }),
        })
      );
    });
  });

  describe('provisionAccount', () => {
    test('POSTs /accounts/:id/provision', async () => {
      axios.post.mockResolvedValue({ data: { data: { account: { status: 'DEPLOYED' } } } });
      const client = buildClient();
      await client.provisionAccount('user-1', 'acct-1');
      expect(axios.post).toHaveBeenCalledWith(
        'http://accounts-storage.example:8093/api/v1/accounts/acct-1/provision',
        {},
        expect.any(Object)
      );
    });
  });

  describe('syncAccountBalances', () => {
    test('POSTs /accounts/:id/balances/sync', async () => {
      axios.post.mockResolvedValue({ data: { data: { snapshot: { source: 'SYNC' } } } });
      const client = buildClient();
      await client.syncAccountBalances('user-1', 'acct-1');
      expect(axios.post).toHaveBeenCalledWith(
        'http://accounts-storage.example:8093/api/v1/accounts/acct-1/balances/sync',
        {},
        expect.any(Object)
      );
    });
  });

  describe('reconcileAccount', () => {
    test('POSTs /accounts/:id/reconcile', async () => {
      axios.post.mockResolvedValue({ data: { data: { status: 'RECONCILED' } } });
      const client = buildClient();
      await client.reconcileAccount('user-1', 'acct-1');
      expect(axios.post).toHaveBeenCalledWith(
        'http://accounts-storage.example:8093/api/v1/accounts/acct-1/reconcile',
        {},
        expect.any(Object)
      );
    });
  });

  describe('archiveAccount', () => {
    test('DELETEs /accounts/:id', async () => {
      axios.delete = jest.fn().mockResolvedValue({ data: { data: { id: 'acct-1', status: 'ARCHIVED' } } });
      const client = buildClient();
      await client.archiveAccount('user-1', 'acct-1');
      expect(axios.delete).toHaveBeenCalledWith(
        'http://accounts-storage.example:8093/api/v1/accounts/acct-1',
        expect.any(Object)
      );
    });
  });

  describe('errors', () => {
    test('wraps upstream envelope into CoreAccountsStorageError', async () => {
      axios.get.mockRejectedValue({
        response: {
          status: 404,
          data: { error: { code: 'NOT_FOUND', message: 'missing', details: ['x'] } },
        },
      });
      const client = buildClient({ maxRetries: 0 });
      await expect(client.getOwned({ ownedType: 'user', externalId: 'u1' })).rejects.toBeInstanceOf(
        CoreAccountsStorageError
      );
    });
  });
});
