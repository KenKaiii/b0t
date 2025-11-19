import { logger } from '@/lib/logger';
import { createRateLimiter, withRateLimit } from '@/lib/rate-limiter';
import { createCircuitBreaker } from '@/lib/resilience';

/**
 * Serper Module
 *
 * Google Search API via Serper.dev
 * - Web search
 * - Image search
 * - News search
 *
 * Requires SERPER_API_KEY environment variable.
 */

const SERPER_BASE_URL = 'https://google.serper.dev';

if (!process.env.SERPER_API_KEY) {
    logger.warn('⚠️  Serper credentials not set. Web search features will not work.');
}

// Rate limiter: Serper allows 100 req/month on free tier, but let's assume higher for paid
// Default to 1 request per second to be safe
const serperRateLimiter = createRateLimiter({
    maxConcurrent: 2,
    minTime: 500,
    id: 'serper',
});

export interface SerperSearchResult {
    title: string;
    link: string;
    snippet: string;
    date?: string;
    source?: string;
    imageUrl?: string;
    position?: number;
}

export interface SerperResponse {
    searchParameters: {
        q: string;
        type: string;
        engine: string;
    };
    organic?: Array<{
        title: string;
        link: string;
        snippet: string;
        date?: string;
        position: number;
    }>;
    images?: Array<{
        title: string;
        imageUrl: string;
        link: string;
        source: string;
    }>;
    news?: Array<{
        title: string;
        link: string;
        snippet: string;
        date: string;
        source: string;
        imageUrl?: string;
    }>;
    credits?: number;
}

/**
 * Internal search function
 */
async function searchInternal(
    query: string,
    type: 'search' | 'images' | 'news' = 'search',
    num: number = 10
): Promise<SerperResponse> {
    const apiKey = process.env.SERPER_API_KEY;

    if (!apiKey) {
        throw new Error('Serper API key not set. Set SERPER_API_KEY environment variable.');
    }

    logger.info({ query, type, num }, 'Executing Serper search');

    const response = await fetch(`${SERPER_BASE_URL}/${type}`, {
        method: 'POST',
        headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            q: query,
            num,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Serper API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as SerperResponse;

    logger.info({ credits: data.credits }, 'Serper search completed');

    return data;
}

/**
 * Circuit breaker for search
 */
const searchWithBreaker = createCircuitBreaker(searchInternal, {
    timeout: 10000,
    name: 'serper-search',
});

/**
 * Rate limited search
 */
const searchRateLimited = withRateLimit(
    async (query: string, type: 'search' | 'images' | 'news', num: number) =>
        searchWithBreaker.fire(query, type, num),
    serperRateLimiter
);

/**
 * Google Web Search
 */
export async function searchGoogle(
    query: string,
    limit: number = 10
): Promise<SerperSearchResult[]> {
    const data = await searchRateLimited(query, 'search', limit);

    if (!data.organic) {
        return [];
    }

    return data.organic.map(item => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        date: item.date,
        position: item.position,
    }));
}

/**
 * Google Image Search
 */
export async function searchImages(
    query: string,
    limit: number = 10
): Promise<SerperSearchResult[]> {
    const data = await searchRateLimited(query, 'images', limit);

    if (!data.images) {
        return [];
    }

    return data.images.map(item => ({
        title: item.title,
        link: item.link, // Context link
        snippet: item.source, // Use source as snippet
        imageUrl: item.imageUrl,
        source: item.source,
    }));
}

/**
 * Google News Search
 */
export async function searchNews(
    query: string,
    limit: number = 10
): Promise<SerperSearchResult[]> {
    const data = await searchRateLimited(query, 'news', limit);

    if (!data.news) {
        return [];
    }

    return data.news.map(item => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        date: item.date,
        source: item.source,
        imageUrl: item.imageUrl,
    }));
}
