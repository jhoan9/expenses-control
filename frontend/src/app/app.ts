import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/components/toast/toast.component';
import { ThemeService } from './core/theme/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent],
  template: `<router-outlet /><app-toast />`,
})
export class App {
  // Se inyecta al arrancar para aplicar el tema y escuchar cambios del sistema.
  constructor(_theme: ThemeService) {}
}