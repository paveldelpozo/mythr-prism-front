export const REMOTE_PAIR_CODE_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export interface BuildRemoteJoinUrlOptions {
  baseUrl: string;
  roomId: string;
  pairCode: string;
}

export interface ParsedRemotePairingQuery {
  roomId: string;
  pairCode: string;
  feedback: string | null;
}

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '');

export const normalizePairCode = (value: string): string => value.trim().toUpperCase();

export const isValidPairCode = (value: string): boolean => REMOTE_PAIR_CODE_PATTERN.test(normalizePairCode(value));

export const buildRemoteJoinUrl = ({
  baseUrl,
  roomId,
  pairCode
}: BuildRemoteJoinUrlOptions): string => {
  const params = new URLSearchParams({
    roomId: roomId.trim(),
    pairingCode: normalizePairCode(pairCode)
  });

  return `${normalizeBaseUrl(baseUrl)}/remote?${params.toString()}`;
};

export const parseRemotePairingQuery = (search: string): ParsedRemotePairingQuery => {
  const query = new URLSearchParams(search);
  const roomId = query.get('roomId')?.trim() ?? '';
  const rawPairCode = query.get('pairingCode') ?? query.get('pairCode') ?? '';
  const pairCode = normalizePairCode(rawPairCode);

  if (rawPairCode.trim().length > 0 && !isValidPairCode(pairCode)) {
    return {
      roomId,
      pairCode,
      feedback: 'El codigo de emparejamiento en la URL no tiene formato valido (`XXXX-XXXX-XXXX`).'
    };
  }

  if (pairCode.length > 0 && roomId.length === 0) {
    return {
      roomId,
      pairCode,
      feedback: 'La URL remota incluye codigo pero no roomId. Verifica el QR o enlace compartido.'
    };
  }

  return {
    roomId,
    pairCode,
    feedback: null
  };
};
