import { Pipe, PipeTransform } from '@angular/core';

/** 4200 → "4.200 lei" (dot thousands, Romanian convention). */
export function formatLei(value: number, withSuffix = true): string {
  const grouped = String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return withSuffix ? `${grouped} lei` : grouped;
}

@Pipe({ name: 'lei', standalone: true })
export class LeiPipe implements PipeTransform {
  transform(value: number | null | undefined, withSuffix = true): string {
    if (value == null) return '—';
    return formatLei(value, withSuffix);
  }
}

/** ISO date → "12.06.2026". */
export function formatDataRo(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/** ISO date → "12.06 · 08:15". */
export function formatDataTimeRo(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm} · ${hh}:${mi}`;
}

@Pipe({ name: 'dataRo', standalone: true })
export class DataRoPipe implements PipeTransform {
  transform(iso: string | null | undefined, withTime = false): string {
    if (!iso) return '—';
    return withTime ? formatDataTimeRo(iso) : formatDataRo(iso);
  }
}

/** 348160 → "340 KB"; 2621440 → "2,5 MB" (Romanian decimal comma). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1).replace('.', ',')} MB`;
}

@Pipe({ name: 'bytes', standalone: true })
export class BytesPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value == null) return '—';
    return formatBytes(value);
  }
}
