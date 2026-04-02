import { describe, expect, it } from 'vitest';
import { validateExternalUrl } from './externalUrlPolicy';

describe('services/externalUrlPolicy', () => {
  it('acepta URL https valida con wildcard allowlist', () => {
    const result = validateExternalUrl('https://docs.example.com/page');

    expect(result.ok).toBe(true);
    expect(result.normalizedUrl).toBe('https://docs.example.com/page');
    expect(result.hostname).toBe('docs.example.com');
  });

  it('rechaza protocolo no permitido', () => {
    const result = validateExternalUrl('javascript:alert(1)');

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid-protocol');
  });

  it('rechaza dominio bloqueado aunque este allowlisted', () => {
    const result = validateExternalUrl('http://localhost:8080', {
      allowlistDomains: ['*'],
      blockedDomains: ['localhost']
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('blocked-domain');
  });

  it('aplica allowlist por dominio y subdominio', () => {
    const allowed = validateExternalUrl('https://media.mythr.dev/intro', {
      allowlistDomains: ['mythr.dev'],
      blockedDomains: []
    });
    const blocked = validateExternalUrl('https://cdn.example.com/intro', {
      allowlistDomains: ['mythr.dev'],
      blockedDomains: []
    });

    expect(allowed.ok).toBe(true);
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toBe('not-allowlisted');
  });
});
