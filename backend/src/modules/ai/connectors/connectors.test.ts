import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBlockedIp, validateBaseUrl } from './url-guard';
import { ConnectorsService } from './connectors.service';
import { decryptSecret, encryptSecret } from './secret-box';

test('bloquea IPs privadas, locales y de metadatos', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.5.4', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) {
    assert.equal(isBlockedIp(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111']) {
    assert.equal(isBlockedIp(ip), false, ip);
  }
});

test('solo URLs HTTPS públicas sin credenciales', () => {
  assert.equal(validateBaseUrl('https://api.ejemplo.com/v1?x=1').toString(), 'https://api.ejemplo.com/v1');
  for (const bad of ['http://api.ejemplo.com', 'https://localhost', 'https://user:pw@api.ejemplo.com', 'https://10.0.0.5', 'https://api.ejemplo.com:8443', 'https://intranet', 'https://db.internal', 'ftp://x.com']) {
    assert.throws(() => validateBaseUrl(bad), undefined, bad);
  }
});

test('la ruta no puede escaparse del host del conector', () => {
  const s = new ConnectorsService();
  const base = 'https://api.ejemplo.com/v2';
  assert.equal(s.buildUrl(base, '/quote', { symbol: 'AAPL' }).toString(), 'https://api.ejemplo.com/v2/quote?symbol=AAPL');
  for (const p of ['//evil.com/x', '/../admin', '/a/../../b', 'quote', '/x@evil.com', '/a\\b', '/a b']) {
    assert.throws(() => s.buildUrl(base, p, {}), undefined, p);
  }
  assert.throws(() => s.buildUrl(base, '/q', { data: 'x'.repeat(201) }));
});

test('normaliza nombre y valida la forma de autenticación', () => {
  const s = new ConnectorsService();
  const n = s.normalize({ name: 'Tasas BanRep!', base_url: 'https://api.ejemplo.com/', auth_type: 'header', auth_name: 'X-Api-Key' });
  assert.equal(n.name, 'tasas-banrep');
  assert.equal(n.base_url, 'https://api.ejemplo.com');
  assert.throws(() => s.normalize({ name: 'x1', base_url: 'https://api.ejemplo.com', auth_type: 'header', auth_name: 'Cookie' }));
  assert.throws(() => s.normalize({ name: 'x1', base_url: 'https://api.ejemplo.com', auth_type: 'query', auth_name: '' }));
});

test('los secretos se cifran y descifran (y el cifrado cambia cada vez)', () => {
  const a = encryptSecret('mi-clave-123');
  const b = encryptSecret('mi-clave-123');
  assert.notEqual(a, b);
  assert.ok(!a.includes('mi-clave'));
  assert.equal(decryptSecret(a), 'mi-clave-123');
  const tampered = a.slice(0, -2) + (a.endsWith('A') ? 'BB' : 'AA');
  assert.throws(() => decryptSecret(tampered));
});
