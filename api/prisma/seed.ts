/**
 * Seed ~6 realistic Romanian referate spanning both routing paths, including a
 * couple mid-chain, one finalized, one rejected and one sent back — so the demo
 * looks alive. Histories are produced by replaying the real workflow rules, so
 * tasks and the append-only Transition trail stay consistent.
 */
import {
  PrismaClient,
  Prisma,
  Role,
  ReferatStatus,
  TaskStatus,
} from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { APPROVAL_THRESHOLD_LEI } from '../src/config/workflow.config';
import { applies, Condition, RoutingContext } from '../src/config/condition';

const prisma = new PrismaClient();

/**
 * Shared demo password for every seeded account. Only the bcrypt hash reaches
 * the database; the plaintext is documented ONLY in the README ("Conturi demo").
 * Override at seed time with DEMO_PASSWORD=... pnpm api:seed.
 */
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'ApaTM2026!';

type SeedAction =
  | { kind: 'approve'; comment?: string }
  | { kind: 'reject'; comment: string }
  | { kind: 'send-back'; comment: string };

interface SeedReferat {
  articol: string;
  cantitate: number;
  justificare: string;
  centruCost: string;
  valoareLei: number;
  necesitaIt?: boolean;
  necesitaSsm?: boolean;
  /** Actions replayed (in order) after creation, each by the active step's role. */
  actions: SeedAction[];
}

const USERS: { name: string; email: string; role: Role }[] = [
  { name: 'Andrei Popescu', email: 'andrei.popescu@apatim.ro', role: Role.ANGAJAT },
  { name: 'Maria Ionescu', email: 'maria.ionescu@apatim.ro', role: Role.SEF_IERARHIC },
  { name: 'Serviciul IT (Vlad Marin)', email: 'vlad.marin@apatim.ro', role: Role.IT },
  { name: 'Responsabil SSM (Ioana Neagu)', email: 'ioana.neagu@apatim.ro', role: Role.SSM },
  { name: 'Birou Achiziții (Elena Dumitru)', email: 'elena.dumitru@apatim.ro', role: Role.ACHIZITII },
  { name: 'Radu Georgescu', email: 'radu.georgescu@apatim.ro', role: Role.DIR_ECONOMIC },
  { name: 'Cristina Munteanu', email: 'cristina.munteanu@apatim.ro', role: Role.DIR_GENERAL },
];

/**
 * The standard, active approval workflow. Each step's `appliesWhen` is evaluated
 * against a referat at creation time (see api/src/config/condition.ts). With the
 * IT/SSM flags off and the value threshold, this reproduces the original
 * SEF → ACHIZITII (+ DIR_ECONOMIC → DIR_GENERAL when ≥ threshold) chain.
 */
const STANDARD_WORKFLOW_STEPS: {
  role: Role;
  label: string;
  appliesWhen: Condition;
}[] = [
  { role: Role.SEF_IERARHIC, label: 'Avizare șef ierarhic', appliesWhen: null },
  {
    role: Role.IT,
    label: 'Verificare IT',
    appliesWhen: { field: 'necesitaIt', eq: true },
  },
  {
    role: Role.SSM,
    label: 'Avizare SSM',
    appliesWhen: { field: 'necesitaSsm', eq: true },
  },
  { role: Role.ACHIZITII, label: 'Birou Achiziții', appliesWhen: null },
  {
    role: Role.DIR_ECONOMIC,
    label: 'Aprobare director economic',
    appliesWhen: { field: 'valoareLei', op: 'gte', value: APPROVAL_THRESHOLD_LEI },
  },
  {
    role: Role.DIR_GENERAL,
    label: 'Aprobare director general',
    appliesWhen: { field: 'valoareLei', op: 'gte', value: APPROVAL_THRESHOLD_LEI },
  },
];

/** Ordered roles that apply to a referat, per the standard workflow conditions. */
function chainFor(ctx: RoutingContext): Role[] {
  return STANDARD_WORKFLOW_STEPS.filter((s) => applies(s.appliesWhen, ctx)).map(
    (s) => s.role,
  );
}

