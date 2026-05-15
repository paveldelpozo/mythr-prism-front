const normalizeUrl = (value: string): string => value.replace(/\/+$/, '');

const pickConfiguredUrl = (value: string | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return normalizeUrl(trimmed);
};

export const resolveFullControlApiUrl = (): string => {
  const configured = pickConfiguredUrl(import.meta.env.VITE_FULL_CONTROL_API_URL);
  if (configured) {
    return configured;
  }

  return normalizeUrl(window.location.origin);
};

export const resolveFullControlApiKey = (): string | null =>
  (() => {
    const configured = import.meta.env.VITE_FULL_CONTROL_API_KEY;
    if (typeof configured !== 'string') {
      return null;
    }

    const trimmed = configured.trim();
    return trimmed.length > 0 ? trimmed : null;
  })();
