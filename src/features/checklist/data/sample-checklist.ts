import type { ChecklistItem } from '@/domain/inspection';

/** Long enough to scroll, so returning to the same item can be observed. */
export const sampleChecklist: readonly ChecklistItem[] = [
  { id: 'chk-01', order: 1, question: 'Extintores dentro da validade', requiresEvidence: true },
  {
    id: 'chk-02',
    order: 2,
    question: 'Saídas de emergência desobstruídas',
    requiresEvidence: true,
  },
  {
    id: 'chk-03',
    order: 3,
    question: 'Iluminação de emergência funcionando',
    requiresEvidence: false,
  },
  { id: 'chk-04', order: 4, question: 'Placas de sinalização visíveis', requiresEvidence: false },
  { id: 'chk-05', order: 5, question: 'Área de manipulação higienizada', requiresEvidence: true },
  {
    id: 'chk-06',
    order: 6,
    question: 'Controle de temperatura registrado',
    requiresEvidence: true,
  },
  {
    id: 'chk-07',
    order: 7,
    question: 'Equipamentos de proteção disponíveis',
    requiresEvidence: false,
  },
  {
    id: 'chk-08',
    order: 8,
    question: 'Descarte de resíduos conforme norma',
    requiresEvidence: true,
  },
  {
    id: 'chk-09',
    order: 9,
    question: 'Instalações elétricas sem exposição',
    requiresEvidence: true,
  },
  {
    id: 'chk-10',
    order: 10,
    question: 'Registro de dedetização atualizado',
    requiresEvidence: false,
  },
];
