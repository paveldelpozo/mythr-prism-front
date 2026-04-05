import { describe, expect, it } from 'vitest';
import { buildRemoteJoinUrl, parseRemotePairingQuery } from './remotePairing';

describe('utils/remotePairing', () => {
  it('genera URL de acceso remoto con roomId y pairingCode', () => {
    const url = buildRemoteJoinUrl({
      baseUrl: 'https://mythr.app/',
      roomId: 'sala-1',
      pairCode: 'abcd-1234-efgh'
    });

    expect(url).toBe('https://mythr.app/remote?roomId=sala-1&pairingCode=ABCD-1234-EFGH');
  });

  it('parsea roomId y codigo validos desde query params', () => {
    const parsed = parseRemotePairingQuery('?roomId=sala-1&pairingCode=abcd-1234-efgh');

    expect(parsed).toEqual({
      roomId: 'sala-1',
      pairCode: 'ABCD-1234-EFGH',
      feedback: null
    });
  });

  it('informa feedback cuando el codigo de la URL es invalido', () => {
    const parsed = parseRemotePairingQuery('?roomId=sala-1&pairingCode=abcd');

    expect(parsed.roomId).toBe('sala-1');
    expect(parsed.pairCode).toBe('ABCD');
    expect(parsed.feedback).toContain('formato valido');
  });
});
