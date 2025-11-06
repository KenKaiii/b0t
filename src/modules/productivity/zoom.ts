import axios, { AxiosInstance } from 'axios';
import CircuitBreaker from 'opossum';
import Bottleneck from 'bottleneck';
import { logger } from '@/lib/logger';

/**
 * Zoom Module
 *
 * Automate Zoom meetings and webinars
 * - Create and manage meetings
 * - List and update meetings
 * - Get meeting recordings
 * - Manage users
 * - Meeting settings and configurations
 * - Built-in resilience and rate limiting
 *
 * Perfect for:
 * - Automated meeting scheduling
 * - Recording management
 * - User provisioning
 * - Meeting analytics
 * - Webinar automation
 *
 * Setup:
 * 1. Create a Server-to-Server OAuth app in Zoom Marketplace
 * 2. Get Account ID, Client ID, and Client Secret
 * 3. Set environment variables:
 *    - ZOOM_ACCOUNT_ID
 *    - ZOOM_CLIENT_ID
 *    - ZOOM_CLIENT_SECRET
 */

const ZOOM_ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID;
const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID;
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;

if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
  logger.warn(
    '⚠️  Zoom credentials not set. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET.'
  );
}

// Rate limiter: Zoom allows ~10 requests per second
const zoomRateLimiter = new Bottleneck({
  minTime: 100, // Max 10 requests per second
  maxConcurrent: 5,
  reservoir: 100,
  reservoirRefreshAmount: 100,
  reservoirRefreshInterval: 1000, // Per second
});

