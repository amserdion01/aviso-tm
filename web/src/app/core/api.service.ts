import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateReferatPayload,
  Referat,
  Role,
  User,
  Workflow,
  WorkflowStep,
} from './models';

/**
 * Single gateway for every HTTP call to the Aviso TM API.
 * Base URL comes from the environment. Auth is faked: the acting user id is
 * sent in the request body/query, never a session.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.base}/users`);
  }

  /** Inbox: referate with a WAITING task for the given role. */
  getInbox(role: Role): Observable<Referat[]> {
    const params = new HttpParams().set('role', role);
    return this.http.get<Referat[]>(`${this.base}/referate`, { params });
  }

  getAll(): Observable<Referat[]> {
    return this.http.get<Referat[]>(`${this.base}/referate/all`);
  }

  getOne(id: string): Observable<Referat> {
    return this.http.get<Referat>(`${this.base}/referate/${id}`);
  }

  create(payload: CreateReferatPayload): Observable<Referat> {
    return this.http.post<Referat>(`${this.base}/referate`, payload);
  }

  approve(id: string, actingUserId: string, comment?: string): Observable<Referat> {
    return this.http.post<Referat>(`${this.base}/referate/${id}/approve`, {
      actingUserId,
      comment,
    });
  }

  reject(id: string, actingUserId: string, comment: string): Observable<Referat> {
    return this.http.post<Referat>(`${this.base}/referate/${id}/reject`, {
      actingUserId,
      comment,
    });
  }

  sendBack(id: string, actingUserId: string, comment: string): Observable<Referat> {
    return this.http.post<Referat>(`${this.base}/referate/${id}/send-back`, {
      actingUserId,
      comment,
    });
  }

  // ---- Attachments (files live in R2; upload goes through the API) ----

  /** Multipart upload of one or more files onto a referat. */
  uploadAttachments(
    referatId: string,
    files: File[],
    actingUserId: string,
  ): Observable<Referat> {
    const form = new FormData();
    for (const file of files) form.append('files', file, file.name);
    form.append('actingUserId', actingUserId);
    return this.http.post<Referat>(
      `${this.base}/referate/${referatId}/atasamente`,
      form,
    );
  }

  /** API URL for one attachment; the API answers with a 302 to a presigned R2 URL. */
  attachmentDownloadUrl(referatId: string, attachmentId: string): string {
    return `${this.base}/referate/${referatId}/atasamente/${attachmentId}/download`;
  }

  /** URL of the print-ready PDF document for a referat (served inline). */
  referatPdfUrl(referatId: string): string {
    return `${this.base}/referate/${referatId}/pdf`;
  }

  // ---- Configurable workflow ----

  /** The active workflow + ordered steps (drives new referate + the live preview). */
  getActiveWorkflow(): Observable<Workflow> {
    return this.http.get<Workflow>(`${this.base}/workflows/active`);
  }

  getWorkflow(id: string): Observable<Workflow> {
    return this.http.get<Workflow>(`${this.base}/workflows/${id}`);
  }

  /** Replace the entire ordered step list of a workflow. */
  saveSteps(
    id: string,
    steps: Pick<WorkflowStep, 'order' | 'role' | 'label' | 'appliesWhen'>[],
  ): Observable<Workflow> {
    return this.http.put<Workflow>(`${this.base}/workflows/${id}/steps`, { steps });
  }
}
