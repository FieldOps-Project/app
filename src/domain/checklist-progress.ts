import {
  hasAnswer,
  isFailure,
  isKnownResponseType,
  isNotApplicable,
  toSections,
  type ChecklistItem,
  type ChecklistResponse,
} from '@/domain/checklist';

export type PendingReason =
  'REQUIRED_UNANSWERED' | 'OBSERVATION_REQUIRED' | 'EVIDENCE_REQUIRED' | 'UNSUPPORTED_TYPE';

export interface PendingItem {
  readonly itemId: string;
  readonly itemTitle: string;
  readonly sectionTitle: string;
  readonly reason: PendingReason;
}

export interface SectionProgress {
  readonly order: number;
  readonly title: string;
  readonly answered: number;
  readonly applicable: number;
  readonly complete: boolean;
}

export interface ChecklistProgress {
  readonly total: number;
  readonly answered: number;
  readonly applicable: number;
  readonly percent: number;
  readonly sections: readonly SectionProgress[];
  readonly pending: readonly PendingItem[];
  readonly nonConformities: number;
}

export interface ProgressInput {
  readonly items: readonly ChecklistItem[];
  readonly responses: ReadonlyMap<string, ChecklistResponse>;
  readonly evidenceCounts: ReadonlyMap<string, number>;
}

function pendingReasonsFor(
  item: ChecklistItem,
  response: ChecklistResponse | undefined,
  evidenceCount: number
): PendingReason[] {
  if (!isKnownResponseType(item.responseType)) {
    return item.required ? ['UNSUPPORTED_TYPE'] : [];
  }
  if (!hasAnswer(item, response)) {
    return item.required ? ['REQUIRED_UNANSWERED'] : [];
  }
  const reasons: PendingReason[] = [];
  if (isFailure(response)) {
    if (item.rules.observationRequiredOnFailure && (response?.observation ?? '').trim() === '') {
      reasons.push('OBSERVATION_REQUIRED');
    }
    if (item.rules.evidenceRequiredOnFailure && evidenceCount === 0) {
      reasons.push('EVIDENCE_REQUIRED');
    }
  }
  return reasons;
}

function countsTowardProgress(item: ChecklistItem, response: ChecklistResponse | undefined) {
  if (!isKnownResponseType(item.responseType)) {
    return item.required;
  }
  return !isNotApplicable(response);
}

export function computeProgress({
  items,
  responses,
  evidenceCounts,
}: ProgressInput): ChecklistProgress {
  const sections: SectionProgress[] = [];
  const pending: PendingItem[] = [];
  let answered = 0;
  let applicable = 0;
  let nonConformities = 0;

  for (const section of toSections(items)) {
    let sectionAnswered = 0;
    let sectionApplicable = 0;
    let sectionBlocked = false;

    for (const item of section.items) {
      const response = responses.get(item.id);
      const reasons = pendingReasonsFor(item, response, evidenceCounts.get(item.id) ?? 0);

      for (const reason of reasons) {
        pending.push({
          itemId: item.id,
          itemTitle: item.itemTitle,
          sectionTitle: section.title,
          reason,
        });
        sectionBlocked = true;
      }
      if (isFailure(response)) {
        nonConformities += 1;
      }
      if (!countsTowardProgress(item, response)) {
        continue;
      }
      sectionApplicable += 1;
      if (hasAnswer(item, response)) {
        sectionAnswered += 1;
      }
    }

    answered += sectionAnswered;
    applicable += sectionApplicable;
    sections.push({
      order: section.order,
      title: section.title,
      answered: sectionAnswered,
      applicable: sectionApplicable,
      complete: !sectionBlocked && sectionAnswered === sectionApplicable,
    });
  }

  return {
    total: items.length,
    answered,
    applicable,
    percent: applicable === 0 ? 100 : Math.floor((answered / applicable) * 100),
    sections,
    pending,
    nonConformities,
  };
}

export function nextPending(
  progress: ChecklistProgress,
  items: readonly ChecklistItem[],
  currentItemId: string | null
): PendingItem | null {
  if (progress.pending.length === 0) {
    return null;
  }
  if (currentItemId === null) {
    return progress.pending[0] ?? null;
  }

  const position = new Map(
    toSections(items)
      .flatMap((section) => section.items)
      .map((item, index) => [item.id, index])
  );
  const current = position.get(currentItemId) ?? -1;

  return (
    progress.pending.find((item) => (position.get(item.itemId) ?? -1) > current) ??
    progress.pending[0] ??
    null
  );
}

export function countRequiredPending(progress: ChecklistProgress): number {
  return progress.pending.filter(
    (entry) => entry.reason === 'REQUIRED_UNANSWERED' || entry.reason === 'UNSUPPORTED_TYPE'
  ).length;
}

export function pendingReasonLabel(reason: PendingReason): string {
  const labels: Record<PendingReason, string> = {
    REQUIRED_UNANSWERED: 'Item obrigatório sem resposta',
    OBSERVATION_REQUIRED: 'Não conformidade sem observação',
    EVIDENCE_REQUIRED: 'Não conformidade sem evidência',
    UNSUPPORTED_TYPE: 'Item obrigatório incompatível com esta versão do aplicativo',
  };
  return labels[reason];
}
