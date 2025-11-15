/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST } from '../route';
import { NextRequest } from 'next/server';

/**
 * Tests for credential API routes
 *
 * Validates authentication, authorization, validation, and CRUD operations
 */

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  auth: vi.fn()
}));

vi.mock('@/lib/workflows/credentials', () => ({
  storeCredential: vi.fn(),
  listCredentials: vi.fn()
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('@/lib/validations', () => ({
  createCredentialSchema: {
    safeParse: vi.fn()
  }
}));

describe('GET /api/credentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3123/api/credentials');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('should return 401 if session has no user', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValue({ user: null });

    const request = new NextRequest('http://localhost:3123/api/credentials');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('should list credentials for authenticated user', async () => {
    const { auth } = await import('@/lib/auth');
    const { listCredentials } = await import('@/lib/workflows/credentials');

    (auth as any).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' }
    });

    const mockCredentials = [
      {
        id: 'cred-1',
        platform: 'openai',
        name: 'OpenAI Key',
        type: 'api_key',
        createdAt: new Date('2024-01-01'),
        lastUsed: null
      },
      {
        id: 'cred-2',
        platform: 'stripe',
        name: 'Stripe Key',
        type: 'api_key',
        createdAt: new Date('2024-01-02'),
        lastUsed: new Date('2024-01-03')
      }
    ];

    (listCredentials as any).mockResolvedValue(mockCredentials);

    const request = new NextRequest('http://localhost:3123/api/credentials');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.credentials).toHaveLength(2);
    expect(json.credentials[0].id).toBe('cred-1');
    expect(json.credentials[1].id).toBe('cred-2');
    expect(listCredentials).toHaveBeenCalledWith('user-123', undefined);
  });

  it('should filter by organizationId when provided', async () => {
    const { auth } = await import('@/lib/auth');
    const { listCredentials } = await import('@/lib/workflows/credentials');

    (auth as any).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' }
    });

    (listCredentials as any).mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost:3123/api/credentials?organizationId=org-456'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(listCredentials).toHaveBeenCalledWith('user-123', 'org-456');
  });

  it('should return 500 on database error', async () => {
    const { auth } = await import('@/lib/auth');
    const { listCredentials } = await import('@/lib/workflows/credentials');

    (auth as any).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' }
    });

    (listCredentials as any).mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3123/api/credentials');
    const response = await GET(request);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe('Failed to list credentials');
  });
});

