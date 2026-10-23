import type { ChecklistItem } from '@/domain/checklist';
import type { ResponseFormInput } from '@/schemas/checklist-response';

/**
 * Contract every response component follows, so the checklist can render any
 * item through one explicit map (document 13.5).
 *
 * `onChange` updates the form as the technician types; `onCommit` asks for the
 * answer to be validated and saved. Text fields commit when editing ends,
 * choices commit on the tap itself.
 */
export interface ResponseFieldProps {
  item: ChecklistItem;
  value: ResponseFormInput['value'];
  onChange: (value: ResponseFormInput['value']) => void;
  onCommit: () => void;
  /** Business-language message shown next to the field (document 13.9). */
  error?: string;
  disabled: boolean;
}