// Access token cache
let cachedAccessToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Get OAuth access token for Server-to-Server OAuth
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedAccessToken && Date.now() < tokenExpiry) {
    return cachedAccessToken;
  }

  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    throw new Error(
      'Zoom credentials not configured. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET.'
    );
  }

  logger.info('Getting Zoom access token');

  try {
    const response = await axios.post(
      'https://zoom.us/oauth/token',
      new URLSearchParams({
        grant_type: 'account_credentials',
        account_id: ZOOM_ACCOUNT_ID,
      }),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`
          ).toString('base64')}`,
        },
      }
    );

    cachedAccessToken = response.data.access_token;
    // Set expiry 5 minutes before actual expiry for safety
    tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

    logger.info('Zoom access token obtained');

    return cachedAccessToken;
  } catch (error) {
    logger.error({ error }, 'Failed to get Zoom access token');
    throw new Error(
      `Failed to get Zoom access token: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Get authenticated Zoom API client
 */
async function getZoomClient(): Promise<AxiosInstance> {
  const accessToken = await getAccessToken();

  return axios.create({
    baseURL: 'https://api.zoom.us/v2',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
}

// ============================================================================
// Types
// ============================================================================

export interface ZoomMeeting {
  id?: number | string;
  uuid?: string;
  host_id?: string;
  host_email?: string;
  topic: string;
  type: 1 | 2 | 3 | 8; // 1=Instant, 2=Scheduled, 3=Recurring (no fixed time), 8=Recurring (fixed time)
  start_time?: string; // ISO 8601 format
  duration?: number; // Duration in minutes
  timezone?: string;
  agenda?: string;
  password?: string;
  settings?: {
    host_video?: boolean;
    participant_video?: boolean;
    join_before_host?: boolean;
    mute_upon_entry?: boolean;
    watermark?: boolean;
    use_pmi?: boolean;
    approval_type?: 0 | 1 | 2; // 0=Automatically approve, 1=Manually approve, 2=No registration required
    registration_type?: 1 | 2 | 3; // 1=Attendees register once, 2=Attendees register each occurrence, 3=Attendees register once and can choose occurrences
    audio?: 'both' | 'telephony' | 'voip';
    auto_recording?: 'local' | 'cloud' | 'none';
    waiting_room?: boolean;
    meeting_authentication?: boolean;
  };
  join_url?: string;
  start_url?: string;
  created_at?: string;
}

export interface ZoomMeetingListOptions {
  userId?: string; // 'me' or user ID
  type?: 'scheduled' | 'live' | 'upcoming' | 'previous_meetings';
  pageSize?: number;
  pageNumber?: number;
  from?: string; // Start date (YYYY-MM-DD)
  to?: string; // End date (YYYY-MM-DD)
}

export interface ZoomRecording {
  uuid: string;
  id: number;
  account_id: string;
  host_id: string;
  topic: string;
  start_time: string;
  duration: number;
  total_size: number;
  recording_count: number;
  share_url?: string;
  recording_files: Array<{
    id: string;
    meeting_id: string;
    recording_start: string;
    recording_end: string;
    file_type: string;
    file_size: number;
    download_url?: string;
    status?: string;
    recording_type: string;
  }>;
}

export interface ZoomUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  type: number; // 1=Basic, 2=Licensed, 3=On-prem
  pmi?: number;
  timezone?: string;
  verified?: number;
  created_at?: string;
  last_login_time?: string;
  status?: string;
}

export interface ZoomWebinar {
  id?: number;
  uuid?: string;
  host_id?: string;
  topic: string;
  type: 5 | 6 | 9; // 5=Webinar, 6=Recurring webinar (no fixed time), 9=Recurring webinar (fixed time)
  start_time?: string;
  duration?: number;
  timezone?: string;
  agenda?: string;
  settings?: {
    host_video?: boolean;
    panelists_video?: boolean;
    practice_session?: boolean;
    hd_video?: boolean;
    approval_type?: 0 | 1 | 2;
    registration_type?: 1 | 2 | 3;
    audio?: 'both' | 'telephony' | 'voip';
    auto_recording?: 'local' | 'cloud' | 'none';
    on_demand?: boolean;
  };
  join_url?: string;
}

// ============================================================================
// Meeting Functions
// ============================================================================

/**
 * Create a new Zoom meeting
 */
async function createMeetingInternal(
  meeting: ZoomMeeting,
  userId: string = 'me'
): Promise<ZoomMeeting> {
  logger.info({ topic: meeting.topic, userId }, 'Creating Zoom meeting');

  try {
    const client = await getZoomClient();

    const response = await client.post(`/users/${userId}/meetings`, meeting);

    logger.info(
      {
        meetingId: response.data.id,
        topic: meeting.topic,
        joinUrl: response.data.join_url,
      },
      'Zoom meeting created'
    );

    return response.data;
  } catch (error) {
    logger.error({ error, topic: meeting.topic }, 'Failed to create Zoom meeting');
    throw new Error(
      `Failed to create Zoom meeting: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

const createMeetingBreaker = new CircuitBreaker(createMeetingInternal, {
  timeout: 30000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  name: 'zoom-create-meeting',
});

const createMeetingRateLimited = zoomRateLimiter.wrap(
  async (meeting: ZoomMeeting, userId?: string) =>
    createMeetingBreaker.fire(meeting, userId)
);

export async function createMeeting(
  meeting: ZoomMeeting,
  userId: string = 'me'
): Promise<ZoomMeeting> {
  return (await createMeetingRateLimited(meeting, userId)) as ZoomMeeting;
}

/**
 * Get meeting details
 */
async function getMeetingInternal(meetingId: string | number): Promise<ZoomMeeting> {
  logger.info({ meetingId }, 'Getting Zoom meeting details');

  try {
    const client = await getZoomClient();

    const response = await client.get(`/meetings/${meetingId}`);

    logger.info({ meetingId, topic: response.data.topic }, 'Zoom meeting details retrieved');

    return response.data;
  } catch (error) {
    logger.error({ error, meetingId }, 'Failed to get Zoom meeting');
    throw new Error(
      `Failed to get Zoom meeting: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

const getMeetingBreaker = new CircuitBreaker(getMeetingInternal, {
  timeout: 30000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  name: 'zoom-get-meeting',
});

const getMeetingRateLimited = zoomRateLimiter.wrap(
  async (meetingId: string | number) => getMeetingBreaker.fire(meetingId)
);

export async function getMeeting(meetingId: string | number): Promise<ZoomMeeting> {
  return (await getMeetingRateLimited(meetingId)) as ZoomMeeting;
}

/**
 * Update a meeting
 */
async function updateMeetingInternal(
  meetingId: string | number,
  updates: Partial<ZoomMeeting>
): Promise<void> {
  logger.info({ meetingId, updates }, 'Updating Zoom meeting');

  try {
    const client = await getZoomClient();

    await client.patch(`/meetings/${meetingId}`, updates);

    logger.info({ meetingId }, 'Zoom meeting updated');
  } catch (error) {
    logger.error({ error, meetingId }, 'Failed to update Zoom meeting');
    throw new Error(
      `Failed to update Zoom meeting: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

const updateMeetingBreaker = new CircuitBreaker(updateMeetingInternal, {
  timeout: 30000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  name: 'zoom-update-meeting',
});

const updateMeetingRateLimited = zoomRateLimiter.wrap(
  async (meetingId: string | number, updates: Partial<ZoomMeeting>) =>
    updateMeetingBreaker.fire(meetingId, updates)
);

export async function updateMeeting(
  meetingId: string | number,
  updates: Partial<ZoomMeeting>
): Promise<void> {
  await updateMeetingRateLimited(meetingId, updates);
}

/**
 * Delete a meeting
 */
async function deleteMeetingInternal(meetingId: string | number): Promise<void> {
  logger.info({ meetingId }, 'Deleting Zoom meeting');

  try {
    const client = await getZoomClient();

    await client.delete(`/meetings/${meetingId}`);

    logger.info({ meetingId }, 'Zoom meeting deleted');
  } catch (error) {
    logger.error({ error, meetingId }, 'Failed to delete Zoom meeting');
    throw new Error(
      `Failed to delete Zoom meeting: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

const deleteMeetingBreaker = new CircuitBreaker(deleteMeetingInternal, {
  timeout: 30000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  name: 'zoom-delete-meeting',
});

const deleteMeetingRateLimited = zoomRateLimiter.wrap(
  async (meetingId: string | number) => deleteMeetingBreaker.fire(meetingId)
);

export async function deleteMeeting(meetingId: string | number): Promise<void> {
  await deleteMeetingRateLimited(meetingId);
}

/**
 * List meetings for a user
 */
async function listMeetingsInternal(
  options: ZoomMeetingListOptions = {}
): Promise<{ meetings: ZoomMeeting[]; total_records: number }> {
  const userId = options.userId || 'me';
  const type = options.type || 'scheduled';

  logger.info({ userId, type, options }, 'Listing Zoom meetings');

  try {
    const client = await getZoomClient();

    const params: Record<string, unknown> = {
      type,
      page_size: options.pageSize || 30,
      page_number: options.pageNumber || 1,
    };

    if (options.from) params.from = options.from;
    if (options.to) params.to = options.to;

    const response = await client.get(`/users/${userId}/meetings`, { params });

    logger.info(
      { userId, meetingCount: response.data.meetings?.length || 0 },
      'Zoom meetings listed'
    );

    return {
      meetings: response.data.meetings || [],
      total_records: response.data.total_records || 0,
    };
  } catch (error) {
    logger.error({ error, userId }, 'Failed to list Zoom meetings');
    throw new Error(
      `Failed to list Zoom meetings: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

const listMeetingsBreaker = new CircuitBreaker(listMeetingsInternal, {
  timeout: 30000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  name: 'zoom-list-meetings',
});

const listMeetingsRateLimited = zoomRateLimiter.wrap(
  async (options?: ZoomMeetingListOptions) => listMeetingsBreaker.fire(options)
);

export async function listMeetings(
  options: ZoomMeetingListOptions = {}
): Promise<{ meetings: ZoomMeeting[]; total_records: number }> {
  return (await listMeetingsRateLimited(options)) as {
    meetings: ZoomMeeting[];
    total_records: number;
  };
}

/**
 * Get upcoming meetings (convenience function)
 */
export async function getUpcomingMeetings(
  userId: string = 'me',
  pageSize: number = 30
): Promise<ZoomMeeting[]> {
  const result = await listMeetings({
    userId,
    type: 'upcoming',
    pageSize,
  });
  return result.meetings;
}

/**
 * Create instant meeting (starts immediately)
 */
export async function createInstantMeeting(
  topic: string,
  settings?: ZoomMeeting['settings']
): Promise<ZoomMeeting> {
  return createMeeting({
    topic,
    type: 1, // Instant meeting
    settings,
  });
}

/**
 * Create scheduled meeting (convenience function)
 */
export async function createScheduledMeeting(
  topic: string,
  startTime: Date,
  duration: number,
  options?: {
    agenda?: string;
    password?: string;
    settings?: ZoomMeeting['settings'];
    timezone?: string;
  }
): Promise<ZoomMeeting> {
  return createMeeting({
    topic,
    type: 2, // Scheduled meeting
    start_time: startTime.toISOString(),
    duration,
    timezone: options?.timezone || 'UTC',
    agenda: options?.agenda,
    password: options?.password,
    settings: options?.settings,
  });
}

// ============================================================================
// Recording Functions
// ============================================================================

/**
 * Get meeting recordings
 */
async function getMeetingRecordingsInternal(meetingId: string): Promise<ZoomRecording> {
  logger.info({ meetingId }, 'Getting Zoom meeting recordings');

  try {
    const client = await getZoomClient();

    const response = await client.get(`/meetings/${meetingId}/recordings`);

    logger.info(
      {
        meetingId,
        recordingCount: response.data.recording_count,
      },
      'Zoom recordings retrieved'
    );

    return response.data;
  } catch (error) {
    logger.error({ error, meetingId }, 'Failed to get Zoom recordings');
    throw new Error(
      `Failed to get Zoom recordings: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

const getMeetingRecordingsBreaker = new CircuitBreaker(getMeetingRecordingsInternal, {
  timeout: 30000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  name: 'zoom-get-recordings',
});

const getMeetingRecordingsRateLimited = zoomRateLimiter.wrap(
  async (meetingId: string) => getMeetingRecordingsBreaker.fire(meetingId)
);

export async function getMeetingRecordings(meetingId: string): Promise<ZoomRecording> {
  return (await getMeetingRecordingsRateLimited(meetingId)) as ZoomRecording;
}

/**
 * List all cloud recordings for a user
 */
async function listRecordingsInternal(
  userId: string = 'me',
  from?: string,
  to?: string,
  pageSize: number = 30
): Promise<{ meetings: ZoomRecording[] }> {
  logger.info({ userId, from, to }, 'Listing Zoom cloud recordings');

  try {
    const client = await getZoomClient();

    const params: Record<string, unknown> = {
      page_size: pageSize,
    };

    if (from) params.from = from;
    if (to) params.to = to;

    const response = await client.get(`/users/${userId}/recordings`, { params });

    logger.info(
      {
        userId,
        recordingCount: response.data.meetings?.length || 0,
      },
      'Zoom cloud recordings listed'
    );

    return {
      meetings: response.data.meetings || [],
    };
  } catch (error) {
    logger.error({ error, userId }, 'Failed to list Zoom recordings');
    throw new Error(
      `Failed to list Zoom recordings: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

const listRecordingsBreaker = new CircuitBreaker(listRecordingsInternal, {
  timeout: 30000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  name: 'zoom-list-recordings',
});

const listRecordingsRateLimited = zoomRateLimiter.wrap(
  async (userId?: string, from?: string, to?: string, pageSize?: number) =>
    listRecordingsBreaker.fire(userId, from, to, pageSize)
);

export async function listRecordings(
  userId: string = 'me',
  from?: string,
  to?: string,
  pageSize: number = 30
): Promise<{ meetings: ZoomRecording[] }> {
  return (await listRecordingsRateLimited(userId, from, to, pageSize)) as {
    meetings: ZoomRecording[];
  };
}

/**
 * Delete meeting recordings
 */
async function deleteRecordingInternal(
  meetingId: string,
  recordingId?: string
): Promise<void> {
  logger.info({ meetingId, recordingId }, 'Deleting Zoom recording');

  try {
    const client = await getZoomClient();

    const endpoint = recordingId
      ? `/meetings/${meetingId}/recordings/${recordingId}`
      : `/meetings/${meetingId}/recordings`;

    await client.delete(endpoint);

    logger.info({ meetingId, recordingId }, 'Zoom recording deleted');
  } catch (error) {
    logger.error({ error, meetingId, recordingId }, 'Failed to delete Zoom recording');
    throw new Error(
      `Failed to delete Zoom recording: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

const deleteRecordingBreaker = new CircuitBreaker(deleteRecordingInternal, {
  timeout: 30000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  name: 'zoom-delete-recording',
});

const deleteRecordingRateLimited = zoomRateLimiter.wrap(
  async (meetingId: string, recordingId?: string) =>
    deleteRecordingBreaker.fire(meetingId, recordingId)
);

export async function deleteRecording(
  meetingId: string,
  recordingId?: string
): Promise<void> {
  await deleteRecordingRateLimited(meetingId, recordingId);
}

// ============================================================================
// User Functions
// ============================================================================

/**
 * Get user details
 */
async function getUserInternal(userId: string = 'me'): Promise<ZoomUser> {
  logger.info({ userId }, 'Getting Zoom user details');

  try {
    const client = await getZoomClient();

    const response = await client.get(`/users/${userId}`);

    logger.info(
      { userId, email: response.data.email },
      'Zoom user details retrieved'
    );

    return response.data;
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get Zoom user');
    throw new Error(
      `Failed to get Zoom user: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

const getUserBreaker = new CircuitBreaker(getUserInternal, {
  timeout: 30000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  name: 'zoom-get-user',
});

const getUserRateLimited = zoomRateLimiter.wrap(
  async (userId?: string) => getUserBreaker.fire(userId)
);

export async function getUser(userId: string = 'me'): Promise<ZoomUser> {
  return (await getUserRateLimited(userId)) as ZoomUser;
}

/**
 * List users in the account
 */
async function listUsersInternal(
  status: 'active' | 'inactive' | 'pending' = 'active',
  pageSize: number = 30
): Promise<{ users: ZoomUser[]; total_records: number }> {
  logger.info({ status, pageSize }, 'Listing Zoom users');

  try {
    const client = await getZoomClient();

    const response = await client.get('/users', {
      params: {
        status,
        page_size: pageSize,
      },
    });

    logger.info(
      { userCount: response.data.users?.length || 0 },
      'Zoom users listed'
    );

    return {
      users: response.data.users || [],
      total_records: response.data.total_records || 0,
    };
  } catch (error) {
    logger.error({ error, status }, 'Failed to list Zoom users');
    throw new Error(
      `Failed to list Zoom users: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

const listUsersBreaker = new CircuitBreaker(listUsersInternal, {
  timeout: 30000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  name: 'zoom-list-users',
});

const listUsersRateLimited = zoomRateLimiter.wrap(
  async (status?: 'active' | 'inactive' | 'pending', pageSize?: number) =>
    listUsersBreaker.fire(status, pageSize)
);

export async function listUsers(
  status: 'active' | 'inactive' | 'pending' = 'active',
  pageSize: number = 30
): Promise<{ users: ZoomUser[]; total_records: number }> {
  return (await listUsersRateLimited(status, pageSize)) as {
    users: ZoomUser[];
    total_records: number;
  };
}

/**
 * Get current user (me)
 */
export async function getCurrentUser(): Promise<ZoomUser> {
  return getUser('me');
}

// ============================================================================
// Webinar Functions
// ============================================================================

/**
 * Create a webinar
 */
async function createWebinarInternal(
  webinar: ZoomWebinar,
  userId: string = 'me'
): Promise<ZoomWebinar> {
  logger.info({ topic: webinar.topic, userId }, 'Creating Zoom webinar');

  try {
    const client = await getZoomClient();

    const response = await client.post(`/users/${userId}/webinars`, webinar);

    logger.info(
      {
        webinarId: response.data.id,
        topic: webinar.topic,
      },
      'Zoom webinar created'
    );

    return response.data;
  } catch (error) {
    logger.error({ error, topic: webinar.topic }, 'Failed to create Zoom webinar');
    throw new Error(
      `Failed to create Zoom webinar: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

const createWebinarBreaker = new CircuitBreaker(createWebinarInternal, {
  timeout: 30000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  name: 'zoom-create-webinar',
});

const createWebinarRateLimited = zoomRateLimiter.wrap(
  async (webinar: ZoomWebinar, userId?: string) =>
    createWebinarBreaker.fire(webinar, userId)
);

export async function createWebinar(
  webinar: ZoomWebinar,
  userId: string = 'me'
): Promise<ZoomWebinar> {
  return (await createWebinarRateLimited(webinar, userId)) as ZoomWebinar;
}

/**
 * Get webinar details
 */
async function getWebinarInternal(webinarId: number | string): Promise<ZoomWebinar> {
  logger.info({ webinarId }, 'Getting Zoom webinar details');

  try {
    const client = await getZoomClient();

    const response = await client.get(`/webinars/${webinarId}`);

    logger.info({ webinarId, topic: response.data.topic }, 'Zoom webinar details retrieved');

    return response.data;
  } catch (error) {
    logger.error({ error, webinarId }, 'Failed to get Zoom webinar');
    throw new Error(
      `Failed to get Zoom webinar: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

const getWebinarBreaker = new CircuitBreaker(getWebinarInternal, {
  timeout: 30000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  name: 'zoom-get-webinar',
});

const getWebinarRateLimited = zoomRateLimiter.wrap(
  async (webinarId: number | string) => getWebinarBreaker.fire(webinarId)
);

export async function getWebinar(webinarId: number | string): Promise<ZoomWebinar> {
  return (await getWebinarRateLimited(webinarId)) as ZoomWebinar;
}

/**
 * List webinars for a user
 */
async function listWebinarsInternal(
  userId: string = 'me',
  pageSize: number = 30
): Promise<{ webinars: ZoomWebinar[] }> {
  logger.info({ userId, pageSize }, 'Listing Zoom webinars');

  try {
    const client = await getZoomClient();

    const response = await client.get(`/users/${userId}/webinars`, {
      params: { page_size: pageSize },
    });

    logger.info(
      { userId, webinarCount: response.data.webinars?.length || 0 },
      'Zoom webinars listed'
    );

    return {
      webinars: response.data.webinars || [],
    };
  } catch (error) {
    logger.error({ error, userId }, 'Failed to list Zoom webinars');
    throw new Error(
      `Failed to list Zoom webinars: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

const listWebinarsBreaker = new CircuitBreaker(listWebinarsInternal, {
  timeout: 30000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  name: 'zoom-list-webinars',
});

const listWebinarsRateLimited = zoomRateLimiter.wrap(
  async (userId?: string, pageSize?: number) =>
    listWebinarsBreaker.fire(userId, pageSize)
);

export async function listWebinars(
  userId: string = 'me',
  pageSize: number = 30
): Promise<{ webinars: ZoomWebinar[] }> {
  return (await listWebinarsRateLimited(userId, pageSize)) as {
    webinars: ZoomWebinar[];
  };
}
