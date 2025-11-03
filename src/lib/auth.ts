import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { createOrganization, getUserOrganizations } from './organizations';

/**
 * NextAuth.js v5 (Auth.js) Configuration
 *
 * Multi-tenant authentication with organization context
 * Each user belongs to one or more organizations
 * Personal organization is auto-created on first sign-in
 */

// Import OrganizationRole type
import type { OrganizationRole } from './organizations';

// Extend NextAuth types to include organization context
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      organizationId: string;
      role: OrganizationRole;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    email: string;
    name: string;
  }
}

// Extend JWT token type (for NextAuth v5)
declare module '@auth/core/jwt' {
  interface JWT {
    id?: string;
    organizationId?: string;
    role?: OrganizationRole;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    // Simple Email/Password Authentication
    // For single user app - credentials stored in environment variables
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Check against environment variables (single user)
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@socialcat.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

        if (
          credentials.email === adminEmail &&
          credentials.password === adminPassword
        ) {
          return {
            id: '1',
            email: adminEmail,
            name: 'Admin',
          };
        }

        return null;
      },
    }),
  ],

  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/auth/new-user',
  },

  callbacks: {
    async signIn({ user, account }) {
      console.log('🔐 Sign in:', { user: user.email, provider: account?.provider });

      // Auto-create personal organization on first sign-in
      if (user?.id) {
        try {
          const existingOrgs = await getUserOrganizations(user.id);

          if (existingOrgs.length === 0) {
            // First time sign-in - create personal organization
            const orgName = user.name ? `${user.name}'s Workspace` : 'My Workspace';
            const org = await createOrganization(orgName, user.id);

            console.log('✅ Created personal organization:', org.id);
          }
        } catch (error) {
          console.error('❌ Failed to create personal organization:', error);
          // Don't block sign-in if org creation fails
        }
      }

      return true;
    },

    async session({ session, token }) {
      // Add user id to session
      if (token.sub) {
        session.user.id = token.sub;
      }

      // Add organization context
      if (token.organizationId && token.role) {
        session.user.organizationId = token.organizationId;
        session.user.role = token.role;
      }

      return session;
    },

    async jwt({ token, user, trigger }) {
      // Add user id to token on first sign in
      if (user) {
        token.id = user.id;
      }

      // Load organization context if not already present
      // or if session is being updated
      if (token.id && (!token.organizationId || trigger === 'update')) {
        try {
          const orgs = await getUserOrganizations(token.id as string);

          if (orgs.length > 0) {
            // Use first organization as default
            // (can be changed via org switcher UI later)
            const org = orgs[0];
            token.organizationId = org.id;
            token.role = org.role;
          }
        } catch (error) {
          console.error('❌ Failed to load organization context:', error);
        }
      }

      return token;
    },
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  debug: process.env.NODE_ENV === 'development',
});

/**
 * Helper: Get current session with organization context
 * Use this instead of auth() directly to ensure organization data is present
 */
export async function getServerSession() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  // Ensure organization context is loaded
  if (!session.user.organizationId) {
    console.warn('⚠️  Session missing organization context, reloading...');

    // Try to load organization context
    try {
      const orgs = await getUserOrganizations(session.user.id);
      if (orgs.length > 0) {
        const org = orgs[0];
        session.user.organizationId = org.id;
        session.user.role = org.role;
      } else {
        console.error('❌ User has no organizations');
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to load organization context:', error);
      return null;
    }
  }

  return session;
}

/**
 * Helper: Require authentication with organization context
 * Throws if user is not authenticated or has no organization
 */
export async function requireAuth() {
  const session = await getServerSession();

  if (!session) {
    throw new Error('Unauthorized: No active session');
  }

  if (!session.user.organizationId) {
    throw new Error('Unauthorized: No organization context');
  }

  return session;
}

/**
 * Helper: Get current organization ID from session
 * Returns null if not authenticated
 */
export async function getCurrentOrganizationId(): Promise<string | null> {
  const session = await getServerSession();
  return session?.user?.organizationId ?? null;
}

/**
 * Helper: Check if current user has specific role
 */
export async function hasRole(role: OrganizationRole): Promise<boolean> {
  const session = await getServerSession();

  if (!session?.user?.role) {
    return false;
  }

  // Owner has all permissions
  if (session.user.role === 'owner') {
    return true;
  }

  // Admin has admin, member, and viewer permissions
  if (session.user.role === 'admin' && (role === 'admin' || role === 'member' || role === 'viewer')) {
    return true;
  }

  // Member has member and viewer permissions
  if (session.user.role === 'member' && (role === 'member' || role === 'viewer')) {
    return true;
  }

  // Check exact role match
  return session.user.role === role;
}
