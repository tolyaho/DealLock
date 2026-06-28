/**
 * publicUser — the single serialization of the authenticated user that the API
 * returns to the client. Shared by /auth/verify, /auth/me, the top-level /me, and
 * /profile so the shape can never drift between routes (it previously lived as two
 * hand-kept copies in auth.ts and index.ts).
 */
export function publicUser(user: {
  id: string;
  email: string | null;
  emailVerifiedAt: Date | null;
  firstName: string | null;
  lastName: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}
