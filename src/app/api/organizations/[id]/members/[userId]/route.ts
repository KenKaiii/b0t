import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  getUserRoleInOrganization,
  removeOrganizationMember,
  updateOrganizationMemberRole,
  type OrganizationRole,
} from '@/lib/organizations';
import { z } from 'zod';

type RouteContext = {
  params: Promise<{ id: string; userId: string }>;
};

/**
 * DELETE /api/organizations/[id]/members/[userId]
 * Remove a member from an organization (requires admin or owner role)
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await requireAuth();
    const { id, userId } = await context.params;

    // Check if user has admin or owner role
    const userRole = await getUserRoleInOrganization(session.user.id, id);
    if (!userRole || (userRole !== 'owner' && userRole !== 'admin')) {
      return NextResponse.json(
        { success: false, error: 'Access denied - admin or owner role required' },
        { status: 403 }
      );
    }

    // Prevent removing yourself
    if (userId === session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Cannot remove yourself from the organization' },
        { status: 400 }
      );
    }

    // Check if member exists
    const memberRole = await getUserRoleInOrganization(userId, id);
    if (!memberRole) {
      return NextResponse.json(
        { success: false, error: 'Member not found' },
        { status: 404 }
      );
    }

    // Prevent non-owners from removing owners
    if (memberRole === 'owner' && userRole !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Only owners can remove other owners' },
        { status: 403 }
      );
    }

    await removeOrganizationMember(id, userId);

    return NextResponse.json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error) {
    console.error('Failed to remove organization member:', error);

    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to remove member' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/organizations/[id]/members/[userId]
 * Update a member's role (requires owner role)
 */
const updateMemberSchema = z.object({
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
});

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await requireAuth();
    const { id, userId } = await context.params;

    // Only owners can change roles
    const userRole = await getUserRoleInOrganization(session.user.id, id);
    if (userRole !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Access denied - owner role required' },
        { status: 403 }
      );
    }

    // Prevent changing your own role
    if (userId === session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Cannot change your own role' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { role } = updateMemberSchema.parse(body);

    // Check if member exists
    const memberRole = await getUserRoleInOrganization(userId, id);
    if (!memberRole) {
      return NextResponse.json(
        { success: false, error: 'Member not found' },
        { status: 404 }
      );
    }

    await updateOrganizationMemberRole(id, userId, role as OrganizationRole);

    return NextResponse.json({
      success: true,
      message: 'Member role updated successfully',
    });
  } catch (error) {
    console.error('Failed to update member role:', error);

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
      { success: false, error: 'Failed to update member role' },
      { status: 500 }
    );
  }
}
