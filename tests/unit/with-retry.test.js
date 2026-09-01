const { withRetry } = require('../../src/with-retry');

describe('withRetry', () => {
  test('returns on first success without retry', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, { maxRetries: 2, baseDelay: 1 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('retries when shouldRetry is true then succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('tmp'), { statusCode: 503 }))
      .mockResolvedValue('ok');
    const onRetry = jest.fn();
    await expect(
      withRetry(fn, {
        maxRetries: 2,
        baseDelay: 1,
        shouldRetry: (e) => e.statusCode >= 500,
        onRetry,
      })
    ).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('does not retry when shouldRetry is false', async () => {
    const err = Object.assign(new Error('nope'), { statusCode: 400 });
    const fn = jest.fn().mockRejectedValue(err);
    await expect(
      withRetry(fn, {
        maxRetries: 3,
        baseDelay: 1,
        shouldRetry: (e) => e.statusCode >= 500,
      })
    ).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
