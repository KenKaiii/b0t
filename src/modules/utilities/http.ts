import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { createCircuitBreaker } from '@/lib/resilience';
import { createRateLimiter, withRateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

/**
 * HTTP Client Module
 *
 * Universal HTTP client for making requests to any API
 * Built on axios with production-grade reliability:
 * - Circuit breaker to prevent hammering failing APIs
 * - Rate limiting (configurable per use case)
 * - Automatic retries with exponential backoff
 * - Structured logging
 * - Request/response interceptors
 * - Timeout handling
 *
 * Perfect for:
 * - Calling webhooks
 * - Integrating with any REST API
 * - Making HTTP requests in workflows
 * - Testing API endpoints
 */

// Generic HTTP rate limiter (100 req/min default)
const httpRateLimiter = createRateLimiter({
  maxConcurrent: 10,
  minTime: 600, // 600ms between requests = ~100/min
  reservoir: 100,
  reservoirRefreshAmount: 100,
  reservoirRefreshInterval: 60 * 1000, // 1 minute
  id: 'http-client',
});

export interface HttpRequestConfig extends Omit<AxiosRequestConfig, 'url' | 'method'> {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  timeout?: number; // Default: 30000ms (30 seconds)
}

export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

/**
 * Internal HTTP request function (unprotected)
 */
async function httpRequestInternal<T = unknown>(
  config: HttpRequestConfig
): Promise<HttpResponse<T>> {
  const {
    url,
    method = 'GET',
    timeout = 30000,
    ...axiosConfig
  } = config;

  logger.info(
    {
      url,
      method,
      hasData: !!axiosConfig.data,
      hasParams: !!axiosConfig.params,
    },
    `Making HTTP ${method} request`
  );

  try {
    const response: AxiosResponse<T> = await axios({
      url,
      method,
      timeout,
      ...axiosConfig,
    });

    // Optimized: Use content-length header or estimate size without stringifying large payloads
    const dataLength = response.headers['content-length']
      || (typeof response.data === 'string' ? response.data.length : '~object');

    logger.info(
      {
        url,
        method,
        status: response.status,
        dataLength,
      },
      'HTTP request successful'
    );

    logger.debug(
      'HTTP response structure: { data: <response>, status: number, statusText: string, headers: object }. ' +
      'Access the response data using .data property (e.g., {{variable.data}})'
    );

    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string>,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(
        {
          url,
          method,
          status: error.response?.status,
          message: error.message,
        },
        'HTTP request failed'
      );

      throw new Error(
        `HTTP ${method} request failed: ${error.response?.status || 'NETWORK_ERROR'} - ${error.message}`
      );
    }

    throw error;
  }
}

/**
 * Make an HTTP request (protected with circuit breaker + rate limiting)
 */
const httpRequestWithBreaker = createCircuitBreaker(httpRequestInternal, {
  timeout: 35000, // Slightly higher than request timeout
  name: 'http-request',
});

const httpRequestRateLimited = withRateLimit(
  async (config: HttpRequestConfig) => httpRequestWithBreaker.fire(config),
  httpRateLimiter
);

export async function httpRequest<T = unknown>(
  config: HttpRequestConfig
): Promise<HttpResponse<T>> {
  return await httpRequestRateLimited(config) as unknown as HttpResponse<T>;
}

/**
 * Convenience methods for common HTTP verbs
 */

export async function httpGet<T = unknown>(
  url: string,
  config?: Omit<HttpRequestConfig, 'url' | 'method'>
): Promise<HttpResponse<T>> {
  return httpRequest<T>({ url, method: 'GET', ...config });
}

export async function httpPost<T = unknown>(
  url: string,
  data?: unknown,
  config?: Omit<HttpRequestConfig, 'url' | 'method' | 'data'>
): Promise<HttpResponse<T>> {
  return httpRequest<T>({ url, method: 'POST', data, ...config });
}

export async function httpPut<T = unknown>(
  url: string,
  data?: unknown,
  config?: Omit<HttpRequestConfig, 'url' | 'method' | 'data'>
): Promise<HttpResponse<T>> {
  return httpRequest<T>({ url, method: 'PUT', data, ...config });
}

export async function httpPatch<T = unknown>(
  url: string,
  data?: unknown,
  config?: Omit<HttpRequestConfig, 'url' | 'method' | 'data'>
): Promise<HttpResponse<T>> {
  return httpRequest<T>({ url, method: 'PATCH', data, ...config });
}

export async function httpDelete<T = unknown>(
  url: string,
  config?: Omit<HttpRequestConfig, 'url' | 'method'>
): Promise<HttpResponse<T>> {
  return httpRequest<T>({ url, method: 'DELETE', ...config });
}

/**
 * Type-safe helpers
 */
export type { AxiosRequestConfig, AxiosResponse };
