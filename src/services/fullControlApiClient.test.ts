import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFullControlApiClient, FullControlApiError } from './fullControlApiClient';

describe('fullControlApiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls system status endpoint with API key header', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        service: 'mythr-prism-back',
        apiVersion: 'v1',
        status: 'ok',
        secureMode: false,
        timestamp: '2026-04-05T12:00:00.000Z'
      })
    }));

    vi.stubGlobal('fetch', fetchSpy);

    const client = createFullControlApiClient({
      baseUrl: 'http://localhost:3000',
      apiKey: 'test-key'
    });

    const response = await client.getSystemStatus();
    expect(response.apiVersion).toBe('v1');
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/system/status',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'test-key'
        })
      })
    );
  });

  it('throws typed API error when backend returns error envelope', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({
        code: 'unauthorized_api_key',
        message: 'Missing or invalid API key for full control API access.'
      })
    }));

    vi.stubGlobal('fetch', fetchSpy);

    const client = createFullControlApiClient({
      baseUrl: 'http://localhost:3000',
      apiKey: 'bad-key'
    });

    await expect(client.getSystemStatus()).rejects.toBeInstanceOf(FullControlApiError);
    await expect(client.getSystemStatus()).rejects.toMatchObject({
      code: 'unauthorized_api_key'
    });
  });
});
