import { Prisma, Role, ReferatStatus, TaskStatus } from '@prisma/client';
import { REFERAT_INCLUDE } from './referate.service';

/** The full referat shape the detail endpoint returns (REFERAT_INCLUDE). */
export type ReferatDocumentData = Prisma.ReferatGetPayload<{
  include: typeof REFERAT_INCLUDE;
}>;

const ROLE_LABEL: Record<Role, string> = {
  ANGAJAT: 'Angajat',
  SEF_IERARHIC: 'Șef ierarhic',
  IT: 'Serviciul IT',
  SSM: 'Responsabil SSM',
  ACHIZITII: 'Birou Achiziții',
  DIR_ECONOMIC: 'Director Economic',
  DIR_GENERAL: 'Director General',
};

const STATUS_LABEL: Record<ReferatStatus, string> = {
  IN_ASTEPTARE: 'În așteptare',
  APROBAT: 'Aprobat',
  RESPINS: 'Respins',
  TRIMIS_INAPOI: 'Trimis înapoi',
  FINALIZAT: 'Finalizat',
};

const TASK_LABEL: Record<TaskStatus, string> = {
  PENDING: '—',
  WAITING: 'În așteptare',
  APPROVED: 'Aprobat',
  REJECTED: 'Respins',
  SENT_BACK: 'Trimis înapoi',
};

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shortCode(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

/** 4200 → "4.200 lei" (dot thousands, Romanian convention). */
function lei(value: number): string {
  return `${String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} lei`;
}

function dataRo(d: Date | null | undefined): string {
  if (!d) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

function dataOraRo(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dataRo(d)} · ${hh}:${mi}`;
}

function bytesRo(n: number): string {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Render a referat as a self-contained, print-ready A4 HTML document.
 * Generated for ANY state — the footer marks it as informative, reflecting the
 * state at generation time. Mirrors the approach of the sibling Aviso project.
 */
export function renderReferatDocument(
  referat: ReferatDocumentData,
  generatedAt: Date,
): string {
  const avize =
    [referat.necesitaIt ? 'IT' : null, referat.necesitaSsm ? 'SSM' : null]
      .filter(Boolean)
      .join(', ') || '—';

  const taskRows = referat.tasks
    .map((t, i) => {
      const ok = t.status === TaskStatus.APPROVED;
      return `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${esc(ROLE_LABEL[t.role])}</td>
        <td>${esc(t.effectiveApprover?.name ?? '—')}</td>
        <td class="center ${ok ? 'ok' : ''}">${ok ? '✓ ' : ''}${esc(TASK_LABEL[t.status])}</td>
        <td class="center">${dataRo(t.actedAt)}</td>
        <td class="muted">${esc(t.comment ?? '')}</td>
      </tr>`;
    })
    .join('');

  const istoricRows = referat.transitions
    .map(
      (tr) => `
      <li>
        <span class="mono">${dataOraRo(tr.createdAt)}</span> ·
        <b>${esc(tr.actor?.name ?? '—')}</b> ·
        ${esc(tr.fromState ? STATUS_LABEL[tr.fromState as ReferatStatus] : 'Creare')} →
        ${esc(STATUS_LABEL[tr.toState as ReferatStatus])}${tr.comment ? ` — <i>${esc(tr.comment)}</i>` : ''}
      </li>`,
    )
    .join('');

  const attachmentRows =
    referat.attachments.length === 0
      ? '<li class="muted">Fără atașamente.</li>'
      : referat.attachments
          .map((a) => `<li>${esc(a.fileName)} <span class="muted">(${bytesRo(a.sizeBytes)})</span></li>`)
          .join('');

  return `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; color: #1f2937; font-size: 12px; line-height: 1.5; margin: 0; }
  .topbar { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f3a5c; padding-bottom: 10px; }
  .company { font-size: 15px; font-weight: 700; letter-spacing: .3px; color: #0f3a5c; }
  .company small { display: block; font-weight: 400; font-size: 10px; color: #6b7280; letter-spacing: 0; }
  .meta { text-align: right; font-size: 11px; color: #374151; }
  .meta b { color: #111827; }
  h1 { font-size: 19px; letter-spacing: 1px; margin: 22px 0 2px; text-align: center; }
  .status-line { text-align: center; font-size: 11px; color: #374151; margin-bottom: 18px; }
  .status-line b { text-transform: uppercase; letter-spacing: .5px; }
  .fields { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px 18px; margin: 14px 0; }
  .field .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: .8px; color: #6b7280; }
  .field .val { font-weight: 600; }
  .block { margin: 14px 0; }
  .block .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: .8px; color: #6b7280; margin-bottom: 3px; }
  .just { background: #f3f4f6; border-radius: 6px; padding: 10px 12px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .8px; color: #0f3a5c; margin: 20px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .6px; color: #6b7280; padding: 6px 8px; border-bottom: 1px solid #d1d5db; }
  td { padding: 6px 8px; border-bottom: 1px solid #eef0f3; vertical-align: top; }
  td.num { width: 24px; color: #6b7280; }
  td.center, th.center { text-align: center; }
  td.ok { color: #15803d; font-weight: 600; }
  .muted { color: #6b7280; }
  .mono { font-family: "Courier New", monospace; font-size: 11px; }
  ul { margin: 4px 0; padding-left: 18px; }
  li { margin: 3px 0; }
  .footer { margin-top: 26px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 10px; color: #6b7280; }
</style>
</head>
<body>
  <div class="topbar">
    <div class="company">Aviso TM<small>Apa Timișoara · Sistem intern de referate de necesitate</small></div>
    <div class="meta">Referat <b>${esc(shortCode(referat.id))}</b><br/>Generat: ${dataOraRo(generatedAt)}</div>
  </div>

  <h1>REFERAT DE NECESITATE</h1>
  <div class="status-line">Stare curentă: <b>${esc(STATUS_LABEL[referat.status])}</b></div>

  <div class="fields">
    <div class="field"><div class="lbl">Articol</div><div class="val">${esc(referat.articol)}</div></div>
    <div class="field"><div class="lbl">Cantitate</div><div class="val">${esc(referat.cantitate)}</div></div>
    <div class="field"><div class="lbl">Valoare estimată</div><div class="val">${esc(lei(referat.valoareLei))}</div></div>
    <div class="field"><div class="lbl">Centru de cost</div><div class="val">${esc(referat.centruCost)}</div></div>
    <div class="field"><div class="lbl">Solicitant</div><div class="val">${esc(referat.requester?.name ?? '—')}</div></div>
    <div class="field"><div class="lbl">Data creării</div><div class="val">${dataRo(referat.createdAt)}</div></div>
    <div class="field"><div class="lbl">Avize suplimentare</div><div class="val">${esc(avize)}</div></div>
  </div>

  <div class="block">
    <div class="lbl">Justificare</div>
    <div class="just">${esc(referat.justificare)}</div>
  </div>

  <h2>Traseu de avizare</h2>
  <table>
    <thead>
      <tr><th></th><th>Pas</th><th>Aprobator</th><th class="center">Stare</th><th class="center">Data</th><th>Comentariu</th></tr>
    </thead>
    <tbody>${taskRows}</tbody>
  </table>

  <h2>Istoric</h2>
  <ul>${istoricRows}</ul>

  <h2>Atașamente</h2>
  <ul>${attachmentRows}</ul>

  <div class="footer">
    Document generat electronic din Aviso TM la ${dataOraRo(generatedAt)}.
    Document informativ — reflectă starea referatului la momentul generării.
  </div>
</body>
</html>`;
}
