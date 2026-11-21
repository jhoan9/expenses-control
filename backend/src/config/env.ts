import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  get isProduction(): boolean {
    return env.NODE_ENV === 'production';
  },

  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'expenses_control',
  DB_SSL: process.env.DB_SSL === 'true',

  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  CORS_ORIGIN:
    process.env.CORS_ORIGIN ||
    (process.env.NODE_ENV === 'production' ? '*' : 'http://localhost:4200'),

  get corsOrigins(): string[] {
    return env.CORS_ORIGIN.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  },

  AI_API_KEY: process.env.AI_API_KEY || '',
  AI_MODEL: process.env.AI_MODEL || 'gemini-3.6-flash',
  AI_BASE_URL:
    process.env.AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
  AI_REQUEST_TIMEOUT_MS: parseInt(
    process.env.AI_REQUEST_TIMEOUT_MS || '45000',
    10
  ),

  /** Zona horaria para interpretar "hoy" / "ayer" en registros rápidos. */
  APP_TIMEZONE: process.env.APP_TIMEZONE || 'America/Bogota',

  // WhatsApp Cloud API (Meta). Ver docs/integraciones/whatsapp-cloud-api.md
  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || '',
  WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET || '',
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || '',
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  /** Número del bot en formato internacional sin "+", p. ej. 573001234567 (para el enlace wa.me) */
  WHATSAPP_BOT_NUMBER: (process.env.WHATSAPP_BOT_NUMBER || '').replace(/\D/g, ''),
  WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION || 'v21.0',
  /** true: no llama a Meta, imprime en consola los mensajes que enviaría (pruebas locales) */
  WHATSAPP_DRY_RUN: process.env.WHATSAPP_DRY_RUN === 'true',

  get whatsappEnabled(): boolean {
    return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_VERIFY_TOKEN);
  },
};
