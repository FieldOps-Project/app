import {
  hasAnswer,
  isFailure,
  isKnownResponseType,
  isNotApplicable,
  toSections,
  type ChecklistItem,
  type ChecklistResponse,
} from '@/domain/checklist';

/**
 * Why an item blocks the completion. An answered item can still block: the
 * failure rules are the ones most easily forgotten.
 */
export type PendingReason =
  /** RN-037 */
  | 'REQUIRED_UNANSWERED'
  /** RN-038 */
  | 'OBSERVATION_REQUIRED'
  /** RN-039 */
  | 'EVIDENCE_REQUIRED'
  /** Required item of a type this version cannot render (document 13.5). */
  | 'UNSUPPORTED_TYPE';

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
  /** Every item resolved and nothing blocking. */
  readonly complete: boolean;
}

export interface ChecklistProgress {
  readonly total: number;
  /** Answered items, "não aplicável" excluded (RN-040). */
  readonly answered: number;
  /** Items that count toward progress: all but "não aplicável" and optional unsupported ones. */
  readonly applicable: number;
  /** 0–100, rounded down so 99.6% never reads as done. */
  readonly percent: number;
  readonly sections: readonly SectionProgress[];
  /** In checklist order, so "next pending" is simply the first one after the current item. */
  readonly pending: readonly PendingItem[];
  readonly nonConformities: number;
}

export interface ProgressInput {
  readonly items: readonly ChecklistItem[];
  readonly responses: ReadonlyMap<string, ChecklistResponse>;
  readonly evidenceCounts: ReadonlyMap<string, number>;
}

/** Every reason the item blocks, so a failure missing both shows both at once. */
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

/**
 * Whether the item counts toward progress. An optional item of an unknown
 * type is left out — nothing can be done about it — but a required one stays
 * in, unanswered, so the bar never reads 100% while it blocks the completion.
 */
function countsTowardProgress(item: ChecklistItem, response: ChecklistResponse | undefined) {
  if (!isKnownResponseType(item.responseType)) {
    return item.required;
  }
  return !isNotApplicable(response);
}

/**
 * Progress over applicable items (RN-040) and the full list of what blocks the
 * completion (RN-037, RN-038, RN-039). A pure function of the snapshot and the
 * saved answers, so the checklist, the detail and the summary always agree.
 */
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

/** The first pending item after `currentItemId`, wrapping around to the start. */
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

/** Required items still without a usable answer — the "obrigatórios pendentes" total. */
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
