import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchGoogle, searchImages, searchNews } from '../serper';

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

// Mock environment variables
vi.stubEnv('SERPER_API_KEY', 'test-api-key');

describe('Serper Module', () => {
    beforeEach(() => {
        fetchMock.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('searchGoogle', () => {
        it('should return search results', async () => {
            const mockResponse = {
                searchParameters: { q: 'test', type: 'search', engine: 'google' },
                organic: [
                    {
                        title: 'Test Result',
                        link: 'https://example.com',
                        snippet: 'This is a test result',
                        position: 1,
                    },
                ],
                credits: 1,
            };

            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const results = await searchGoogle('test');

            expect(fetchMock).toHaveBeenCalledWith('https://google.serper.dev/search', expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'X-API-KEY': 'test-api-key',
                }),
                body: JSON.stringify({ q: 'test', num: 10 }),
            }));

            expect(results).toHaveLength(1);
            expect(results[0]).toEqual({
                title: 'Test Result',
                link: 'https://example.com',
                snippet: 'This is a test result',
                position: 1,
                date: undefined,
            });
        });

        it('should handle empty results', async () => {
            const mockResponse = {
                searchParameters: { q: 'test', type: 'search', engine: 'google' },
                credits: 1,
            };

            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const results = await searchGoogle('test');
            expect(results).toEqual([]);
        });

        it('should throw error on API failure', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 403,
                text: async () => 'Unauthorized',
            });

            await expect(searchGoogle('test')).rejects.toThrow('Serper API error: 403 Unauthorized');
        });
    });

    describe('searchImages', () => {
        it('should return image results', async () => {
            const mockResponse = {
                searchParameters: { q: 'test', type: 'images', engine: 'google' },
                images: [
                    {
                        title: 'Test Image',
                        imageUrl: 'https://example.com/image.jpg',
                        link: 'https://example.com',
                        source: 'Example',
                    },
                ],
                credits: 1,
            };

            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const results = await searchImages('test');

            expect(fetchMock).toHaveBeenCalledWith('https://google.serper.dev/images', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ q: 'test', num: 10 }),
            }));

            expect(results).toHaveLength(1);
            expect(results[0]).toEqual({
                title: 'Test Image',
                link: 'https://example.com',
                snippet: 'Example',
                imageUrl: 'https://example.com/image.jpg',
                source: 'Example',
            });
        });
    });

    describe('searchNews', () => {
        it('should return news results', async () => {
            const mockResponse = {
                searchParameters: { q: 'test', type: 'news', engine: 'google' },
                news: [
                    {
                        title: 'Test News',
                        link: 'https://example.com/news',
                        snippet: 'This is news',
                        date: '1 hour ago',
                        source: 'News Source',
                        imageUrl: 'https://example.com/news.jpg',
                    },
                ],
                credits: 1,
            };

            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const results = await searchNews('test');

            expect(fetchMock).toHaveBeenCalledWith('https://google.serper.dev/news', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ q: 'test', num: 10 }),
            }));

            expect(results).toHaveLength(1);
            expect(results[0]).toEqual({
                title: 'Test News',
                link: 'https://example.com/news',
                snippet: 'This is news',
                date: '1 hour ago',
                source: 'News Source',
                imageUrl: 'https://example.com/news.jpg',
            });
        });
    });
});
