export interface ExternalUrlPolicy {
  allowlistDomains: readonly string[];
  blockedDomains: readonly string[];
}

export type ExternalUrlValidationReason =
  | 'empty'
  | 'invalid-url'
  | 'invalid-protocol'
  | 'blocked-domain'
  | 'not-allowlisted';

export interface ExternalUrlValidationResult {
  ok: boolean;
  normalizedUrl: string | null;
  hostname: string | null;
  reason: ExternalUrlValidationReason | null;
  message: string | null;
}

const DEFAULT_ALLOWLIST_DOMAINS = ['*'] as const;
const DEFAULT_BLOCKED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1'
] as const;

export const DEFAULT_EXTERNAL_URL_POLICY: ExternalUrlPolicy = {
  allowlistDomains: DEFAULT_ALLOWLIST_DOMAINS,
  blockedDomains: DEFAULT_BLOCKED_DOMAINS
};

const toDomainRules = (domains: readonly string[]): string[] =>
  domains
    .map((domain) => domain.trim().toLowerCase())
    .filter((domain) => domain.length > 0);

const matchesDomainRule = (hostname: string, domainRule: string): boolean => {
  if (domainRule === '*') {
    return true;
  }

  if (hostname === domainRule) {
    return true;
  }

  return hostname.endsWith(`.${domainRule}`);
};

export const validateExternalUrl = (
  value: string,
  policy: ExternalUrlPolicy = DEFAULT_EXTERNAL_URL_POLICY
): ExternalUrlValidationResult => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      normalizedUrl: null,
      hostname: null,
      reason: 'empty',
      message: 'Ingresa una URL para proyectar contenido externo.'
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      normalizedUrl: null,
      hostname: null,
      reason: 'invalid-url',
      message: 'La URL ingresada no es valida.'
    };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      ok: false,
      normalizedUrl: null,
      hostname: null,
      reason: 'invalid-protocol',
      message: 'Solo se permiten URLs http:// o https://.'
    };
  }

  const hostname = parsed.hostname.trim().toLowerCase();
  if (hostname.length === 0) {
    return {
      ok: false,
      normalizedUrl: null,
      hostname: null,
      reason: 'invalid-url',
      message: 'La URL no incluye un dominio valido.'
    };
  }

  const blockedRules = toDomainRules(policy.blockedDomains);
  if (blockedRules.some((rule) => matchesDomainRule(hostname, rule))) {
    return {
      ok: false,
      normalizedUrl: null,
      hostname,
      reason: 'blocked-domain',
      message: `El dominio ${hostname} esta bloqueado por la politica de seguridad.`
    };
  }

  const allowlistRules = toDomainRules(policy.allowlistDomains);
  const hasWildcardAllowlist = allowlistRules.includes('*');
  const isAllowlisted = hasWildcardAllowlist
    || allowlistRules.some((rule) => matchesDomainRule(hostname, rule));

  if (!isAllowlisted) {
    return {
      ok: false,
      normalizedUrl: null,
      hostname,
      reason: 'not-allowlisted',
      message: `El dominio ${hostname} no esta permitido por la allowlist.`
    };
  }

  return {
    ok: true,
    normalizedUrl: parsed.toString(),
    hostname,
    reason: null,
    message: null
  };
};
