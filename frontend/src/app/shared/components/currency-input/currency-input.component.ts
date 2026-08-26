import { Component, Input, Renderer2, ElementRef, forwardRef } from '@angular/core';
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
export class CurrencyInputComponent implements ControlValueAccessor {
  @Input() placeholder = '0';
  @Input() allowDecimals = true;

  disabled = false;

  private intDigits = '';
  private decDigits = '';
  private decimalMode = false;
  private renderedValue = '';

  private onChange: (v: any) => void = () => {};
  onTouched: () => void = () => {};

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  get inputEl(): HTMLInputElement {
    return this.el.nativeElement.querySelector('input');
  }

  writeValue(value: any): void {
    if (value === null || value === undefined || value === '') {
      this.intDigits = '';
      this.decDigits = '';
      this.decimalMode = false;
      this.setRendered('');
      return;
    }
    const num = Number(value);
    if (isNaN(num)) {
      this.intDigits = '';
      this.decDigits = '';
      this.decimalMode = false;
      this.setRendered('');
      return;
    }
    const fixed = Math.abs(Math.round(num * 100000) / 100000).toFixed(5);
    const [i, d] = fixed.split('.');
    this.intDigits = i.replace(/^0+(?=\d)/, '');
    this.decDigits = d.replace(/0+$/, '');
    this.decimalMode = false;
    this.setRendered(this.buildDisplay());
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

  private setRendered(value: string): void {
    this.renderedValue = value;
    this.renderer.setProperty(this.inputEl, 'value', value);
  }

  onFocus(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    setTimeout(() => input.select());
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.allowDecimals && (event.key === '.' || event.key === ',')) {
      event.preventDefault();
    }
  }

  onInput(event: Event): void {
    if (this.disabled) return;
    const input = event.target as HTMLInputElement;
    const inputValue = input.value ?? '';
    const evt = event as InputEvent;
    const data = evt.data;
    const inputType = evt.inputType || '';

    // Borrado (backspace, delete, cortar)
    if (inputType.startsWith('delete')) {
      if (this.decimalMode && this.decDigits.length > 0) {
        this.decDigits = this.decDigits.slice(0, -1);
        if (this.decDigits.length === 0) this.decimalMode = false;
      } else if (this.decimalMode && this.decDigits.length === 0) {
        this.decimalMode = false;
      } else {
        this.intDigits = this.intDigits.slice(0, -1);
      }
      this.emitAndRender();
      return;
    }

    // Pegado o soltado de texto: reparse completo con heurística segura
    if (inputType === 'insertFromPaste' || inputType === 'insertFromDrop') {
      this.handlePaste(inputValue);
      this.emitAndRender();
      return;
    }

    if (data) {
      if (/[.,]/.test(data) && this.allowDecimals) {
        this.decimalMode = true;
      } else if (/\d/.test(data)) {
        if (this.decimalMode) {
          if (this.decDigits.length < 5) this.decDigits += data;
        } else {
          const next = (this.intDigits + data).replace(/^0+(?=\d)/, '');
          if (next.length <= 15) this.intDigits = next;
        }
      } else if (inputValue.replace(/[^0-9.,]/g, '') === '' ) {
        // Campo vaciado manualmente
        this.intDigits = '';
        this.decDigits = '';
        this.decimalMode = false;
      }
      // Caracteres extraños ($, letras, espacios): ignorar
    }

    this.emitAndRender();
  }

  private handlePaste(text: string): void {
    const cleaned = text.replace(/[^0-9.,]/g, '');
    this.intDigits = '';
    this.decDigits = '';
    this.decimalMode = false;

    if (!cleaned) return;

    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');

    let intPart = '';
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
        // Varios separadores: son agrupación de miles
        intPart = parts.join('');
      } else {
        const decimals = parts[1] ?? '';
        if (decimals.length === 3 && parts[0].length > 0 && parts[0].length <= 3) {
          // Patrón típico de miles: "50.000"
          intPart = parts[0] + decimals;
        } else {
          intPart = parts[0];
          decPart = decimals;
        }
      }
    } else {
      intPart = cleaned;
    }

    this.intDigits = intPart.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 15);
    this.decDigits = decPart.replace(/\D/g, '').slice(0, 5);
    this.decimalMode = this.decDigits.length > 0;
  }

  private currentValue(): number | null {
    if (!this.intDigits && !this.decDigits) return null;
    const num = Number(`${this.intDigits || '0'}.${this.decDigits || '0'}`);
    return isNaN(num) ? null : Math.round(num * 100000) / 100000;
  }

  private buildDisplay(): string {
    if (!this.intDigits && !this.decDigits) return '';
    const int = Number(this.intDigits || '0');
    const grouped = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(int);
    const dec = this.decDigits ? `,${this.decDigits}` : this.decimalMode ? ',' : '';
    return `$ ${grouped}${dec}`;
  }

  private emitAndRender(): void {
    const value = this.currentValue();
    this.onChange(value);
    this.setRendered(this.buildDisplay());
  }
}
