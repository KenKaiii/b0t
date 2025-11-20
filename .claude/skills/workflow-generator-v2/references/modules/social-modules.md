# Social Media Modules Reference

## Available Platforms

Search with:
- `npm run modules:search twitter`
- `npm run modules:search linkedin`
- `npm run modules:search reddit`
- `npm run modules:search youtube`

## Twitter (Requires OAuth)

**Search tweets:**
```yaml
- module: social.twitter.searchTweets
  id: search
  inputs:
    query: "AI automation"
    maxResults: 10
```

**Reply to tweet:**
```yaml
- module: social.twitter.replyToTweet
  id: reply
  inputs:
    tweetId: "{{tweetId}}"
    text: "{{replyText}}"
```

## LinkedIn

Search with: `npm run modules:search linkedin`

## Reddit

Search with: `npm run modules:search reddit`

**Common pattern:**
```yaml
- module: social.reddit.search
  id: search
  inputs:
    query: "topic"
    limit: 10
```

## YouTube

Search with: `npm run modules:search youtube`

## Credentials

Social modules require OAuth tokens. Search for the specific module to see credential requirements.

## Deduplication Pattern (Important!)

For scheduled social workflows, use storage to avoid duplicates:

```yaml
steps:
  # 1. Search for content
  - module: social.twitter.searchTweets
    id: search
    inputs:
      query: "topic"
    outputAs: tweets

  # 2. Extract IDs
  - module: utilities.array-utils.pluck
    id: get-ids
    inputs:
      arr: "{{tweets}}"
      key: id
    outputAs: tweetIds

  # 3. Check which we've already processed
  - module: data.drizzle-utils.queryWhereIn
    id: check-processed
    inputs:
      workflowId: "{{workflowId}}"
      tableName: processed_tweets
      column: tweet_id
      values: "{{tweetIds}}"
    outputAs: processedIds

  # 4. Filter out already processed
  - module: utilities.javascript.execute
    id: filter-new
    inputs:
      code: "return tweets.filter(t => !processed.includes(t.id));"
      context:
        tweets: "{{tweets}}"
        processed: "{{processedIds}}"
    outputAs: newTweets

  # 5. Process new tweets...

  # 6. Store as processed
  - module: data.drizzle-utils.insertRecord
    id: mark-processed
    inputs:
      workflowId: "{{workflowId}}"
      tableName: processed_tweets
      data:
        tweet_id: "{{processedTweetId}}"
      ttl: 2592000  # 30 days
```
