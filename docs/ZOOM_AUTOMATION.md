# Zoom Automation Module

Complete Zoom automation for meetings, webinars, recordings, and user management.

## Setup

1. **Create a Server-to-Server OAuth App** in [Zoom Marketplace](https://marketplace.zoom.us/)
   - Go to "Develop" → "Build App" → "Server-to-Server OAuth"
   - Add required scopes:
     - `meeting:write:admin` - Create and manage meetings
     - `meeting:read:admin` - Read meeting details
     - `recording:write:admin` - Manage recordings
     - `recording:read:admin` - Read recordings
     - `user:read:admin` - Read user information
     - `webinar:write:admin` - Create and manage webinars
     - `webinar:read:admin` - Read webinar details

2. **Set Environment Variables**:
   ```bash
   ZOOM_ACCOUNT_ID=your_account_id
   ZOOM_CLIENT_ID=your_client_id
   ZOOM_CLIENT_SECRET=your_client_secret
   ```

## Available Functions

### Meeting Management

#### `productivity.zoom.createMeeting`
Create a new Zoom meeting.

```javascript
// Scheduled meeting
{
  "function": "productivity.zoom.createMeeting",
  "args": {
    "meeting": {
      "topic": "Team Standup",
      "type": 2,  // 2 = Scheduled meeting
      "start_time": "2024-12-01T10:00:00Z",
      "duration": 30,
      "timezone": "America/New_York",
      "agenda": "Daily standup meeting",
      "settings": {
        "host_video": true,
        "participant_video": true,
        "waiting_room": true,
        "auto_recording": "cloud"
      }
    }
  },
  "outputAs": "meeting"
}
```

Meeting Types:
- `1` - Instant meeting (starts immediately)
- `2` - Scheduled meeting
- `3` - Recurring meeting (no fixed time)
- `8` - Recurring meeting (fixed time)

#### `productivity.zoom.createInstantMeeting`
Create a meeting that starts immediately.

```javascript
{
  "function": "productivity.zoom.createInstantMeeting",
  "args": {
    "topic": "Quick Team Sync",
    "settings": {
      "host_video": true,
      "participant_video": true
    }
  },
  "outputAs": "instantMeeting"
}
```

#### `productivity.zoom.createScheduledMeeting`
Convenience function for scheduled meetings.

```javascript
{
  "function": "productivity.zoom.createScheduledMeeting",
  "args": {
    "topic": "Product Review",
    "startTime": "2024-12-01T15:00:00Z",
    "duration": 60,
    "options": {
      "agenda": "Q4 product review",
      "password": "secure123",
      "timezone": "UTC"
    }
  },
  "outputAs": "scheduledMeeting"
}
```

#### `productivity.zoom.getMeeting`
Get meeting details.

```javascript
{
  "function": "productivity.zoom.getMeeting",
  "args": {
    "meetingId": "{{meeting.id}}"
  },
  "outputAs": "meetingDetails"
}
```

#### `productivity.zoom.updateMeeting`
Update an existing meeting.

```javascript
{
  "function": "productivity.zoom.updateMeeting",
  "args": {
    "meetingId": "{{meeting.id}}",
    "updates": {
      "topic": "Updated Meeting Title",
      "start_time": "2024-12-01T16:00:00Z",
      "duration": 45
    }
  }
}
```

#### `productivity.zoom.deleteMeeting`
Delete a meeting.

```javascript
{
  "function": "productivity.zoom.deleteMeeting",
  "args": {
    "meetingId": "{{meeting.id}}"
  }
}
```

#### `productivity.zoom.listMeetings`
List meetings for a user.

```javascript
{
  "function": "productivity.zoom.listMeetings",
  "args": {
    "options": {
      "type": "upcoming",
      "pageSize": 10
    }
  },
  "outputAs": "meetings"
}
```

Meeting list types:
- `scheduled` - All scheduled meetings
- `live` - Currently live meetings
- `upcoming` - Upcoming meetings
- `previous_meetings` - Past meetings

#### `productivity.zoom.getUpcomingMeetings`
Quick way to get upcoming meetings.

```javascript
{
  "function": "productivity.zoom.getUpcomingMeetings",
  "args": {
    "userId": "me",
    "pageSize": 30
  },
  "outputAs": "upcomingMeetings"
}
```

### Recording Management

#### `productivity.zoom.getMeetingRecordings`
Get recordings for a specific meeting.

```javascript
{
  "function": "productivity.zoom.getMeetingRecordings",
  "args": {
    "meetingId": "{{meeting.id}}"
  },
  "outputAs": "recordings"
}
```

#### `productivity.zoom.listRecordings`
List all cloud recordings.

```javascript
{
  "function": "productivity.zoom.listRecordings",
  "args": {
    "userId": "me",
    "from": "2024-11-01",
    "to": "2024-11-30",
    "pageSize": 30
  },
  "outputAs": "allRecordings"
}
```

#### `productivity.zoom.deleteRecording`
Delete a recording.

```javascript
{
  "function": "productivity.zoom.deleteRecording",
  "args": {
    "meetingId": "{{meeting.id}}",
    "recordingId": "{{recordings.recording_files[0].id}}"
  }
}
```

### User Management

#### `productivity.zoom.getUser`
Get user details.

```javascript
{
  "function": "productivity.zoom.getUser",
  "args": {
    "userId": "me"
  },
  "outputAs": "currentUser"
}
```

#### `productivity.zoom.getCurrentUser`
Get current authenticated user.

```javascript
{
  "function": "productivity.zoom.getCurrentUser",
  "args": {},
  "outputAs": "user"
}
```

#### `productivity.zoom.listUsers`
List users in the account.

```javascript
{
  "function": "productivity.zoom.listUsers",
  "args": {
    "status": "active",
    "pageSize": 30
  },
  "outputAs": "users"
}
```

User status options:
- `active` - Active users
- `inactive` - Inactive users
- `pending` - Pending users

### Webinar Management

#### `productivity.zoom.createWebinar`
Create a Zoom webinar.

```javascript
{
  "function": "productivity.zoom.createWebinar",
  "args": {
    "webinar": {
      "topic": "Product Launch",
      "type": 5,  // 5 = Webinar
      "start_time": "2024-12-15T14:00:00Z",
      "duration": 90,
      "timezone": "America/New_York",
      "agenda": "Launching our new product line",
      "settings": {
        "host_video": true,
        "panelists_video": true,
        "practice_session": true,
        "hd_video": true,
        "auto_recording": "cloud",
        "on_demand": true
      }
    }
  },
  "outputAs": "webinar"
}
```

Webinar Types:
- `5` - Webinar
- `6` - Recurring webinar (no fixed time)
- `9` - Recurring webinar (fixed time)

#### `productivity.zoom.getWebinar`
Get webinar details.

```javascript
{
  "function": "productivity.zoom.getWebinar",
  "args": {
    "webinarId": "{{webinar.id}}"
  },
  "outputAs": "webinarDetails"
}
```

#### `productivity.zoom.listWebinars`
List webinars for a user.

```javascript
{
  "function": "productivity.zoom.listWebinars",
  "args": {
    "userId": "me",
    "pageSize": 30
  },
  "outputAs": "webinars"
}
```

## Common Workflow Examples

### 1. Daily Standup Automation

Create a recurring daily standup meeting:

```json
{
  "name": "Daily Standup Automation",
  "config": {
    "steps": [
      {
        "function": "productivity.zoom.createMeeting",
        "args": {
          "meeting": {
            "topic": "Daily Team Standup",
            "type": 8,
            "start_time": "2024-12-01T09:00:00Z",
            "duration": 15,
            "timezone": "America/New_York",
            "settings": {
              "host_video": true,
              "participant_video": true,
              "waiting_room": false,
              "auto_recording": "cloud"
            }
          }
        },
        "outputAs": "meeting"
      },
      {
        "function": "communication.slack.postMessage",
        "args": {
          "channel": "#team",
          "text": "Daily standup starting soon! Join here: {{meeting.join_url}}"
        }
      }
    ]
  }
}
```

### 2. Meeting Summary Workflow

Get meeting recordings and send summary:

```json
{
  "name": "Meeting Recording Summary",
  "config": {
    "steps": [
      {
        "function": "productivity.zoom.listRecordings",
        "args": {
          "userId": "me",
          "from": "2024-11-01",
          "to": "2024-11-30"
        },
        "outputAs": "recordings"
      },
      {
        "function": "ai.openai.chat",
        "args": {
          "messages": [
            {
              "role": "system",
              "content": "Summarize meeting recordings"
            },
            {
              "role": "user",
              "content": "Create a summary of these meetings: {{recordings}}"
            }
          ]
        },
        "outputAs": "summary"
      },
      {
        "function": "communication.email.sendEmail",
        "args": {
          "from": "bot@example.com",
          "to": "team@example.com",
          "subject": "Meeting Recordings Summary",
          "html": "{{summary.choices[0].message.content}}"
        }
      }
    ]
  }
}
```

### 3. On-Demand Webinar Setup

Create an on-demand webinar with automated notifications:

```json
{
  "name": "On-Demand Webinar Setup",
  "config": {
    "steps": [
      {
        "function": "productivity.zoom.createWebinar",
        "args": {
          "webinar": {
            "topic": "Product Demo Webinar",
            "type": 5,
            "start_time": "2024-12-10T15:00:00Z",
            "duration": 60,
            "timezone": "UTC",
            "settings": {
              "host_video": true,
              "panelists_video": true,
              "hd_video": true,
              "auto_recording": "cloud",
              "on_demand": true
            }
          }
        },
        "outputAs": "webinar"
      },
      {
        "function": "social.twitter.postTweet",
        "args": {
          "text": "Join our product demo webinar! Register here: {{webinar.join_url}}"
        }
      },
      {
        "function": "communication.email.sendEmail",
        "args": {
          "from": "webinars@example.com",
          "to": "marketing@example.com",
          "subject": "New Webinar Created",
          "html": "<p>Webinar created: {{webinar.topic}}</p><p>Join URL: {{webinar.join_url}}</p>"
        }
      }
    ]
  }
}
```

### 4. Meeting Cleanup Automation

Automatically delete old recordings to save storage:

```json
{
  "name": "Recording Cleanup",
  "config": {
    "steps": [
      {
        "function": "productivity.zoom.listRecordings",
        "args": {
          "userId": "me",
          "from": "2024-01-01",
          "to": "2024-06-30"
        },
        "outputAs": "oldRecordings"
      },
      {
        "function": "productivity.zoom.deleteRecording",
        "args": {
          "meetingId": "{{oldRecordings.meetings[0].id}}"
        }
      }
    ]
  }
}
```

### 5. Team Meeting Scheduler

Schedule meetings based on team availability:

```json
{
  "name": "Team Meeting Scheduler",
  "config": {
    "steps": [
      {
        "function": "productivity.calendar.getFreeBusy",
        "args": {
          "timeMin": "2024-12-01T00:00:00Z",
          "timeMax": "2024-12-01T23:59:59Z",
          "calendarIds": ["team@example.com"]
        },
        "outputAs": "availability"
      },
      {
        "function": "productivity.zoom.createScheduledMeeting",
        "args": {
          "topic": "Team Sync",
          "startTime": "2024-12-01T14:00:00Z",
          "duration": 30,
          "options": {
            "agenda": "Weekly team sync"
          }
        },
        "outputAs": "meeting"
      },
      {
        "function": "productivity.calendar.createEvent",
        "args": {
          "summary": "Team Sync - Zoom",
          "description": "Join: {{meeting.join_url}}",
          "start": {
            "dateTime": "{{meeting.start_time}}"
          },
          "end": {
            "dateTime": "{{meeting.start_time}}"
          }
        }
      }
    ]
  }
}
```

## Rate Limiting

The Zoom module includes built-in rate limiting:
- **10 requests per second**
- **100 requests per second burst**
- Automatic request queuing
- Circuit breaker protection

## Error Handling

All functions include:
- Circuit breaker for resilience
- Automatic retry on rate limits
- Structured logging
- Detailed error messages

## Best Practices

1. **Use OAuth Tokens**: Server-to-Server OAuth is more secure than JWT
2. **Enable Cloud Recording**: Set `auto_recording: "cloud"` for automatic backups
3. **Use Waiting Rooms**: Enable for security: `waiting_room: true`
4. **Set Passwords**: Add passwords for sensitive meetings
5. **Monitor Rate Limits**: Check logs for rate limit warnings
6. **Clean Up Old Recordings**: Schedule periodic cleanup to save storage
7. **Use Timezones**: Always specify timezone for scheduled meetings

## Troubleshooting

### Authentication Errors

```
Error: Failed to get Zoom access token
```

**Solution**: Verify your environment variables:
- `ZOOM_ACCOUNT_ID`
- `ZOOM_CLIENT_ID`
- `ZOOM_CLIENT_SECRET`

### Permission Errors

```
Error: Insufficient privileges
```

**Solution**: Add required scopes in your Zoom app settings

### Rate Limit Errors

```
Rate limiter reservoir depleted
```

**Solution**: Reduce request frequency or increase time between calls

### Meeting Not Found

```
Error: Meeting does not exist
```

**Solution**: Verify the meeting ID and ensure the meeting hasn't been deleted

## Additional Resources

- [Zoom API Documentation](https://marketplace.zoom.us/docs/api-reference/zoom-api)
- [Zoom OAuth Guide](https://marketplace.zoom.us/docs/guides/build/server-to-server-oauth-app)
- [Zoom API Rate Limits](https://marketplace.zoom.us/docs/api-reference/rate-limits)
