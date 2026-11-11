import type { ChecklistItem } from '@/domain/checklist';
import type { ResponseFormInput } from '@/schemas/checklist-response';

export interface ResponseFieldProps {
  item: ChecklistItem;
  value: ResponseFormInput['value'];
  onChange: (value: ResponseFormInput['value']) => void;
  onCommit: () => void;
  error?: string;
  disabled: boolean;
}
