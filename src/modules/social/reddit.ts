import { createCircuitBreaker } from '@/lib/resilience';
import { createRateLimiter, withRateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

/**
 * Reddit Module
 *
 * Post, comment, and interact with Reddit
 * - Submit posts to subreddits
 * - Comment on posts
 * - Search and fetch posts
 * - Vote and reply
 * - Built-in resilience
 *
 * Perfect for:
 * - Community engagement
 * - Content distribution
 * - Social listening
 * - Marketing automation
 *
 * SECURITY NOTE:
 * This module uses direct Reddit API calls via fetch to avoid dependencies with vulnerabilities.
 */

// Rate limiter: Reddit allows ~60 req/min for authenticated users
const redditRateLimiter = createRateLimiter({
  maxConcurrent: 1,
  minTime: 1000, // 1 second between requests
  reservoir: 60,
  reservoirRefreshAmount: 60,
  reservoirRefreshInterval: 60 * 1000,
  id: 'reddit',
});

export interface RedditCredentials {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  userAgent?: string;
}

export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  url: string;
  author: string;
  subreddit: string;
  score: number;
  numComments: number;
  permalink: string;
}

export interface RedditSubmitOptions {
  subreddit: string;
  title: string;
  text?: string;
  url?: string;
  flairId?: string;
  sendReplies?: boolean;
  credentials?: RedditCredentials;
}

export interface RedditCommentOptions {
  postId: string;
  text: string;
  credentials?: RedditCredentials;
}

export interface RedditReplyOptions {
  commentId: string;
  text: string;
  credentials?: RedditCredentials;
}

export interface RedditGetPostsOptions {
  subreddit: string;
  sort?: 'hot' | 'new' | 'top' | 'rising';
  limit?: number;
  credentials?: RedditCredentials;
}

export interface RedditSearchOptions {
  query: string;
  subreddit?: string;
  limit?: number;
  credentials?: RedditCredentials;
}

export interface RedditVoteOptions {
  postId: string;
  credentials?: RedditCredentials;
}

class RedditClient {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private credentials: RedditCredentials;

  constructor(credentials: RedditCredentials) {
    this.credentials = credentials;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    logger.info('Refreshing Reddit access token');

    const { clientId, clientSecret, username, password } = this.credentials;
    const userAgent = this.credentials.userAgent || 'b0t:v1.0.0 (by /u/bot)';

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', username);
    params.append('password', password);

    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'User-Agent': userAgent,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get Reddit access token: ${response.status} ${text}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Reddit auth error: ${data.error}`);
    }

    this.accessToken = data.access_token;
    // Expire slightly before actual expiration (usually 3600s)
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

    return this.accessToken!;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getAccessToken();

    const url = endpoint.startsWith('http') ? endpoint : `https://oauth.reddit.com${endpoint}`;
    const userAgent = this.credentials.userAgent || 'b0t:v1.0.0 (by /u/bot)';

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'User-Agent': userAgent,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Reddit API error: ${response.status} ${text}`);
    }

    return response.json();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async post(endpoint: string, form: Record<string, any>): Promise<any> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(form)) {
      if (value !== undefined) {
        params.append(key, String(value));
      }
    }

    return this.request(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
  }
}

/**
 * Internal submit post function (unprotected)
 */
async function submitPostInternal(
  options: RedditSubmitOptions
): Promise<RedditPost> {
  if (!options.credentials) {
    throw new Error('Reddit credentials are required');
  }

  const client = new RedditClient(options.credentials);

  logger.info(
    {
      subreddit: options.subreddit,
      title: options.title.substring(0, 50),
      isLink: !!options.url,
    },
    'Submitting Reddit post'
  );

  const response = await client.post('/api/submit', {
    sr: options.subreddit,
    title: options.title,
    kind: options.url ? 'link' : 'self',
    url: options.url,
    text: options.text,
    flair_id: options.flairId,
    sendreplies: options.sendReplies,
    api_type: 'json',
  });

  if (response.json.errors && response.json.errors.length > 0) {
    throw new Error(`Reddit submit error: ${JSON.stringify(response.json.errors)}`);
  }

  const submission = response.json.data;

  logger.info({ postId: submission.id }, 'Reddit post submitted');

  return {
    id: submission.id,
    title: options.title, // API response might be minimal, use input
    selftext: options.text || '',
    url: submission.url,
    author: options.credentials.username, // We know who posted it
    subreddit: options.subreddit,
    score: 1,
    numComments: 0,
    permalink: `https://reddit.com${submission.url}`, // Usually redirects
  };
}

/**
 * Submit post (protected)
 */
const submitPostWithBreaker = createCircuitBreaker(submitPostInternal, {
  timeout: 15000,
  name: 'reddit-submit-post',
});

const submitPostRateLimited = withRateLimit(
  async (options: RedditSubmitOptions) => submitPostWithBreaker.fire(options),
  redditRateLimiter
);

export async function submitPost(
  options: RedditSubmitOptions
): Promise<RedditPost> {
  return (await submitPostRateLimited(options)) as unknown as RedditPost;
}

/**
 * Comment on post (internal implementation)
 */
async function commentOnPostInternal(
  options: RedditCommentOptions
): Promise<{ id: string; permalink: string }> {
  if (!options.credentials) {
    throw new Error('Reddit credentials are required');
  }

  const client = new RedditClient(options.credentials);

  logger.info({ postId: options.postId, textLength: options.text.length }, 'Commenting on Reddit post');

  // Ensure postId has kind prefix (e.g., t3_)
  const thingId = options.postId.includes('_') ? options.postId : `t3_${options.postId}`;

  const response = await client.post('/api/comment', {
    thing_id: thingId,
    text: options.text,
    api_type: 'json',
  });

  if (response.json.errors && response.json.errors.length > 0) {
    throw new Error(`Reddit comment error: ${JSON.stringify(response.json.errors)}`);
  }

  const comment = response.json.data.things[0].data;

  logger.info({ commentId: comment.id }, 'Reddit comment posted');

  return {
    id: comment.id,
    permalink: `https://reddit.com${comment.permalink || ''}`,
  };
}

