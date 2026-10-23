import { fail, ok } from '@/domain/result';
import type {
  MobileInspectionsGateway,
  ResponsePayload,
} from '@/infrastructure/api/mobile-inspections-api';
import type { MobileInspection } from '@/schemas/mobile-inspection';

/**
 * In-memory stand-in for the technician endpoints, turned on with
 * `EXPO_PUBLIC_DEMO_INSPECTIONS=true`.
 *
 * Exists because the app's sprint 4 runs ahead of backend#19–#21: it lets the
 * screens be exercised end to end — download, start, answer, complete, send —
 * with the same payloads the contract defines. It never ships enabled: the
 * flag is off unless set, and sign-in still goes to the real API.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function atHour(dayOffset: number, hour: number): string {
  const date = new Date(Date.now() + dayOffset * DAY_MS);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

const NO_RULES = {
  observationRequiredOnFailure: false,
  evidenceRequiredOnFailure: false,
  min: null,
  max: null,
};

const FAILURE_RULES = {
  ...NO_RULES,
  observationRequiredOnFailure: true,
  evidenceRequiredOnFailure: true,
};

type DemoItem = MobileInspection['items'][number];

function item(
  inspection: string,
  sectionOrder: number,
  sectionTitle: string,
  itemOrder: number,
  itemTitle: string,
  responseType: string,
  overrides: Partial<DemoItem> = {}
): DemoItem {
  return {
    id: `${inspection}-s${sectionOrder}-i${itemOrder}`,
    sectionTitle,
    sectionDescription: null,
    sectionOrder,
    itemCode: `${sectionOrder}.${itemOrder}`,
    itemTitle,
    itemDescription: null,
    responseType,
    required: true,
    rules: NO_RULES,
    options: [],
    itemOrder,
    ...overrides,
  };
}

/** Covers every response type of the MVP, the failure rules and one unknown type. */
function generatorChecklist(inspection: string): DemoItem[] {
  return [
    item(inspection, 1, 'Identificação', 1, 'Placa de identificação legível', 'CONFORMITY', {
      rules: FAILURE_RULES,
    }),
    item(inspection, 1, 'Identificação', 2, 'Horímetro (horas)', 'NUMBER', {
      itemDescription: 'Leitura do painel, com uma casa decimal.',
      rules: { ...NO_RULES, min: 0, max: 100000 },
    }),
    item(inspection, 1, 'Identificação', 3, 'Data da última manutenção', 'DATE'),
    item(inspection, 2, 'Condições gerais', 1, 'Proteções laterais íntegras', 'CONFORMITY', {
      rules: FAILURE_RULES,
    }),
    item(inspection, 2, 'Condições gerais', 2, 'Equipamento ligado durante a inspeção?', 'BOOLEAN'),
    item(inspection, 2, 'Condições gerais', 3, 'Nível de combustível', 'SINGLE_CHOICE', {
      options: ['Vazio', '1/4', '1/2', '3/4', 'Cheio'],
    }),
    item(inspection, 2, 'Condições gerais', 4, 'Número do lacre', 'TEXT_SHORT', {
      required: false,
    }),
    item(inspection, 3, 'Encerramento', 1, 'Termografia do painel', 'THERMAL_IMAGE', {
      required: false,
      itemDescription: 'Tipo publicado por uma versão mais nova do painel.',
    }),
    item(inspection, 3, 'Encerramento', 2, 'Observações gerais', 'TEXT_LONG', { required: false }),
  ];
}

/** A long checklist, to check that the screen stays fluid with 100 items. */
function longChecklist(inspection: string): DemoItem[] {
  return Array.from({ length: 100 }, (_, index) => {
    const sectionOrder = Math.floor(index / 20) + 1;
    return item(
      inspection,
      sectionOrder,
      `Bloco ${sectionOrder}`,
      (index % 20) + 1,
      `Ponto de verificação ${index + 1}`,
      'CONFORMITY',
      { required: index % 3 !== 0 }
    );
  });
}