const REFERATE: SeedReferat[] = [
  {
    articol: 'Laptop Dell Latitude 5550',
    cantitate: 1,
    justificare: 'Înlocuire echipament defect — Birou IT.',
    centruCost: 'Birou IT',
    valoareLei: 4200,
    // Short path (2 pași), aprobat integral -> FINALIZAT.
    actions: [
      { kind: 'approve', comment: 'De acord, echipamentul este necesar.' },
      { kind: 'approve', comment: 'Achiziție aprobată, furnizor agreat.' },
    ],
  },
  {
    articol: 'Pompă submersibilă 7.5 kW',
    cantitate: 2,
    justificare: 'Creștere capacitate la stația de captare.',
    centruCost: 'Stație captare',
    valoareLei: 18500,
    // Full path (4 pași), aprobat la Șef -> WAITING la Achiziții.
    actions: [{ kind: 'approve', comment: 'Justificat tehnic.' }],
  },
  {
    articol: 'Reactivi laborator (set analize)',
    cantitate: 10,
    justificare: 'Stoc necesar pentru analizele lunare de calitate.',
    centruCost: 'Laborator calitate apă',
    valoareLei: 2800,
    // Short path, proaspăt creat -> WAITING la Șef ierarhic.
    actions: [],
  },
  {
    articol: 'Autoutilitară Ford Transit',
    cantitate: 1,
    justificare: 'Înlocuire vehicul de intervenție casat.',
    centruCost: 'Parc auto',
    valoareLei: 95000,
    // Full path, aprobat Șef + Achiziții -> WAITING la Director Economic.
    actions: [
      { kind: 'approve', comment: 'Necesar pentru echipele de intervenție.' },
      { kind: 'approve', comment: 'Specificații și buget verificate.' },
    ],
  },
  {
    articol: 'Scaune ergonomice birou',
    cantitate: 8,
    justificare: 'Dotare birou relații cu clienții.',
    centruCost: 'Birou Clienți',
    valoareLei: 3500,
    // Short path, respins la primul pas -> RESPINS.
    actions: [
      { kind: 'reject', comment: 'Bugetul pe acest trimestru nu permite achiziția.' },
    ],
  },
  {
    articol: 'Echipament de protecție (set complet)',
    cantitate: 25,
    justificare: 'Dotare echipe de teren conform normelor SSM.',
    centruCost: 'Echipe teren',
    valoareLei: 12000,
    // Full path, aprobat Șef, apoi trimis înapoi de Achiziții -> TRIMIS_INAPOI (Șef are din nou WAITING).
    actions: [
      { kind: 'approve', comment: 'De acord cu necesarul.' },
      { kind: 'send-back', comment: 'Vă rog detaliați specificațiile pe fiecare articol.' },
    ],
  },

  // ---- Full path (≥ 5.000 lei) at every step ----
  {
    articol: 'Server stocare NAS Synology',
    cantitate: 1,
    justificare: 'Capacitate de backup insuficientă pentru arhiva SCADA.',
    centruCost: 'Birou IT',
    valoareLei: 32000,
    // Aprobat Șef + Achiziții + Dir. economic -> WAITING la Director General.
    actions: [
      { kind: 'approve', comment: 'Necesar pentru continuitatea datelor.' },
      { kind: 'approve', comment: 'Ofertă conformă, furnizor agreat.' },
      { kind: 'approve', comment: 'Încadrare bugetară confirmată.' },
    ],
  },
  {
    articol: 'Modernizare stație de pompare',
    cantitate: 1,
    justificare: 'Reabilitarea grupurilor de pompare la stația de captare.',
    centruCost: 'Stație captare',
    valoareLei: 78000,
    // Aprobat Șef + Achiziții -> WAITING la Director Economic.
    actions: [
      { kind: 'approve', comment: 'Investiție prioritară.' },
      { kind: 'approve', comment: 'Trei oferte analizate, recomand furnizorul B.' },
    ],
  },
  {
    articol: 'Upgrade software SCADA',
    cantitate: 1,
    justificare: 'Licențe și module noi pentru monitorizarea stației de tratare.',
    centruCost: 'Stație tratare',
    valoareLei: 26000,
    // Aprobat Șef -> WAITING la Birou Achiziții.
    actions: [{ kind: 'approve', comment: 'Justificat operațional.' }],
  },
  {
    articol: 'Analizor multiparametru apă',
    cantitate: 1,
    justificare: 'Înlocuirea analizorului defect din laboratorul de calitate.',
    centruCost: 'Laborator calitate apă',
    valoareLei: 15500,
    // Aprobat Șef + Achiziții + Dir. economic -> WAITING la Director General.
    actions: [
      { kind: 'approve', comment: 'Esențial pentru analizele zilnice.' },
      { kind: 'approve', comment: 'Furnizor unic autorizat, ofertă atașată.' },
      { kind: 'approve', comment: 'Aprobat economic.' },
    ],
  },
  {
    articol: 'Închiriere excavator (3 luni)',
    cantitate: 1,
    justificare: 'Lucrări de înlocuire conductă pe magistrala de nord.',
    centruCost: 'Mentenanță rețea',
    valoareLei: 45000,
    // Aprobat integral pe traseul complet -> FINALIZAT.
    actions: [
      { kind: 'approve', comment: 'Lucrare planificată și urgentă.' },
      { kind: 'approve', comment: 'Contract-cadru existent.' },
      { kind: 'approve', comment: 'Fonduri disponibile.' },
      { kind: 'approve', comment: 'Aviz final — se poate contracta.' },
    ],
  },
  {
    articol: 'Mobilier laborator (mese antiacide)',
    cantitate: 6,
    justificare: 'Reamenajarea laboratorului conform normelor de siguranță.',
    centruCost: 'Laborator calitate apă',
    valoareLei: 8500,
    // Aprobat Șef + Achiziții, apoi trimis înapoi de Dir. economic -> Achiziții are din nou WAITING.
    actions: [
      { kind: 'approve', comment: 'De acord cu reamenajarea.' },
      { kind: 'approve', comment: 'Ofertă selectată.' },
      {
        kind: 'send-back',
        comment: 'Reverificați încadrarea pe capitolul de investiții vs. cheltuieli curente.',
      },
    ],
  },
  {
    articol: 'Autospecială electrică intervenții',
    cantitate: 1,
    justificare: 'Extinderea parcului auto cu un vehicul cu emisii zero.',
    centruCost: 'Parc auto',
    valoareLei: 110000,
    // Aprobat Șef + Achiziții, respins de Director Economic -> RESPINS.
    actions: [
      { kind: 'approve', comment: 'Aliniat strategiei de mediu.' },
      { kind: 'approve', comment: 'Ofertă validă.' },
      {
        kind: 'reject',
        comment: 'Depășește plafonul de investiții pentru acest an. Reluați în bugetul următor.',
      },
    ],
  },

  // ---- Short path (< 5.000 lei) ----
  {
    articol: 'Tonere imprimantă (set color)',
    cantitate: 4,
    justificare: 'Consumabile pentru imprimantele biroului IT.',
    centruCost: 'Birou IT',
    valoareLei: 1200,
    // Aprobat Șef -> WAITING la Birou Achiziții.
    actions: [{ kind: 'approve', comment: 'Aprobat, stoc necesar.' }],
  },
  {
    articol: 'Truse de prim ajutor',
    cantitate: 12,
    justificare: 'Reîncărcarea truselor expirate din punctele de lucru.',
    centruCost: 'Administrativ',
    valoareLei: 850,
    // Proaspăt creat -> WAITING la Șef ierarhic.
    actions: [],
  },
  {
    articol: 'Consumabile curățenie (trimestru)',
    cantitate: 1,
    justificare: 'Aprovizionare trimestrială pentru sediul administrativ.',
    centruCost: 'Administrativ',
    valoareLei: 2400,
    // Aprobat integral pe traseul scurt -> FINALIZAT.
    actions: [
      { kind: 'approve', comment: 'De acord.' },
      { kind: 'approve', comment: 'Achiziție realizată din contractul-cadru.' },
    ],
  },
  {
    articol: 'Cabluri de rețea Cat6 (300 m)',
    cantitate: 3,
    justificare: 'Recablarea camerei de servere după mutarea rack-ului.',
    centruCost: 'Birou IT',
    valoareLei: 1900,
    // Proaspăt creat -> WAITING la Șef ierarhic.
    actions: [],
  },

  // ---- Conditional steps via flags (necesită IT / SSM) ----
  {
    articol: 'Licențe antivirus (50 stații)',
    cantitate: 50,
    justificare: 'Reînnoirea licențelor de securitate pentru stațiile de lucru.',
    centruCost: 'Birou IT',
    valoareLei: 3200,
    necesitaIt: true,
    // Traseu scurt + pas IT: Șef -> IT -> Achiziții. Aprobat de Șef -> WAITING la IT.
    actions: [{ kind: 'approve', comment: 'De acord, licențele expiră luna aceasta.' }],
  },
  {
    articol: 'Echipament ridicat sarcini (macara mobilă)',
    cantitate: 1,
    justificare: 'Manipularea în siguranță a pompelor grele la stația de captare.',
    centruCost: 'Stație captare',
    valoareLei: 62000,
    necesitaSsm: true,
    // Traseu complet + pas SSM: Șef -> SSM -> Achiziții -> Dir. economic -> Dir. general.
    // Aprobat Șef -> WAITING la SSM.
    actions: [{ kind: 'approve', comment: 'Necesar pentru protecția echipelor.' }],
  },
];

