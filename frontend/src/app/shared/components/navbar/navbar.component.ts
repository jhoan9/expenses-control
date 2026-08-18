import { Component } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="navbar">
      <div class="navbar-content">
        <span class="greeting" *ngIf="authService.currentUser as user">
          Hola, {{ user.name }}
        </span>
      </div>
    </nav>
  `,
  styles: [`
    .navbar {
      background: white;
      padding: 16px 24px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .navbar-content {
      display: flex;
      justify-content: flex-end;
      align-items: center;
    }
    .greeting {
      font-weight: 500;
      color: #333;
    }
  `]
})
export class NavbarComponent {
  constructor(public authService: AuthService) {}
}
