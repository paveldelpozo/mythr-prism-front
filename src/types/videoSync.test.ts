import { describe, expect, it } from 'vitest';
import {
  buildVideoSyncPlan,
  DEFAULT_VIDEO_SYNC_STRATEGY,
  resolveExpectedVideoTimeMs,
  sanitizeVideoSyncStrategy,
  shouldResyncVideoDrift
} from './videoSync';

describe('types/videoSync', () => {
  it('define host preferido y clientes listos', () => {
    const plan = buildVideoSyncPlan({
      openMonitorIds: ['m1', 'm2', 'm3'],
      preferredHostMonitorId: 'm2'
    });

    expect(plan.hostMonitorId).toBe('m2');
    expect(plan.clientMonitorIds).toEqual(['m1', 'm3']);
    expect(plan.canSynchronize).toBe(true);
    expect(plan.reason).toBe('ok');
  });

  it('usa fallback al primer monitor abierto si host no existe', () => {
    const plan = buildVideoSyncPlan({
      openMonitorIds: ['m7', 'm8'],
      preferredHostMonitorId: 'missing'
    });

    expect(plan.hostMonitorId).toBe('m7');
    expect(plan.clientMonitorIds).toEqual(['m8']);
    expect(plan.reason).toBe('ok');
  });

  it('reporta razon cuando solo hay un monitor abierto', () => {
    const plan = buildVideoSyncPlan({
      openMonitorIds: ['solo'],
      preferredHostMonitorId: 'solo'
    });

    expect(plan.hostMonitorId).toBe('solo');
    expect(plan.clientMonitorIds).toEqual([]);
    expect(plan.canSynchronize).toBe(false);
    expect(plan.reason).toBe('single-open-monitor');
  });

  it('sanea valores de estrategia y aplica clamps', () => {
    const strategy = sanitizeVideoSyncStrategy({
      commandLeadMs: -10,
      driftToleranceMs: 100000,
      resyncIntervalMs: Number.NaN
    });

    expect(strategy.commandLeadMs).toBeGreaterThanOrEqual(100);
    expect(strategy.driftToleranceMs).toBeLessThanOrEqual(1500);
    expect(strategy.resyncIntervalMs).toBeGreaterThanOrEqual(500);
  });

  it('mantiene defaults cuando no recibe overrides', () => {
    const strategy = sanitizeVideoSyncStrategy(undefined);
    expect(strategy).toEqual(DEFAULT_VIDEO_SYNC_STRATEGY);
  });

  it('calcula tiempo esperado desde anchor wallclock+media', () => {
    const expected = resolveExpectedVideoTimeMs(
      {
        anchorWallClockMs: 1000,
        anchorMediaTimeMs: 2500
      },
      1800
    );

    expect(expected).toBe(3300);
  });

  it('detecta drift fuera de tolerancia para disparar resync', () => {
    expect(shouldResyncVideoDrift(5000, 4920, 100)).toBe(false);
    expect(shouldResyncVideoDrift(5000, 4700, 100)).toBe(true);
  });
});