const OPEN_TASK_STATUSES: TaskStatus[] = [
  TaskStatus.PENDING,
  TaskStatus.SENT_BACK,
];

async function main(): Promise<void> {
  // Clean slate (children first — Transition has no UPDATE/DELETE in the app,
  // but the seed is allowed to reset the demo database).
  await prisma.transition.deleteMany();
  await prisma.approvalTask.deleteMany();
  await prisma.referat.deleteMany();
  await prisma.workflowStep.deleteMany();
  await prisma.workflow.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = hashSync(DEMO_PASSWORD, 10);
  const users = await Promise.all(
    USERS.map((u) => prisma.user.create({ data: { ...u, passwordHash } })),
  );
  const userByRole = new Map(users.map((u) => [u.role, u]));
  const requester = userByRole.get(Role.ANGAJAT)!;

  // The single active workflow that new referate route against.
  const workflow = await prisma.workflow.create({
    data: {
      name: 'Flux standard achiziții',
      isActive: true,
      steps: {
        create: STANDARD_WORKFLOW_STEPS.map((step, index) => ({
          order: index + 1,
          role: step.role,
          label: step.label,
          appliesWhen:
            step.appliesWhen == null
              ? Prisma.JsonNull
              : (step.appliesWhen as Prisma.InputJsonValue),
        })),
      },
    },
  });

  for (const spec of REFERATE) {
    await seedReferat(spec, requester.id, workflow.id, userByRole);
  }

  const counts = {
    users: await prisma.user.count(),
    workflows: await prisma.workflow.count(),
    referate: await prisma.referat.count(),
    tasks: await prisma.approvalTask.count(),
    transitions: await prisma.transition.count(),
  };
  // eslint-disable-next-line no-console
  console.log('Seed complet:', counts);
}

