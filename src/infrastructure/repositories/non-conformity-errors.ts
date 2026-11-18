export class NonConformityItemError extends Error {
  constructor() {
    super('O item desta não conformidade não pertence a esta inspeção.');
    this.name = 'NonConformityItemError';
  }
}

export class NonConformityAnswerError extends Error {
  constructor() {
    super('Responda o item antes de registrar a não conformidade.');
    this.name = 'NonConformityAnswerError';
  }
}

export class NonConformityEvidenceError extends Error {
  constructor() {
    super('Registre a evidência das não conformidades críticas antes de concluir a inspeção.');
    this.name = 'NonConformityEvidenceError';
  }
}

export const NON_CONFORMITY_ERRORS = [
  NonConformityItemError,
  NonConformityAnswerError,
  NonConformityEvidenceError,
] as const;