function seed(): MobileInspection[] {
  const base = {
    instructions: null,
    version: 1,
    updatedAt: null,
    startedAtDevice: null,
    completedAtDevice: null,
    responses: [],
    review: null,
  };
  const client = { id: 'client-abc', name: 'Indústria ABC' };
  const site = {
    id: 'site-sorocaba',
    name: 'Fábrica Sorocaba',
    addressLine: 'Av. Industrial, 1500 — Sorocaba/SP',
    latitude: -23.5015,
    longitude: -47.4526,
  };
  const generator = {
    id: 'eq-gd-001',
    name: 'Gerador GD-001',
    qrCode: 'FO-EQ-GD-001',
    assetNumber: 'PAT-0042',
    serialNumber: 'SN-88123',
  };

  return [
    {
      ...base,
      id: 'demo-today',
      title: 'Inspeção preventiva do gerador',
      status: 'ASSIGNED',
      priority: 'HIGH',
      scheduledFor: atHour(0, 14),
      instructions:
        'Desligar o gerador antes de abrir o painel lateral. Fotografar a placa de identificação e qualquer vazamento encontrado. Em caso de dúvida, ligar para a supervisão antes de encerrar.',
      client,
      site,
      equipment: generator,
      items: generatorChecklist('demo-today'),
    },
    {
      ...base,
      id: 'demo-overdue',
      title: 'Inspeção de extintores — bloco B',
      status: 'ASSIGNED',
      priority: 'CRITICAL',
      scheduledFor: atHour(-2, 9),
      client,
      site: { ...site, id: 'site-bloco-b', name: 'Bloco B', latitude: null, longitude: null },
      equipment: null,
      items: longChecklist('demo-overdue'),
    },
    {
      ...base,
      id: 'demo-progress',
      title: 'Ronda de segurança mensal',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      scheduledFor: atHour(0, 8),
      startedAtDevice: atHour(0, 8),
      client: { id: 'client-aurora', name: 'Padaria Aurora' },
      site: {
        id: 'site-aurora',
        name: 'Loja Centro',
        addressLine: 'Rua das Palmeiras, 120 — Centro',
        latitude: null,
        longitude: null,
      },
      equipment: null,
      items: generatorChecklist('demo-progress'),
    },
    {
      ...base,
      id: 'demo-rejected',
      title: 'Inspeção do compressor',
      status: 'REJECTED',
      priority: 'LOW',
      scheduledFor: atHour(-1, 10),
      startedAtDevice: atHour(-1, 10),
      completedAtDevice: atHour(-1, 11),
      client,
      site,
      equipment: {
        ...generator,
        id: 'eq-cp-002',
        name: 'Compressor CP-002',
        qrCode: 'FO-EQ-CP-002',
      },
      items: generatorChecklist('demo-rejected'),
      review: {
        decision: 'REJECTED',
        reason: 'A foto da placa de identificação está desfocada. Refazer o registro.',
        itemsToCorrect: ['demo-rejected-s1-i1'],
      },
    },
    {
      ...base,
      id: 'demo-next-week',
      title: 'Vistoria do quadro elétrico',
      status: 'ASSIGNED',
      priority: 'MEDIUM',
      scheduledFor: atHour(5, 9),
      client: { id: 'client-sao-jorge', name: 'Mercado São Jorge' },
      site: {
        id: 'site-sao-jorge',
        name: 'Loja Jardim América',
        addressLine: 'Av. Brasil, 4500 — Jardim América',
        latitude: null,
        longitude: null,
      },
      equipment: null,
      items: generatorChecklist('demo-next-week'),
    },
  ];
}

let inspections: MobileInspection[] | null = null;

function store(): MobileInspection[] {
  inspections ??= seed();
  return inspections;
}

function update(inspectionId: string, change: (inspection: MobileInspection) => MobileInspection) {
  inspections = store().map((inspection) =>
    inspection.id === inspectionId ? change(inspection) : inspection
  );
}

function toResponse(payload: ResponsePayload): MobileInspection['responses'][number] {
  const { baseVersion: _baseVersion, conformity, ...rest } = payload;
  return {
    ...rest,
    conformity:
      conformity === 'CONFORMING' ||
      conformity === 'NON_CONFORMING' ||
      conformity === 'NOT_APPLICABLE'
        ? conformity
        : null,
  };
}

/** A short delay keeps loading states visible, as they are on a real network. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 400));
}

export const demoMobileInspectionsGateway: MobileInspectionsGateway = {
  async list() {
    await settle();
    return ok(store().map(({ id, updatedAt }) => ({ id, updatedAt })));
  },

  async detail(inspectionId) {
    await settle();
    const found = store().find((inspection) => inspection.id === inspectionId);
    return found === undefined ? fail({ kind: 'notFound' }) : ok(found);
  },

  async start(inspectionId, payload) {
    await settle();
    const found = store().find((inspection) => inspection.id === inspectionId);
    if (found === undefined) {
      return fail({ kind: 'notFound' });
    }
    if (found.status !== 'ASSIGNED') {
      return fail({ kind: 'conflict', code: 'INSPECTION_INVALID_TRANSITION' });
    }
    update(inspectionId, (inspection) => ({
      ...inspection,
      status: 'IN_PROGRESS',
      startedAtDevice: payload.startedAtDevice,
      version: inspection.version + 1,
      updatedAt: new Date().toISOString(),
    }));
    return ok(undefined);
  },

  async submit(inspectionId, payload) {
    await settle();
    const found = store().find((inspection) => inspection.id === inspectionId);
    if (found === undefined) {
      return fail({ kind: 'notFound' });
    }
    if (found.status !== 'IN_PROGRESS' && found.status !== 'REJECTED') {
      return fail({ kind: 'conflict', code: 'INSPECTION_INVALID_TRANSITION' });
    }
    update(inspectionId, (inspection) => ({
      ...inspection,
      status: 'SUBMITTED',
      completedAtDevice: payload.completedAtDevice,
      version: inspection.version + 1,
      updatedAt: new Date().toISOString(),
    }));
    return ok(undefined);
  },

  async putResponse(inspectionId, payload) {
    await settle();
    const found = store().find((inspection) => inspection.id === inspectionId);
    if (found === undefined) {
      return fail({ kind: 'notFound' });
    }
    if (!found.items.some((candidate) => candidate.id === payload.inspectionItemId)) {
      return fail({
        kind: 'business',
        code: 'RESPONSE_ITEM_NOT_IN_INSPECTION',
        message: 'O item respondido não pertence a esta inspeção.',
      });
    }
    update(inspectionId, (inspection) => ({
      ...inspection,
      responses: [
        ...inspection.responses.filter(
          (response) => response.inspectionItemId !== payload.inspectionItemId
        ),
        toResponse(payload),
      ],
      updatedAt: new Date().toISOString(),
    }));
    return ok(undefined);
  },
};
