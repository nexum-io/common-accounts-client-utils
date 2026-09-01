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