async function seedReferat(
  spec: SeedReferat,
  requesterId: string,
  workflowId: string,
  userByRole: Map<Role, { id: string; role: Role }>,
): Promise<void> {
  const necesitaIt = spec.necesitaIt ?? false;
  const necesitaSsm = spec.necesitaSsm ?? false;
  const chain = chainFor({
    valoareLei: spec.valoareLei,
    necesitaIt,
    necesitaSsm,
  });

  // Create + materialize chain + creation transition (mirrors WorkflowService.create).
  const referat = await prisma.$transaction(async (tx) => {
    const created = await tx.referat.create({
      data: {
        articol: spec.articol,
        cantitate: spec.cantitate,
        justificare: spec.justificare,
        centruCost: spec.centruCost,
        valoareLei: spec.valoareLei,
        necesitaIt,
        necesitaSsm,
        requesterId,
        workflowId,
        status: ReferatStatus.IN_ASTEPTARE,
        tasks: {
          create: chain.map((role, index) => ({
            stepOrder: index + 1,
            role,
            status: index === 0 ? TaskStatus.WAITING : TaskStatus.PENDING,
            effectiveApproverId: userByRole.get(role)?.id ?? null,
          })),
        },
      },
    });
    await tx.transition.create({
      data: {
        referatId: created.id,
        fromState: null,
        toState: ReferatStatus.IN_ASTEPTARE,
        actorId: requesterId,
        comment: 'Referat creat și trimis spre aprobare.',
      },
    });
    return created;
  });

  // Replay actions, each performed by the role of the current WAITING step.
  for (const action of spec.actions) {
    await replayAction(referat.id, action, userByRole);
  }
}

