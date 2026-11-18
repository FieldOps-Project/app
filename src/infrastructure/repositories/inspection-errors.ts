export class InspectionIncompleteError extends Error {
  constructor() {
    super('Há itens pendentes no checklist. Volte e resolva as pendências antes de concluir.');
    this.name = 'InspectionIncompleteError';
  }
}

export class InvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidResponseError';
  }
}
