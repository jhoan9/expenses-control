import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, throwError } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';

interface AuthResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    user: any;
  };
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly API_URL = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private isRefreshing = false;
  private refreshTokenSubject = new Subject<string>();

  constructor(private http: HttpClient, private router: Router) {
    try {
      const user = localStorage.getItem('user');
      if (user && user !== 'undefined') {
        this.currentUserSubject.next(JSON.parse(user));
      }
    } catch {
      localStorage.removeItem('user');
    }
  }

  get currentUser(): any {
    return this.currentUserSubject.value;
  }

  get isLoggedIn(): boolean {
    const token = this.accessToken;
    if (!token) return false;
    return !this.isTokenExpired(token);
  }

  get accessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  get refreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.API_URL}/auth/login`, { email, password })
      .pipe(
        tap((response) => {
          const { accessToken, refreshToken, user } = response.data;
          this.storeTokens(accessToken, refreshToken);
          this.currentUserSubject.next(user);
          localStorage.setItem('user', JSON.stringify(user));
        })
      );
  }

  register(data: {
    email: string;
    password: string;
    name: string;
  }): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.API_URL}/auth/register`, data)
      .pipe(
        tap((response) => {
          const { accessToken, refreshToken, user } = response.data;
          this.storeTokens(accessToken, refreshToken);
          this.currentUserSubject.next(user);
          localStorage.setItem('user', JSON.stringify(user));
        })
      );
  }

  handleRefreshToken(): Observable<string> {
    if (this.isRefreshing) {
      return this.refreshTokenSubject.asObservable();
    }

    this.isRefreshing = true;
    this.refreshTokenSubject = new Subject<string>();

    const rt = this.refreshToken;
    if (!rt) {
      this.isRefreshing = false;
      this.logout();
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http
      .post<{ success: boolean; data: { accessToken: string; refreshToken: string } }>(
        `${this.API_URL}/auth/refresh`,
        { refreshToken: rt }
      )
      .pipe(
        switchMap((response) => {
          const { accessToken, refreshToken } = response.data;
          this.storeTokens(accessToken, refreshToken);
          this.refreshTokenSubject.next(accessToken);
          this.refreshTokenSubject.complete();
          this.isRefreshing = false;
          return new Observable<string>((observer) => {
            observer.next(accessToken);
            observer.complete();
          });
        }),
        catchError((error) => {
          this.refreshTokenSubject.error(error);
          this.refreshTokenSubject = new Subject<string>();
          this.isRefreshing = false;
          this.logout();
          return throwError(() => error);
        })
      );
  }

  logout(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
    this.router.navigate(['/auth/login']);
  }

  private storeTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp < currentTime;
    } catch {
      return true;
    }
  }
}
