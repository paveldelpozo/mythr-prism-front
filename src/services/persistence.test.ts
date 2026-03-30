import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDebouncedSessionSaver,
  loadPersistedSession,
  SESSION_STORAGE_KEY,
  SESSION_SCHEMA_VERSION,
  type PersistedSessionV1
} from './persistence';

const storage = window.localStorage;

const readStoredSession = (): PersistedSessionV1 => {
  const raw = storage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    throw new Error('No se encontro sesion en storage.');
  }

  return JSON.parse(raw) as PersistedSessionV1;
};

describe('services/persistence', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('sanea payload persistido y aplica clamps defensivos', () => {
    const persisted = {
      version: SESSION_SCHEMA_VERSION,
      ui: {
        showOnlyProjectable: 'si',
        panelPreferences: {
          monitor: true,
          invalid: 'x'
        }
      },
      monitors: {
        m1: {
          transform: {
            rotate: 30,
            scale: 0,
            translateX: 10,
            translateY: -20
          },
          imageDataUrl: 42
        }
      },
      playlist: [
        {
          id: 'img-1',
          kind: 'image',
          name: 'Imagen',
          source: 'data:image/png;base64,AAA',
          durationMs: 3000
        },
        {
          id: '',
          kind: 'video',
          name: 'Video invalido',
          source: 'https://example.com/video.mp4',
          startAtMs: -1,
          endAtMs: 0,
          muted: true
        }
      ],
      playback: {
        targetMonitorIds: ['m1'],
        currentIndex: 999,
        autoplay: true,
        intervalSeconds: 0
      },
      layouts: [
        {
          id: 'layout-1',
          name: 'Escena principal',
          createdAt: '2026-03-30T12:00:00.000Z',
          updatedAt: 'invalid-date',
          snapshot: {
            monitors: {
              m1: {
                transform: {
                  rotate: 5,
                  scale: 0,
                  translateX: 100,
                  translateY: 200
                },
                imageDataUrl: 10
              }
            },
            playback: {
              targetMonitorIds: ['m1', 'm1', '   '],
              currentIndex: -5,
              autoplay: true,
              intervalSeconds: 0
            }
          }
        }
      ]
    };

    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(persisted));

    const loaded = loadPersistedSession();

    expect(loaded.ui.showOnlyProjectable).toBe(true);
    expect(loaded.ui.panelPreferences).toEqual({ monitor: true });
    expect(loaded.monitors.m1.transform.scale).toBe(0.05);
    expect(loaded.monitors.m1.imageDataUrl).toBeNull();
    expect(loaded.playlist).toHaveLength(1);
    expect(loaded.playback.targetMonitorIds).toEqual(['m1']);
    expect(loaded.playback.currentIndex).toBe(0);
    expect(loaded.playback.intervalSeconds).toBe(1);
    expect(loaded.layouts).toHaveLength(1);
    expect(loaded.layouts[0]?.createdAt).toBe('2026-03-30T12:00:00.000Z');
    expect(loaded.layouts[0]?.updatedAt).toBe('1970-01-01T00:00:00.000Z');
    expect(loaded.layouts[0]?.snapshot.monitors.m1.transform.scale).toBe(0.05);
    expect(loaded.layouts[0]?.snapshot.monitors.m1.imageDataUrl).toBeNull();
    expect(loaded.layouts[0]?.snapshot.playback.targetMonitorIds).toEqual(['m1']);
    expect(loaded.layouts[0]?.snapshot.playback.currentIndex).toBe(0);
    expect(loaded.layouts[0]?.snapshot.playback.intervalSeconds).toBe(1);
  });

  it('hidrata con fallback seguro y limpia storage corrupto', () => {
    storage.setItem(SESSION_STORAGE_KEY, '{not-json');

    const loaded = loadPersistedSession();

    expect(loaded.version).toBe(SESSION_SCHEMA_VERSION);
    expect(loaded.ui.showOnlyProjectable).toBe(true);
    expect(loaded.layouts).toEqual([]);
    expect(storage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('mantiene compatibilidad backward/legacy', () => {
    const legacy = {
      showOnlyProjectable: false,
      monitorStates: {
        m2: {
          transform: {
            rotate: 5,
            scale: 1,
            translateX: 0,
            translateY: 0
          },
          imageDataUrl: 'data:image/png;base64,BBB'
        }
      },
      playlist: [
        {
          id: 'video-1',
          kind: 'video',
          name: 'Legacy video',
          source: 'https://example.com/video.mp4',
          startAtMs: 100,
          endAtMs: 1500,
          muted: false
        }
      ],
      targetScreenId: 'm2',
      currentIndex: 0,
      autoplay: true,
      intervalSeconds: 3
    };

    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(legacy));

    const loaded = loadPersistedSession();

    expect(loaded.ui.showOnlyProjectable).toBe(false);
    expect(loaded.monitors.m2.imageDataUrl).toBe('data:image/png;base64,BBB');
    expect(loaded.playback.targetMonitorIds).toEqual(['m2']);
    expect(loaded.playback.autoplay).toBe(true);
    expect(loaded.playlist[0]?.kind).toBe('video');
    expect(loaded.layouts).toEqual([]);
  });

  it('migra playback legacy de destino unico a targetMonitorIds', () => {
    const persisted = {
      version: SESSION_SCHEMA_VERSION,
      ui: {
        showOnlyProjectable: true,
        panelPreferences: {}
      },
      monitors: {},
      playlist: [
        {
          id: 'img-1',
          kind: 'image',
          name: 'Imagen legacy',
          source: 'data:image/png;base64,AAA',
          durationMs: 3000
        }
      ],
      playback: {
        targetMonitorId: 'm9',
        currentIndex: 0,
        autoplay: false,
        intervalSeconds: 5
      },
      layouts: []
    };

    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(persisted));

    const loaded = loadPersistedSession();

    expect(loaded.playback.targetMonitorIds).toEqual(['m9']);
  });

  it('clamp autoplay e indice cuando playlist esta vacia', () => {
    const persisted = {
      version: SESSION_SCHEMA_VERSION,
      ui: {
        showOnlyProjectable: true,
        panelPreferences: {}
      },
      monitors: {},
      playlist: [],
      playback: {
        targetMonitorIds: ['m3'],
        currentIndex: 20,
        autoplay: true,
        intervalSeconds: 10
      },
      layouts: []
    };

    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(persisted));

    const loaded = loadPersistedSession();

    expect(loaded.playback.currentIndex).toBe(0);
    expect(loaded.playback.autoplay).toBe(false);
  });

  it('sanitiza antes de guardar con el saver debounce', () => {
    const saver = createDebouncedSessionSaver(0);

    saver.schedule({
      version: SESSION_SCHEMA_VERSION,
      ui: {
        showOnlyProjectable: true,
        panelPreferences: {
          main: true
        }
      },
      monitors: {},
      playlist: [],
      playback: {
        targetMonitorIds: ['m1'],
        currentIndex: 50,
        autoplay: true,
        intervalSeconds: 0
      },
      layouts: [
        {
          id: 'layout-invalid',
          name: 'Layout invalido',
          createdAt: 'invalid-date',
          updatedAt: 'invalid-date',
          snapshot: {
            monitors: {},
            playback: {
              targetMonitorIds: ['m1'],
              currentIndex: 2,
              autoplay: true,
              intervalSeconds: 0
            }
          }
        }
      ]
    } as PersistedSessionV1);
    saver.flush();

    const stored = readStoredSession();
    expect(stored.playback.currentIndex).toBe(0);
    expect(stored.playback.autoplay).toBe(false);
    expect(stored.playback.intervalSeconds).toBe(1);
    expect(stored.layouts[0]?.createdAt).toBe('1970-01-01T00:00:00.000Z');
    expect(stored.layouts[0]?.snapshot.playback.currentIndex).toBe(2);
    expect(stored.layouts[0]?.snapshot.playback.intervalSeconds).toBe(1);
  });

  it('descarta layouts invalidos y duplicados por id', () => {
    const persisted = {
      version: SESSION_SCHEMA_VERSION,
      ui: {
        showOnlyProjectable: true,
        panelPreferences: {}
      },
      monitors: {},
      playlist: [],
      playback: {
        targetMonitorIds: [],
        currentIndex: 0,
        autoplay: false,
        intervalSeconds: 5
      },
      layouts: [
        {
          id: 'layout-a',
          name: 'Layout A',
          createdAt: '2026-03-30T12:00:00.000Z',
          updatedAt: '2026-03-30T12:05:00.000Z',
          snapshot: {
            monitors: {},
            playback: {
              targetMonitorIds: [],
              currentIndex: 0,
              autoplay: false,
              intervalSeconds: 5
            }
          }
        },
        {
          id: 'layout-a',
          name: 'Layout A duplicado',
          createdAt: '2026-03-30T12:10:00.000Z',
          updatedAt: '2026-03-30T12:15:00.000Z',
          snapshot: {
            monitors: {},
            playback: {
              targetMonitorIds: [],
              currentIndex: 4,
              autoplay: true,
              intervalSeconds: 5
            }
          }
        },
        {
          id: '',
          name: 'Sin id',
          snapshot: {
            monitors: {},
            playback: {
              targetMonitorIds: [],
              currentIndex: 1,
              autoplay: false,
              intervalSeconds: 5
            }
          }
        }
      ]
    };

    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(persisted));

    const loaded = loadPersistedSession();

    expect(loaded.layouts).toHaveLength(1);
    expect(loaded.layouts[0]?.id).toBe('layout-a');
    expect(loaded.layouts[0]?.name).toBe('Layout A');
  });
});
