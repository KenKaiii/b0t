import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { submitPost, getSubredditPosts } from '../reddit';

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

const mockCredentials = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  username: 'test-username',
  password: 'test-password',
};

describe('Reddit Module', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    // Mock auth token response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'mock-token', expires_in: 3600 }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('submitPost', () => {
    it('should submit a text post', async () => {
      // Mock submit response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          json: {
            data: {
              id: 'test-id',
              url: 'https://reddit.com/r/test/comments/test-id',
            },
            errors: [],
          },
        }),
      });

      const result = await submitPost({
        subreddit: 'test',
        title: 'Test Post',
        text: 'Test Content',
        credentials: mockCredentials,
      });

      // Verify auth request
      expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://www.reddit.com/api/v1/access_token', expect.anything());

      // Verify submit request
      expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://oauth.reddit.com/api/submit', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer mock-token',
        }),
        body: expect.any(URLSearchParams),
      }));

      expect(result).toEqual({
        id: 'test-id',
        title: 'Test Post',
        selftext: 'Test Content',
        url: 'https://reddit.com/r/test/comments/test-id',
        author: 'test-username',
        subreddit: 'test',
        score: 1,
        numComments: 0,
        permalink: 'https://reddit.comhttps://reddit.com/r/test/comments/test-id',
      });
    });
  });

  describe('getSubredditPosts', () => {
    it('should fetch posts with credentials', async () => {
      // Mock posts response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            children: [
              {
                data: {
                  id: 'post-1',
                  title: 'Post 1',
                  selftext: 'Content 1',
                  url: 'http://url1',
                  author: 'author1',
                  subreddit: 'test',
                  score: 10,
                  num_comments: 5,
                  permalink: '/r/test/comments/post-1',
                },
              },
            ],
          },
        }),
      });

      const posts = await getSubredditPosts({
        subreddit: 'test',
        credentials: mockCredentials,
      });

      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe('Post 1');
    });
  });
});