describe('POST /api/credentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3123/api/credentials', {
      method: 'POST',
      body: JSON.stringify({})
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('should store valid single-field credential', async () => {
    const { auth } = await import('@/lib/auth');
    const { storeCredential } = await import('@/lib/workflows/credentials');
    const { createCredentialSchema } = await import('@/lib/validations');

    (auth as any).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' }
    });

    const validData = {
      platform: 'openai',
      name: 'OpenAI API Key',
      value: 'sk-test-123',
      type: 'api_key'
    };

    (createCredentialSchema.safeParse as any).mockReturnValue({
      success: true,
      data: validData
    });

    (storeCredential as any).mockResolvedValue({ id: 'cred-new-123' });

    const request = new NextRequest('http://localhost:3123/api/credentials', {
      method: 'POST',
      body: JSON.stringify(validData)
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.id).toBe('cred-new-123');
    expect(storeCredential).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({
        platform: 'openai',
        name: 'OpenAI API Key',
        value: 'sk-test-123',
        type: 'api_key'
      }),
      undefined
    );
  });

  it('should store valid multi-field credential', async () => {
    const { auth } = await import('@/lib/auth');
    const { storeCredential } = await import('@/lib/workflows/credentials');
    const { createCredentialSchema } = await import('@/lib/validations');

    (auth as any).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' }
    });

    const validData = {
      platform: 'twitter',
      name: 'Twitter OAuth',
      fields: {
        client_id: 'client-123',
        client_secret: 'secret-456'
      },
      type: 'multi_field'
    };

    (createCredentialSchema.safeParse as any).mockReturnValue({
      success: true,
      data: validData
    });

    (storeCredential as any).mockResolvedValue({ id: 'cred-new-456' });

    const request = new NextRequest('http://localhost:3123/api/credentials', {
      method: 'POST',
      body: JSON.stringify(validData)
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(storeCredential).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({
        platform: 'twitter',
        fields: {
          client_id: 'client-123',
          client_secret: 'secret-456'
        }
      }),
      undefined
    );
  });

  it('should include organizationId when provided', async () => {
    const { auth } = await import('@/lib/auth');
    const { storeCredential } = await import('@/lib/workflows/credentials');
    const { createCredentialSchema } = await import('@/lib/validations');

    (auth as any).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' }
    });

    const validData = {
      platform: 'stripe',
      name: 'Stripe Key',
      value: 'sk_test_123',
      type: 'api_key',
      organizationId: 'org-789'
    };

    (createCredentialSchema.safeParse as any).mockReturnValue({
      success: true,
      data: validData
    });

    (storeCredential as any).mockResolvedValue({ id: 'cred-new-789' });

    const request = new NextRequest('http://localhost:3123/api/credentials', {
      method: 'POST',
      body: JSON.stringify(validData)
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(storeCredential).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({
        platform: 'stripe'
      }),
      'org-789'
    );
  });

  it('should return 400 on validation error', async () => {
    const { auth } = await import('@/lib/auth');
    const { createCredentialSchema } = await import('@/lib/validations');

    (auth as any).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' }
    });

    (createCredentialSchema.safeParse as any).mockReturnValue({
      success: false,
      error: {
        issues: [
          {
            path: ['platform'],
            message: 'Platform is required'
          },
          {
            path: ['type'],
            message: 'Type must be one of: api_key, token, secret'
          }
        ]
      }
    });

    const request = new NextRequest('http://localhost:3123/api/credentials', {
      method: 'POST',
      body: JSON.stringify({ name: 'Invalid' })
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Validation failed');
    expect(json.details).toBeDefined();
    expect(json.details).toHaveLength(2);
  });

  it('should return 400 for missing required fields', async () => {
    const { auth } = await import('@/lib/auth');
    const { createCredentialSchema } = await import('@/lib/validations');

    (auth as any).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' }
    });

    (createCredentialSchema.safeParse as any).mockReturnValue({
      success: false,
      error: {
        issues: [
          {
            path: ['name'],
            message: 'Name is required'
          }
        ]
      }
    });

    const request = new NextRequest('http://localhost:3123/api/credentials', {
      method: 'POST',
      body: JSON.stringify({
        platform: 'openai',
        type: 'api_key'
      })
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should return 500 on storage error', async () => {
    const { auth } = await import('@/lib/auth');
    const { storeCredential } = await import('@/lib/workflows/credentials');
    const { createCredentialSchema } = await import('@/lib/validations');

    (auth as any).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' }
    });

    (createCredentialSchema.safeParse as any).mockReturnValue({
      success: true,
      data: {
        platform: 'openai',
        name: 'Test',
        value: 'key',
        type: 'api_key'
      }
    });

    (storeCredential as any).mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3123/api/credentials', {
      method: 'POST',
      body: JSON.stringify({
        platform: 'openai',
        name: 'Test',
        value: 'key',
        type: 'api_key'
      })
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe('Failed to store credential');
  });

  it('should validate platform names', async () => {
    const { auth } = await import('@/lib/auth');
    const { createCredentialSchema } = await import('@/lib/validations');

    (auth as any).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' }
    });

    // Test invalid platform
    (createCredentialSchema.safeParse as any).mockReturnValue({
      success: false,
      error: {
        issues: [
          {
            path: ['platform'],
            message: 'Invalid platform name'
          }
        ]
      }
    });

    const request = new NextRequest('http://localhost:3123/api/credentials', {
      method: 'POST',
      body: JSON.stringify({
        platform: '',
        name: 'Test',
        value: 'key',
        type: 'api_key'
      })
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should handle JSON parse errors', async () => {
    const { auth } = await import('@/lib/auth');

    (auth as any).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' }
    });

    const request = new NextRequest('http://localhost:3123/api/credentials', {
      method: 'POST',
      body: 'invalid-json'
    });

    const response = await POST(request);

    // Should return 500 due to JSON parse error
    expect(response.status).toBe(500);
  });
});

describe('credential security', () => {
  it('should not expose credential values in responses', async () => {
    const { auth } = await import('@/lib/auth');
    const { listCredentials } = await import('@/lib/workflows/credentials');

    (auth as any).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' }
    });

    const mockCredentials = [
      {
        id: 'cred-1',
        platform: 'openai',
        name: 'OpenAI Key',
        type: 'api_key',
        createdAt: new Date(),
        lastUsed: null
        // Note: encryptedValue should NOT be included
      }
    ];

    (listCredentials as any).mockResolvedValue(mockCredentials);

    const request = new NextRequest('http://localhost:3123/api/credentials');
    const response = await GET(request);

    const json = await response.json();

    // Verify no credential values in response
    json.credentials.forEach((cred: any) => {
      expect(cred).not.toHaveProperty('encryptedValue');
      expect(cred).not.toHaveProperty('value');
      expect(cred).not.toHaveProperty('decryptedValue');
    });
  });

  it('should only return credentials for authenticated user', async () => {
    const { auth } = await import('@/lib/auth');
    const { listCredentials } = await import('@/lib/workflows/credentials');

    (auth as any).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' }
    });

    (listCredentials as any).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3123/api/credentials');
    await GET(request);

    // Verify userId from session is used
    expect(listCredentials).toHaveBeenCalledWith('user-123', undefined);
  });
});
