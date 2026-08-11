/** Role that determines which actions the signed-in person may perform. */
export type SessionRole = 'tecnico' | 'supervisor';

/**
 * Signed-in user session.
 *
 * Holds only what the interface needs to render and to guard routes. The
 * credential itself stays in secure storage and is never part of this type.
 */
export interface Session {
  readonly userId: string;
  readonly name: string;
  readonly role: SessionRole;
}

/** Whether the role may review and close inspections opened by other people. */
export function canReviewInspections(session: Session): boolean {
  return session.role === 'supervisor';
}
