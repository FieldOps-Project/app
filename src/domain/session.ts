export type SessionRole = 'ADMIN' | 'SUPERVISOR' | 'TECHNICIAN' | 'CLIENT_VIEWER';

export interface Session {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly role: SessionRole;
}

export function canReviewInspections(session: Session): boolean {
  return session.role === 'SUPERVISOR' || session.role === 'ADMIN';
}
