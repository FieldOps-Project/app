export type SessionRole = 'tecnico' | 'supervisor';

/** Signed-in user. The credential itself never leaves secure storage. */
export interface Session {
  readonly userId: string;
  readonly name: string;
  readonly role: SessionRole;
}

export function canReviewInspections(session: Session): boolean {
  return session.role === 'supervisor';
}
