export interface ApiErrorEnvelope {
  code: string;
  message: string;
  details?: unknown;
}

export interface SystemStatusResponse {
  service: 'mythr-prism-back';
  apiVersion: 'v1';
  status: 'ok';
  secureMode: boolean;
  timestamp: string;
}

export interface MonitorFoundationRecord {
  id: string;
  label: string;
  status: 'available' | 'inactive';
  source: 'foundation-mock';
}

export interface RealtimeEnvelope<TType extends string, TPayload> {
  type: TType;
  payload: TPayload;
}

export type FoundationRealtimeServerEvent =
  | RealtimeEnvelope<'system:hello', { socketId: string; status: SystemStatusResponse }>
  | RealtimeEnvelope<'system:status', SystemStatusResponse>;
