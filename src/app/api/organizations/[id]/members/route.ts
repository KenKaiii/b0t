import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  getOrganizationMembers,
  getUserRoleInOrganization,
  addOrganizationMember,
  type OrganizationRole,
} from '@/lib/organizations';
import { z } from 'zod';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/organizations/[id]/members
 * List all members of an organization
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    // Check if user has access to this organization
    const role = await getUserRoleInOrganization(session.user.id, id);
    if (!role) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const members = await getOrganizationMembers(id);

    return NextResponse.json({
      success: true,
      members,
    });
  } catch (error) {
    console.error('Failed to fetch organization members:', error);

    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizations/[id]/members
 * Add a new member to an organization (requires admin or owner role)
 */
const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['owner', 'admin', 'member', 'viewer']).optional(),
});

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    // Check if user has admin or owner role
    const userRole = await getUserRoleInOrganization(session.user.id, id);
    if (!userRole || (userRole !== 'owner' && userRole !== 'admin')) {
      return NextResponse.json(
        { success: false, error: 'Access denied - admin or owner role required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, role } = addMemberSchema.parse(body);

    // Check if member already exists
    const existingRole = await getUserRoleInOrganization(userId, id);
    if (existingRole) {
      return NextResponse.json(
        { success: false, error: 'User is already a member of this organization' },
        { status: 400 }
      );
    }

    const member = await addOrganizationMember(
      id,
      userId,
      (role as OrganizationRole) || 'member'
    );

    return NextResponse.json({
      success: true,
      member,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to add organization member:', error);

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
      { success: false, error: 'Failed to add member' },
      { status: 500 }
    );
  }
}
