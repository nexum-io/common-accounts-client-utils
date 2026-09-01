const axios = require('axios');

const { CoreAccountsStorageError } = require('./core-accounts-storage-error');
const { withRetry } = require('./with-retry');

const BARE_ORIGIN_TRAP_RE = /\/api(\/v\d+)?\/?$/;

/**
 * HTTP transport to `core-accounts-storage-ms`.
 *
 * Trust-boundary: constructor reads NO global config — container resolves
 * appConfig → constructor args. `baseUrl` is bare origin only; this client
 * appends `/api/v1` once. Paths below are either `/internal/...` (api-key)
 * or user routes that also forward `X-User-Subject`.
 */
class CoreAccountsStorageClient {
  constructor({
    baseUrl,
    apiKey,
    logger,
    timeoutMs = 30000,
    maxRetries = 2,
    retryBaseDelayMs = 250,
    apiPath = '/api/v1',
  } = {}) {
    const resolvedBaseUrl = (baseUrl ?? '').trim().replace(/\/+$/, '');
    const resolvedApiKey = apiKey ?? null;

    if (!logger) {
      throw new Error('Logger is required for CoreAccountsStorageClient');
    }

    if (resolvedBaseUrl && BARE_ORIGIN_TRAP_RE.test(resolvedBaseUrl)) {
      throw new Error(
        `Accounts storage client baseUrl must be the bare service origin, not pre-suffixed with `
        + `/api or /api/vN (got "${resolvedBaseUrl}") — this client appends `
        + `"${apiPath}" itself`
      );
    }

    this.logger = logger;
    this.baseUrl = resolvedBaseUrl;
    this.apiKey = resolvedApiKey;
    this.enabled = Boolean(resolvedBaseUrl && resolvedApiKey);
    this.apiRoot = this.enabled ? `${resolvedBaseUrl}${apiPath}` : null;
    this.defaultTimeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.retryBaseDelayMs = retryBaseDelayMs;
  }

  #assertEnabled() {
    if (!this.enabled) {
      throw new Error(
        'Accounts storage client is not configured '
        + '(CORE_ACCOUNTS_STORAGE_API_ENDPOINT / CORE_ACCOUNTS_STORAGE_API_KEY)'
      );
    }
  }

  #headers(userSubject) {
    const headers = {
      'Content-Type': 'application/json',
      'api-key': this.apiKey,
    };
    if (userSubject) {
      headers['X-User-Subject'] = userSubject;
    }
    return headers;
  }

  #unwrapResponse(response) {
    const body = response.data;
    if (body && Object.prototype.hasOwnProperty.call(body, 'data')) {
      return body.data;
    }
    return body;
  }

  #wrapError(error, method, path) {
    const response = error.response;
    const envelope = response?.data?.error;
    const statusCode = response?.status ?? 502;
    const fallbackMessage = envelope?.message ?? error.message ?? 'Accounts storage request failed';
    const details = Array.isArray(envelope?.details) && envelope.details.length > 0
      ? envelope.details
      : [fallbackMessage];

    return new CoreAccountsStorageError(
      `Accounts storage ${method} ${path} failed (${statusCode}): ${fallbackMessage}`,
      statusCode,
      details,
      {
        storageCode: envelope?.code ?? null,
        storageMessage: envelope?.message ?? error.message ?? null,
        noResponse: !response,
      }
    );
  }

  async #withRetry(method, path, requestFn, { maxRetries = this.maxRetries } = {}) {
    return withRetry(
      async () => {
        try {
          return await requestFn();
        } catch (error) {
          throw this.#wrapError(error, method, path);
        }
      },
      {
        maxRetries,
        baseDelay: this.retryBaseDelayMs,
        shouldRetry: (error) => error.statusCode === 429 || error.statusCode >= 500,
        onRetry: (attempt, error, delayMs) => {
          this.logger.warn('Accounts storage HTTP request retry', {
            context: {
              method,
              path,
              attempt,
              delayMs,
              statusCode: error.statusCode,
              message: error.message,
            },
          });
        },
      }
    );
  }

  async #request(method, path, { userSubject, body, params, options = {} } = {}) {
    this.#assertEnabled();
    const timeout = options.timeoutMs ?? this.defaultTimeoutMs;
    const maxRetries = options.maxRetries ?? this.maxRetries;
    const url = `${this.apiRoot}${path}`;
    const config = {
      headers: this.#headers(userSubject),
      timeout,
      params,
      validateStatus: (status) => status >= 200 && status < 300,
    };

    return this.#withRetry(method, path, () => {
      let promise;
      switch (method) {
        case 'GET':
          promise = axios.get(url, config);
          break;
        case 'POST':
          promise = axios.post(url, body ?? {}, config);
          break;
        case 'PUT':
          promise = axios.put(url, body ?? {}, config);
          break;
        case 'PATCH':
          promise = axios.patch(url, body ?? {}, config);
          break;
        case 'DELETE':
          promise = axios.delete(url, config);
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${method}`);
      }
      return promise.then((response) => this.#unwrapResponse(response));
    }, { maxRetries });
  }

  registerOwned(body) {
    return this.#request('POST', '/internal/owned', { body });
  }

  getOwned(query) {
    return this.#request('GET', '/internal/owned', { params: query });
  }

  replaceOwnedMembers(ownedId, body) {
    return this.#request('PUT', `/internal/owned/${ownedId}/members`, { body });
  }
}

module.exports = { CoreAccountsStorageClient };
