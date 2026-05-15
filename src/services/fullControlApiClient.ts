import type {
  ApiErrorEnvelope,
  MonitorFoundationRecord,
  SystemStatusResponse
} from '../types/fullControlApi';

export interface FullControlApiClient {
  getSystemStatus: () => Promise<SystemStatusResponse>;
  getMonitors: () => Promise<MonitorFoundationRecord[]>;
}

export class FullControlApiError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, code = 'request_failed', details?: unknown) {
    super(message);
    this.name = 'FullControlApiError';
    this.code = code;
    this.details = details;
  }
}

interface FullControlApiClientOptions {
  baseUrl: string;
  apiKey: string;
}

const readErrorEnvelope = (value: unknown): ApiErrorEnvelope | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.code !== 'string' || typeof candidate.message !== 'string') {
    return null;
  }

  return {
    code: candidate.code,
    message: candidate.message,
    details: candidate.details
  };
};

const ensureJsonResponse = async <TPayload>(response: Response): Promise<TPayload> => {
  const payload = await response.json();

  if (response.ok) {
    return payload as TPayload;
  }

  const envelope = readErrorEnvelope(payload);
  if (envelope) {
    throw new FullControlApiError(envelope.message, envelope.code, envelope.details);
  }

  throw new FullControlApiError(
    `HTTP ${response.status}: request failed without valid API error envelope.`,
    'invalid_error_envelope'
  );
};

export const createFullControlApiClient = (
  options: FullControlApiClientOptions
): FullControlApiClient => {
  const base = options.baseUrl.replace(/\/+$/, '');

  const request = async <TPayload>(path: string): Promise<TPayload> => {
    const response = await fetch(`${base}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-api-key': options.apiKey
      }
    });

    return ensureJsonResponse<TPayload>(response);
  };

  return {
    getSystemStatus: () => request<SystemStatusResponse>('/api/v1/system/status'),
    getMonitors: () => request<MonitorFoundationRecord[]>('/api/v1/monitors')
  };
};
