import dns from 'dns';
import net from 'net';
import { AppError } from '../../../shared/errors/AppError';

/**
 * Protección SSRF: el asistente solo puede llamar a hosts públicos por HTTPS.
 * Bloquea localhost, redes privadas, link-local (incl. 169.254.169.254, metadatos
 * de la nube), CGNAT, multicast y direcciones reservadas, en IPv4 e IPv6.
 */

const v4ToInt = (ip: string) => ip.split('.').reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
const inRange = (ip: string, cidr: string) => {
  const [base, bits] = cidr.split('/');
  const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return (v4ToInt(ip) & mask) === (v4ToInt(base) & mask);
};

const BLOCKED_V4 = [
  '0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16', '172.16.0.0/12',
  '192.0.0.0/24', '192.0.2.0/24', '192.168.0.0/16', '198.18.0.0/15', '198.51.100.0/24',
  '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4',
];

export const isBlockedIp = (ip: string): boolean => {
  if (net.isIPv4(ip)) return BLOCKED_V4.some((c) => inRange(ip, c));
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapped) return isBlockedIp(mapped[1]);
    return (
      v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') ||
      v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') ||
      v.startsWith('ff') || v.startsWith('2001:db8')
    );
  }
  return true;
};

/** Valida la URL base de un conector (sin resolver DNS). */
export const validateBaseUrl = (raw: string): URL => {
  let url: URL;
  try {
    url = new URL(String(raw ?? '').trim());
  } catch {
    throw AppError.badRequest('La URL base no es válida.');
  }
  if (url.protocol !== 'https:') throw AppError.badRequest('Solo se permiten APIs con HTTPS.');
  if (url.username || url.password) throw AppError.badRequest('La URL no puede incluir usuario o contraseña; usa el secreto del conector.');
  if (url.port && url.port !== '443') throw AppError.badRequest('Solo se permite el puerto 443.');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.')) {
    throw AppError.badRequest('Ese host no está permitido.');
  }
  const bare = host.replace(/^\[|\]$/g, '');
  if (net.isIP(bare) && isBlockedIp(bare)) throw AppError.badRequest('No se permiten direcciones privadas o reservadas.');
  url.search = '';
  url.hash = '';
  return url;
};

export const resolver = {
  lookup: (host: string) => dns.promises.lookup(host, { all: true, verbatim: true }),
};

/** Resuelve el host y exige que todas sus IP sean públicas. */
export const assertPublicHost = async (host: string): Promise<void> => {
  const bare = host.replace(/^\[|\]$/g, '');
  if (net.isIP(bare)) {
    if (isBlockedIp(bare)) throw AppError.badRequest('No se permiten direcciones privadas o reservadas.');
    return;
  }
  let addrs: { address: string }[];
  try {
    addrs = await resolver.lookup(bare);
  } catch {
    throw AppError.badRequest(`No pude resolver el dominio ${host}.`);
  }
  if (!addrs.length || addrs.some((a) => isBlockedIp(a.address))) {
    throw AppError.badRequest(`El dominio ${host} apunta a una red privada; no está permitido.`);
  }
};
