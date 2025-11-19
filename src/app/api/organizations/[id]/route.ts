import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  getOrganizationById,
  getUserRoleInOrganization,
  deleteOrganization,
  getOrganizationWithRole
} from '@/lib/organizations';
import { db } from '@/lib/db';
import { organizationsTable } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '@/lib/logger';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/organizations/[id]
 * Get a specific organization
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    // Optimized: Single query with JOIN instead of 3 separate queries
    const result = await getOrganizationWithRole(session.user.id, id);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Organization not found or access denied' },
        { status: 404 }
      );
    }

    const { organization, role } = result;

    logger.info(
      { userId: session.user.id, organizationId: id, role, action: 'organization_fetch_success' },
      'Organization fetched successfully'
    );

    return NextResponse.json({
      success: true,
      organization: {
        ...organization,
        role,
      },
    });
  } catch (error) {
    const { id: orgId } = await context.params;
    logger.error(
      { error: error instanceof Error ? error.message : String(error), organizationId: orgId, action: 'organization_fetch_failed' },
      'Failed to fetch organization'
    );

    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch organization' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/organizations/[id]
 * Update an organization (requires admin or owner role)
 */
const updateOrgSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    // Check access and role
    const role = await getUserRoleInOrganization(session.user.id, id);
    if (!role || (role !== 'owner' && role !== 'admin')) {
      return NextResponse.json(
        { success: false, error: 'Access denied - admin or owner role required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updates = updateOrgSchema.parse(body);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update organization
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .update(organizationsTable)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(organizationsTable.id, id));

    const updatedOrg = await getOrganizationById(id);

    logger.info(
      { userId: session.user.id, organizationId: id, action: 'organization_update_success' },
      'Organization updated successfully'
    );

    return NextResponse.json({
      success: true,
      organization: updatedOrg,
    });
  } catch (error) {
    const { id: orgId } = await context.params;
    logger.error(
      { error: error instanceof Error ? error.message : String(error), organizationId: orgId, action: 'organization_update_failed' },
      'Failed to update organization'
    );

    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 }
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update organization' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/organizations/[id]
 * Delete an organization (requires owner role)
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    // Check if user is owner
    const role = await getUserRoleInOrganization(session.user.id, id);
    if (role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Access denied - owner role required' },
        { status: 403 }
      );
    }

    await deleteOrganization(id, session.user.id);

    logger.info(
      { userId: session.user.id, organizationId: id, action: 'organization_delete_success' },
      'Organization deleted successfully'
    );

    return NextResponse.json({
      success: true,
      message: 'Organization deleted successfully',
    });
  } catch (error) {
    const { id: orgId } = await context.params;
    logger.error(
      { error: error instanceof Error ? error.message : String(error), organizationId: orgId, action: 'organization_delete_failed' },
      'Failed to delete organization'
    );

    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to delete organization' },
      { status: 500 }
    );
  }
}
