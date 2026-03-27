const isDataCloneError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'DataCloneError';

const toJsonSafeValue = (value: unknown, visited: WeakSet<object>): unknown => {
  if (value === null) {
    return null;
  }

  const valueType = typeof value;

  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
    return value;
  }

  if (valueType === 'bigint' || valueType === 'function' || valueType === 'symbol') {
    return undefined;
  }

  if (valueType !== 'object') {
    return undefined;
  }

  const objectValue = value as object;

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof RegExp || value instanceof Map || value instanceof Set) {
    return undefined;
  }

  if (visited.has(objectValue)) {
    return undefined;
  }

  visited.add(objectValue);

  if (Array.isArray(value)) {
    return value
      .map((entry) => toJsonSafeValue(entry, visited))
      .filter((entry) => entry !== undefined);
  }

  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    return undefined;
  }

  const safeRecord: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    const safeEntry = toJsonSafeValue(entry, visited);
    if (safeEntry !== undefined) {
      safeRecord[key] = safeEntry;
    }
  });

  return safeRecord;
};

const fallbackClone = <T>(value: T): T => {
  const safeValue = toJsonSafeValue(value, new WeakSet<object>());

  if (safeValue === undefined) {
    return (Array.isArray(value) ? [] : {}) as T;
  }

  return JSON.parse(JSON.stringify(safeValue)) as T;
};

export const cloneSerializable = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch (error) {
      if (!isDataCloneError(error)) {
        throw error;
      }
    }
  }

  return fallbackClone(value);
};
