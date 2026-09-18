/** Mirrors the API's `AuthUser.role` enum (document 10, "Perfis de usuário"). */
export type SessionRole = 'ADMIN' | 'SUPERVISOR' | 'TECHNICIAN' | 'CLIENT_VIEWER';

/** Signed-in user. The credential itself never leaves secure storage. */
export interface Session {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly role: SessionRole;
}

export function canReviewInspections(session: Session): boolean {
  return session.role === 'SUPERVISOR' || session.role === 'ADMIN';
}
