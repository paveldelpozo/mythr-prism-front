import { describe, expect, it } from 'vitest';
import { isMultimediaItem } from './playlist';

describe('types/playlist guards', () => {
  it('acepta items validos de imagen y video', () => {
    const image = {
      id: 'img-1',
      kind: 'image',
      name: 'Imagen',
      source: 'data:image/png;base64,AAA',
      durationMs: 1200,
      startAtMs: 0,
      endAtMs: null,
      transition: {
        type: 'cut',
        durationMs: 450
      }
    };

    const video = {
      id: 'vid-1',
      kind: 'video',
      name: 'Video',
      source: 'https://example.com/video.mp4',
      durationMs: 5000,
      startAtMs: 0,
      endAtMs: 6000,
      transition: {
        type: 'fade',
        durationMs: 600
      },
      muted: false
    };

    const externalUrl = {
      id: 'url-1',
      kind: 'external-url',
      name: 'Web oficial',
      source: 'https://example.com/page',
      durationMs: 5000,
      startAtMs: 0,
      endAtMs: null,
      transition: {
        type: 'wipe',
        durationMs: 700
      }
    };

    expect(isMultimediaItem(image)).toBe(true);
    expect(isMultimediaItem(video)).toBe(true);
    expect(isMultimediaItem(externalUrl)).toBe(true);
  });

  it('rechaza shape invalido o datos inconsistentes', () => {
    expect(
      isMultimediaItem({
        id: '',
        kind: 'image',
        name: 'Sin id',
        source: 'x',
        durationMs: 100,
        startAtMs: 0,
        endAtMs: null,
        transition: {
          type: 'cut',
          durationMs: 450
        }
      })
    ).toBe(false);

    expect(
      isMultimediaItem({
        id: 'vid-2',
        kind: 'video',
        name: 'Rango invalido',
        source: 'x',
        durationMs: 2000,
        startAtMs: 5000,
        endAtMs: 3000,
        transition: {
          type: 'cut',
          durationMs: 450
        },
        muted: true
      })
    ).toBe(false);

    expect(
      isMultimediaItem({
        id: 'item-1',
        kind: 'audio',
        name: 'No soportado',
        source: 'x'
      })
    ).toBe(false);
  });
});
