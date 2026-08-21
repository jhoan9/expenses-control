import { Component, Input, Renderer2, ElementRef, forwardRef, OnDestroy } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-currency-input',
  standalone: true,
  template: `<input
    type="text"
    inputmode="decimal"
    [placeholder]="placeholder"
    [disabled]="disabled"
    (input)="onInput($event)"
    (blur)="onTouched()"
    (focus)="onFocus($event)"
    (keydown)="onKeydown($event)"
  />`,
  styles: [
    `
      :host { display: block; width: 100%; }
      input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 1rem;
        box-sizing: border-box;
      }
      input:focus {
        outline: none;
        border-color: #4caf50;
      }
      input:disabled {
        background: #f5f5f5;
        cursor: not-allowed;
      }
    `,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CurrencyInputComponent),
      multi: true,
    },
  ],
})
export class CurrencyInputComponent implements ControlValueAccessor, OnDestroy {
  @Input() placeholder = '0';
  @Input() allowDecimals = true;

  disabled = false;
  private rawValue: number | null = null;

  private onChange: (v: any) => void = () => {};
  onTouched: () => void = () => {};

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  get inputEl(): HTMLInputElement {
    return this.el.nativeElement.querySelector('input');
  }

  writeValue(value: any): void {
    this.rawValue = value === null || value === undefined || value === '' ? null : Number(value);
    this.renderer.setProperty(this.inputEl, 'value', this.format(this.rawValue));
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onFocus(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    setTimeout(() => input.select());
  }

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const parsed = this.parse(input.value);
    this.rawValue = parsed;
    this.onChange(parsed);
    const formatted = this.format(parsed);
    if (formatted !== input.value) {
      this.renderer.setProperty(input, 'value', formatted);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.allowDecimals && (event.key === '.' || event.key === ',')) {
      event.preventDefault();
    }
  }

  parse(value: string): number | null {
    let cleaned = String(value ?? '').replace(/[^0-9.,]/g, '');
    if (!cleaned) return null;

    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');

    let intPart = cleaned;
    let decPart = '';

    if (hasComma && hasDot) {
      const decSep = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.') ? ',' : '.';
      const idx = cleaned.lastIndexOf(decSep);
      intPart = cleaned.slice(0, idx);
      decPart = cleaned.slice(idx + 1);
    } else if (hasComma || hasDot) {
      const sep = hasComma ? ',' : '.';
      const parts = cleaned.split(sep);
      if (parts.length > 2) {
        intPart = parts.join('');
      } else {
        const decimals = parts[1] ?? '';
        if (decimals.length === 3) {
          intPart = parts[0] + decimals;
        } else {
          intPart = parts[0];
          decPart = decimals;
        }
      }
    }

    intPart = intPart.replace(/[^0-9]/g, '');
    decPart = decPart.replace(/[^0-9]/g, '');
    if (!intPart && !decPart) return null;

    const num = Number(`${intPart || '0'}.${decPart || '0'}`);
    return isNaN(num) ? null : Math.round(num * 100) / 100;
  }

  format(value: number | null): string {
    if (value === null || value === undefined || isNaN(value)) return '';
    const formatted = new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
    return `$ ${formatted}`;
  }

  ngOnDestroy(): void {}
}
