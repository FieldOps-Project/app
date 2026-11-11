import { useMutation } from '@tanstack/react-query';

import { useOwnerUserId } from '@/application/inspections/use-inspections';
import { identifyEquipment, type EquipmentIdentification } from '@/domain/equipment-identification';
import type { InspectionEquipment } from '@/domain/inspection';
import { equipmentGateway, isNetworkFailure, type EquipmentGateway } from '@/infrastructure/api';
import {
  findEquipmentByCode,
  findEquipmentById,
} from '@/infrastructure/repositories/equipment-repository';

export async function identifyByCode(
  ownerUserId: string,
  code: string,
  expected: InspectionEquipment | null,
  gateway: EquipmentGateway
): Promise<EquipmentIdentification> {
  const local = await findEquipmentByCode(ownerUserId, code);
  if (local !== null) {
    return identifyEquipment(expected, local, false);
  }

  const remote = await gateway.findIdByQrCode(code);
  if (!remote.ok) {
    return identifyEquipment(expected, null, isNetworkFailure(remote.error));
  }
  if (remote.value === null) {
    return identifyEquipment(expected, null, false);
  }
  const inScope = await findEquipmentById(ownerUserId, remote.value);
  return identifyEquipment(expected, inScope, false);
}

export function useIdentifyEquipment(expected: InspectionEquipment | null) {
  const ownerUserId = useOwnerUserId();

  return useMutation<EquipmentIdentification, Error, string>({
    mutationFn: (code) => identifyByCode(ownerUserId, code, expected, equipmentGateway),
  });
}
