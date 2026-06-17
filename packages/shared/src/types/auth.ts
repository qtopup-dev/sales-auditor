// API response shapes for auth-related types
// Note: passwordHash NEVER appears in any of these interfaces (security)

export interface InviteToken {
  id: number;
  organizationId: number;
  role: 'admin' | 'moderator';
  createdById: number;
  expiresAt: string;     // ISO 8601 UTC string
  usedAt: string | null;
  createdAt: string;
}

// AuthSession: shape of the user object returned by POST /api/auth/login
// and stored in Zustand authStore on the frontend.
// CONTEXT.md D-10: login response includes role for frontend redirect decision.
export interface AuthSession {
  user: {
    id: number;
    username: string;
    role: 'admin' | 'moderator';
    canEdit: boolean;
    organizationId: number;
  };
}