async function replayAction(
  referatId: string,
  action: SeedAction,
  userByRole: Map<Role, { id: string; role: Role }>,
): Promise<void> {
  const referat = await prisma.referat.findUniqueOrThrow({
    where: { id: referatId },
    include: { tasks: { orderBy: { stepOrder: 'asc' } } },
  });
  const current = referat.tasks.find((t) => t.status === TaskStatus.WAITING);
  if (!current) return;
  const actor = userByRole.get(current.role)!;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    let toState: ReferatStatus;

    if (action.kind === 'approve') {
      await tx.approvalTask.update({
        where: { id: current.id },
        data: {
          status: TaskStatus.APPROVED,
          actedById: actor.id,
          actedAt: now,
          comment: action.comment ?? null,
        },
      });
      const next = referat.tasks
        .filter(
          (t) =>
            t.stepOrder > current.stepOrder &&
            OPEN_TASK_STATUSES.includes(t.status),
        )
        .sort((a, b) => a.stepOrder - b.stepOrder)[0];
      if (next) {
        await tx.approvalTask.update({
          where: { id: next.id },
          data: { status: TaskStatus.WAITING },
        });
        toState = ReferatStatus.IN_ASTEPTARE;
      } else {
        toState = ReferatStatus.FINALIZAT;
      }
    } else if (action.kind === 'reject') {
      await tx.approvalTask.update({
        where: { id: current.id },
        data: {
          status: TaskStatus.REJECTED,
          actedById: actor.id,
          actedAt: now,
          comment: action.comment,
        },
      });
      toState = ReferatStatus.RESPINS;
    } else {
      await tx.approvalTask.update({
        where: { id: current.id },
        data: {
          status: TaskStatus.SENT_BACK,
          actedById: actor.id,
          actedAt: now,
          comment: action.comment,
        },
      });
      const previous = referat.tasks
        .filter((t) => t.stepOrder < current.stepOrder)
        .sort((a, b) => b.stepOrder - a.stepOrder)[0];
      if (previous) {
        await tx.approvalTask.update({
          where: { id: previous.id },
          data: {
            status: TaskStatus.WAITING,
            actedById: null,
            actedAt: null,
            comment: null,
          },
        });
      }
      toState = ReferatStatus.TRIMIS_INAPOI;
    }

    await tx.referat.update({
      where: { id: referatId },
      data: { status: toState },
    });
    await tx.transition.create({
      data: {
        referatId,
        fromState: referat.status,
        toState,
        actorId: actor.id,
        comment:
          action.kind === 'approve'
            ? (action.comment ?? `Aprobat de ${current.role}.`)
            : action.comment,
      },
    });
  });
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });

// Keep the Prisma namespace import meaningful for tooling.
export type SeededReferat = Prisma.ReferatGetPayload<{ include: { tasks: true } }>;
