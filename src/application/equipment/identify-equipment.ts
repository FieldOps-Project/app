import { useMutation } from '@tanstack/react-query';

import { useOwnerUserId } from '@/application/inspections/use-inspections';
import {
  identifyEquipment,
  type CodeSource,
  type EquipmentIdentification,
} from '@/domain/equipment-identification';
import type { InspectionEquipment } from '@/domain/inspection';
import { equipmentGateway, isNetworkFailure, type EquipmentGateway } from '@/infrastructure/api';
import {
  findEquipmentByAssetNumber,
  findEquipmentById,
  findEquipmentByQrCode,
} from '@/infrastructure/repositories/equipment-repository';

export interface EquipmentCode {
  readonly code: string;
  readonly source: CodeSource;
}

export async function identifyByCode(
  ownerUserId: string,
  { code, source }: EquipmentCode,
  expected: InspectionEquipment | null,
  gateway: EquipmentGateway
): Promise<EquipmentIdentification> {
  const local =
    (await findEquipmentByQrCode(ownerUserId, code)) ??
    (source === 'manual' ? await findEquipmentByAssetNumber(ownerUserId, code) : null);
  if (local !== null) {
    return identifyEquipment(expected, local);
  }

  const remote = await gateway.findIdByQrCode(code);
  if (!remote.ok) {
    return identifyEquipment(expected, null, isNetworkFailure(remote.error) ? 'offline' : 'failed');
  }
  if (remote.value === null) {
    return identifyEquipment(expected, null);
  }
  return identifyEquipment(expected, await findEquipmentById(ownerUserId, remote.value));
}

export function useIdentifyEquipment(expected: InspectionEquipment | null) {
  const ownerUserId = useOwnerUserId();

  return useMutation<EquipmentIdentification, Error, EquipmentCode>({
    mutationFn: (code) => identifyByCode(ownerUserId, code, expected, equipmentGateway),
  });
}
