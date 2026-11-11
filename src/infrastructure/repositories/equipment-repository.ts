import type { EquipmentMatch } from '@/domain/equipment-identification';
import { isInspectionStatus } from '@/domain/inspection';
import { getDatabase } from '@/infrastructure/database/database';

interface EquipmentRow {
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

function toMatch(rows: readonly EquipmentRow[]): EquipmentMatch | null {
  const first = rows[0];
  if (first === undefined) {
    return null;
  }
  const sameEquipment = rows.filter((row) => row.equipment_id === first.equipment_id);
  return {
    equipment: {
      id: first.equipment_id,
      name: first.equipment_name ?? 'Equipamento sem nome',
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

export async function findEquipmentByCode(
  ownerUserId: string,
  code: string
): Promise<EquipmentMatch | null> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<EquipmentRow>(
    `SELECT ${COLUMNS} FROM inspections
      WHERE owner_user_id = ? AND equipment_id IS NOT NULL
        AND (equipment_qr_code = ? OR equipment_asset_number = ?)
      ORDER BY scheduled_for, id`,
    ownerUserId,
    code,
    code
  );
  return toMatch(rows);
}

export async function findEquipmentById(
  ownerUserId: string,
  equipmentId: string
): Promise<EquipmentMatch | null> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<EquipmentRow>(
    `SELECT ${COLUMNS} FROM inspections
      WHERE owner_user_id = ? AND equipment_id = ?
      ORDER BY scheduled_for, id`,
    ownerUserId,
    equipmentId
  );
  return toMatch(rows);
}
