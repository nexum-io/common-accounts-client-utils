const { CoreAccountsStorageError } = require('../../src/core-accounts-storage-error');

describe('CoreAccountsStorageError', () => {
  test('stores statusCode, errors, and meta', () => {
    const err = new CoreAccountsStorageError('boom', 409, ['detail'], {
      storageCode: 'CONFLICT',
      storageMessage: 'already exists',
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('CoreAccountsStorageError');
    expect(err.message).toBe('boom');
    expect(err.statusCode).toBe(409);
    expect(err.errors).toEqual(['detail']);
    expect(err.meta.storageCode).toBe('CONFLICT');
  });

  test('defaults statusCode 502 and empty errors/meta', () => {
    const err = new CoreAccountsStorageError('x');
    expect(err.statusCode).toBe(502);
    expect(err.errors).toEqual([]);
    expect(err.meta).toEqual({});
  });
});
