import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreateReferatPayload, Referat, Role, User } from './models';

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
}