/**
 * Comment on post (rate-limited for API protection)
 */
export const commentOnPost = withRateLimit(commentOnPostInternal, redditRateLimiter);

/**
 * Reply to comment (internal implementation)
 */
async function replyToCommentInternal(
  options: RedditReplyOptions
): Promise<{ id: string; permalink: string }> {
  if (!options.credentials) {
    throw new Error('Reddit credentials are required');
  }

  const client = new RedditClient(options.credentials);

  logger.info({ commentId: options.commentId, textLength: options.text.length }, 'Replying to Reddit comment');

  // Ensure commentId has kind prefix (e.g., t1_)
  const thingId = options.commentId.includes('_') ? options.commentId : `t1_${options.commentId}`;

  const response = await client.post('/api/comment', {
    thing_id: thingId,
    text: options.text,
    api_type: 'json',
  });

  if (response.json.errors && response.json.errors.length > 0) {
    throw new Error(`Reddit reply error: ${JSON.stringify(response.json.errors)}`);
  }

  const reply = response.json.data.things[0].data;

  logger.info({ replyId: reply.id }, 'Reddit reply posted');

  return {
    id: reply.id,
    permalink: `https://reddit.com${reply.permalink || ''}`,
  };
}

/**
 * Reply to comment (rate-limited for API protection)
 */
export const replyToComment = withRateLimit(replyToCommentInternal, redditRateLimiter);

/**
 * Get posts from subreddit (works without authentication using public API)
 */
export async function getSubredditPosts(
  options: RedditGetPostsOptions
): Promise<RedditPost[]> {
  const { subreddit, sort = 'hot', limit = 25, credentials } = options;
  logger.info({ subreddit, sort, limit }, 'Fetching Reddit posts');

  // Use authenticated client if available
  if (credentials) {
    const client = new RedditClient(credentials);
    const response = await client.request(`/r/${subreddit}/${sort}?limit=${limit}`);
    const posts = response.data.children;

    logger.info({ postCount: posts.length }, 'Reddit posts fetched (authenticated)');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return posts.map((item: any) => {
      const post = item.data;
      return {
        id: post.id,
        title: post.title,
        selftext: post.selftext,
        url: post.url,
        author: post.author,
        subreddit: post.subreddit,
        score: post.score,
        numComments: post.num_comments,
        permalink: `https://reddit.com${post.permalink}`,
      };
    });
  }

  // Fall back to public JSON API (no authentication required)
  logger.info('Using public Reddit JSON API (no authentication)');

  const url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/html',
    },
  });

  if (!response.ok) {
    throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await response.json();
  const posts = data.data.children;

  logger.info({ postCount: posts.length }, 'Reddit posts fetched (public API)');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return posts.map((item: any) => {
    const post = item.data;
    return {
      id: post.id,
      title: post.title,
      selftext: post.selftext || '',
      url: post.url,
      author: post.author,
      subreddit: post.subreddit,
      score: post.score,
      numComments: post.num_comments,
      permalink: `https://reddit.com${post.permalink}`,
    };
  });
}

/**
 * Search posts
 */
export async function searchPosts(
  options: RedditSearchOptions
): Promise<RedditPost[]> {
  const { query, subreddit, limit = 25, credentials } = options;

  if (!credentials) {
    throw new Error('Reddit credentials are required for search');
  }

  const client = new RedditClient(credentials);

  logger.info({ query, subreddit, limit }, 'Searching Reddit posts');

  const path = subreddit ? `/r/${subreddit}/search` : '/search';
  const response = await client.request(`${path}?q=${encodeURIComponent(query)}&limit=${limit}&restrict_sr=${!!subreddit}`);

  const results = response.data.children;

  logger.info({ resultCount: results.length }, 'Reddit search completed');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return results.map((item: any) => {
    const post = item.data;
    return {
      id: post.id,
      title: post.title,
      selftext: post.selftext,
      url: post.url,
      author: post.author,
      subreddit: post.subreddit,
      score: post.score,
      numComments: post.num_comments,
      permalink: `https://reddit.com${post.permalink}`,
    };
  });
}

/**
 * Upvote post
 */
export async function upvotePost(
  options: RedditVoteOptions
): Promise<void> {
  if (!options.credentials) {
    throw new Error('Reddit credentials are required');
  }

  const client = new RedditClient(options.credentials);

  logger.info({ postId: options.postId }, 'Upvoting Reddit post');

  const thingId = options.postId.includes('_') ? options.postId : `t3_${options.postId}`;

  await client.post('/api/vote', {
    id: thingId,
    dir: 1,
  });

  logger.info('Reddit post upvoted');
}

/**
 * Downvote post
 */
export async function downvotePost(
  options: RedditVoteOptions
): Promise<void> {
  if (!options.credentials) {
    throw new Error('Reddit credentials are required');
  }

  const client = new RedditClient(options.credentials);

  logger.info({ postId: options.postId }, 'Downvoting Reddit post');

  const thingId = options.postId.includes('_') ? options.postId : `t3_${options.postId}`;

  await client.post('/api/vote', {
    id: thingId,
    dir: -1,
  });

  logger.info('Reddit post downvoted');
}
