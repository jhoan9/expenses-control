import { Component, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { NavbarComponent } from '../navbar/navbar.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NavbarComponent],
  template: `
    <div class="layout">
      <app-sidebar #appSidebar />
      <div class="main-area">
        <app-navbar (menuClick)="appSidebar.toggleMenu()" />
        <main class="main-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class LayoutComponent {
  @ViewChild('appSidebar') sidebar!: SidebarComponent;
}