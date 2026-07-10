import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateReferatPayload,
  LoginResponse,
  Referat,
  User,
  Workflow,
  WorkflowStep,
} from './models';

/**
 * Single gateway for every HTTP call to the Aviso TM API. The auth interceptor
 * attaches the Bearer token; the acting identity always comes from the JWT on
 * the server, so no user ids travel in payloads.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  // ---- Auth ----

  login(email: string, parola: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/auth/login`, {
      email,
      parola,
    });
  }

  me(): Observable<User> {
    return this.http.get<User>(`${this.base}/auth/me`);
  }

  /** Public demo roster shown on the login screen. */
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.base}/users`);
  }

  // ---- Referate ----

  /** Inbox: referate with a WAITING task for the authenticated user's role. */
  getInbox(): Observable<Referat[]> {
    return this.http.get<Referat[]>(`${this.base}/referate`);
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

  approve(id: string, comment?: string): Observable<Referat> {
    return this.http.post<Referat>(`${this.base}/referate/${id}/approve`, {
      comment,
    });
  }

  reject(id: string, comment: string): Observable<Referat> {
    return this.http.post<Referat>(`${this.base}/referate/${id}/reject`, {
      comment,
    });
  }

  sendBack(id: string, comment: string): Observable<Referat> {
    return this.http.post<Referat>(`${this.base}/referate/${id}/send-back`, {
      comment,
    });
  }

  // ---- Attachments (files live in R2; upload goes through the API) ----

  /** Multipart upload of one or more files onto a referat. */
  uploadAttachments(referatId: string, files: File[]): Observable<Referat> {
    const form = new FormData();
    for (const file of files) form.append('files', file, file.name);
    return this.http.post<Referat>(
      `${this.base}/referate/${referatId}/atasamente`,
      form,
    );
  }

  /** Authenticated fetch of the presigned R2 URL for one attachment. */
  getAttachmentUrl(
    referatId: string,
    attachmentId: string,
  ): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(
      `${this.base}/referate/${referatId}/atasamente/${attachmentId}/download`,
    );
  }

  /** The referat's print-ready PDF, fetched with auth as a Blob. */
  getPdfBlob(referatId: string): Observable<Blob> {
    return this.http.get(`${this.base}/referate/${referatId}/pdf`, {
      responseType: 'blob',
    });
  }

  // ---- Configurable workflow ----

  /** The active workflow + ordered steps (drives new referate + the live preview). */
  getActiveWorkflow(): Observable<Workflow> {
    return this.http.get<Workflow>(`${this.base}/workflows/active`);
  }

  getWorkflow(id: string): Observable<Workflow> {
    return this.http.get<Workflow>(`${this.base}/workflows/${id}`);
  }

  /** Replace the entire ordered step list of a workflow (DIR_GENERAL only). */
  saveSteps(
    id: string,
    steps: Pick<WorkflowStep, 'order' | 'role' | 'label' | 'appliesWhen'>[],
  ): Observable<Workflow> {
    return this.http.put<Workflow>(`${this.base}/workflows/${id}/steps`, { steps });
  }
}
