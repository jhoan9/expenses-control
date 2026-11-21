import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  get<T>(path: string, params: any = {}): Observable<T> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined && params[key] !== null) {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get<T>(`${this.API_URL}${path}`, { params: httpParams });
  }

  post<T>(path: string, body: any = {}, options: { silentErrors?: boolean } = {}): Observable<T> {
    const headers = options.silentErrors ? new HttpHeaders({ 'X-Silent-Errors': '1' }) : undefined;
    return this.http.post<T>(`${this.API_URL}${path}`, body, { headers });
  }

  /** URL absoluta de la API (para mostrarla en instrucciones de automatizaciones). */
  get baseUrl(): string {
    return this.API_URL;
  }

  put<T>(path: string, body: any = {}): Observable<T> {
    return this.http.put<T>(`${this.API_URL}${path}`, body);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.API_URL}${path}`);
  }
}
