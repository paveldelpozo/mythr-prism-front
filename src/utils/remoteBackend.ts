const DEFAULT_LOCAL_REMOTE_BACKEND_URL = 'http://localhost:3000';

const normalizeUrl = (value: string): string => value.replace(/\/+$/, '');

const getConfiguredRemotePublicUrl = (): string | null => {
  const configured = import.meta.env.VITE_REMOTE_PUBLIC_URL;
  if (typeof configured !== 'string') {
    return null;
  }

  const trimmed = configured.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return normalizeUrl(trimmed);
};

const getConfiguredRemoteBackendUrl = (): string | null => {
  const configured = import.meta.env.VITE_REMOTE_BACKEND_URL;
  if (typeof configured !== 'string') {
    return null;
  }

  const trimmed = configured.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return normalizeUrl(trimmed);
};

export const resolveRemoteBackendUrl = (): string => {
  const configuredUrl = getConfiguredRemoteBackendUrl();
  if (configuredUrl) {
    return configuredUrl;
  }

  if (import.meta.env.DEV) {
    return DEFAULT_LOCAL_REMOTE_BACKEND_URL;
  }

  return normalizeUrl(window.location.origin);
};

export const resolveRemotePublicUrl = (): string => {
  const configuredUrl = getConfiguredRemotePublicUrl();
  if (configuredUrl) {
    return configuredUrl;
  }

  return normalizeUrl(window.location.origin);
};
