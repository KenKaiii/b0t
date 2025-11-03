import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserOrganizations, createOrganization } from '@/lib/organizations';
import { z } from 'zod';

/**
 * GET /api/organizations
 * List all organizations the current user belongs to
 */
export async function GET() {
  try {
    const session = await requireAuth();

    const organizations = await getUserOrganizations(session.user.id);

    return NextResponse.json({
      success: true,
      organizations,
    });
  } catch (error) {
    console.error('Failed to fetch organizations:', error);

    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizations
 * Create a new organization
 */
const createOrgSchema = z.object({
  name: z.string().min(1).max(255),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const body = await request.json();
    const { name, plan } = createOrgSchema.parse(body);

    const organization = await createOrganization(name, session.user.id, plan);

    return NextResponse.json({
      success: true,
      organization,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create organization:', error);

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
      { success: false, error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}
