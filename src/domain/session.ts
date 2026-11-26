export type SessionRole = 'ADMIN' | 'SUPERVISOR' | 'TECHNICIAN' | 'CLIENT_VIEWER';

export interface Session {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly role: SessionRole;
}

export const ROLE_DESCRIPTIONS: Readonly<Record<SessionRole, string>> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  TECHNICIAN: 'Técnico · executa inspeções em campo',
  CLIENT_VIEWER: 'Visualizador',
};
