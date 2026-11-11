import type { EquipmentMatch } from '@/domain/equipment-identification';
import { isInspectionStatus } from '@/domain/inspection';
import { getDatabase } from '@/infrastructure/database/database';

interface InspectionEquipmentRow {
  id: string;
  title: string;
  status: string;
  scheduled_for: string;
  equipment_id: string;
  equipment_name: string | null;
  equipment_qr_code: string | null;
  equipment_asset_number: string | null;
  equipment_serial_number: string | null;
}

const COLUMNS = `id, title, status, scheduled_for, equipment_id, equipment_name, equipment_qr_code,
  equipment_asset_number, equipment_serial_number`;

function toMatch(rows: readonly InspectionEquipmentRow[]): EquipmentMatch | null {
  const first = rows[0];
  if (first === undefined) {
    return null;
  }
  const sameEquipment = rows.filter((row) => row.equipment_id === first.equipment_id);
  return {
    equipment: {
      id: first.equipment_id,
      name: first.equipment_name ?? '',
      qrCode: first.equipment_qr_code,
      assetNumber: first.equipment_asset_number,
      serialNumber: first.equipment_serial_number,
    },
    inspections: sameEquipment.map((row) => ({
      id: row.id,
      title: row.title,
      status: isInspectionStatus(row.status) ? row.status : 'CANCELED',
      scheduledFor: row.scheduled_for,
    })),
  };
}

async function findByColumn(
  ownerUserId: string,
  column: 'equipment_qr_code' | 'equipment_asset_number' | 'equipment_id',
  value: string
): Promise<EquipmentMatch | null> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<InspectionEquipmentRow>(
    `SELECT ${COLUMNS} FROM inspections
      WHERE owner_user_id = ? AND equipment_id IS NOT NULL AND ${column} = ?
      ORDER BY scheduled_for, id`,
    ownerUserId,
    value
  );
  return toMatch(rows);
}

export function findEquipmentByQrCode(ownerUserId: string, qrCode: string) {
  return findByColumn(ownerUserId, 'equipment_qr_code', qrCode);
}

export function findEquipmentByAssetNumber(ownerUserId: string, assetNumber: string) {
  return findByColumn(ownerUserId, 'equipment_asset_number', assetNumber);
}

export function findEquipmentById(ownerUserId: string, equipmentId: string) {
  return findByColumn(ownerUserId, 'equipment_id', equipmentId);
}
