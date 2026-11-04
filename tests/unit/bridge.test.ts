import { afterEach, describe, expect, it, vi } from 'vitest';
import { RpcInbox } from '../../packages/bridge/src/rpc';
import { WorkerClock } from '../../packages/bridge/src/clock';
import { DROUGHT_END_TICK, MATA_SPEED_TICKS } from '@mata/sim';

afterEach(() => vi.useRealTimers());

describe('worker recovery', () => {
  it('rejects initialization and requests on failure, then accepts a fresh request', async () => {
    const inbox = new RpcInbox<{ value: number }>();
    const init = inbox.waitInit(() => {});
    let id = 0;
    const pending = inbox.request(
      (next) => {
        id = next;
      },
      (reply) => reply.value,
    );
    const initCheck = expect(init).rejects.toThrow('worker lost');
    const requestCheck = expect(pending).rejects.toThrow('worker lost');
    inbox.rejectAll(new Error('worker lost'));
    await Promise.all([initCheck, requestCheck]);
    expect(inbox.settle(id, { value: 1 })).toBe(false);
    const recovered = inbox.request(
      (next) => {
        id = next;
      },
      (reply) => reply.value,
    );
    inbox.settle(id, { value: 2 });
    await expect(recovered).resolves.toBe(2);
  });

  it('bounds missing replies and ignores late replies', async () => {
    vi.useFakeTimers();
    const inbox = new RpcInbox<{ value: number }>(100);
    let id = 0;
    const init = expect(inbox.waitInit(() => {})).rejects.toThrow('timed out');
    const request = expect(
      inbox.request(
        (next) => {
          id = next;
        },
        (m) => m.value,
      ),
    ).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(100);
    await Promise.all([init, request]);
    expect(inbox.settle(id, { value: 42 })).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('settles synchronous send failures and malformed replies without leaking waiters', async () => {
    vi.useFakeTimers();
    const inbox = new RpcInbox<{ value?: number }>();
    await expect(
      inbox.waitInit(() => {
        throw new Error('send failed');
      }),
    ).rejects.toThrow('send failed');
    await expect(
      inbox.request(
        () => {
          throw new Error('send failed');
        },
        (m) => m.value,
      ),
    ).rejects.toThrow('send failed');
    let id = 0;
    const pending = inbox.request(
      (next) => {
        id = next;
      },
      (m) => m.value,
    );
    const rejected = expect(pending).rejects.toThrow('Unexpected worker reply');
    inbox.settle(id, {});
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Mata wall-clock pacing', () => {
  it('keeps planning paused and runs 44 days in 352 seconds at normal speed', () => {
    let now = 0;
    const clock = new WorkerClock(MATA_SPEED_TICKS, 40, () => now);
    clock.setSpeed(0);
    now = 60_000;
    expect(clock.takeTicks()).toBe(0);
    clock.setSpeed(1);
    let days = 0;
    for (let ms = 50; ms <= 352_000; ms += 50) {
      now += 50;
      days += clock.takeTicks();
      if (ms === 4_000) expect(days).toBe(0);
      if (ms === 8_000) expect(days).toBe(1);
    }
    expect(days).toBe(DROUGHT_END_TICK);
  });

  it('uses actual 1x, 2x and 3x rates', () => {
    for (const speed of [1, 2, 3]) {
      let now = 0;
      const clock = new WorkerClock(MATA_SPEED_TICKS, 40, () => now);
      clock.setSpeed(speed);
      now = 8_000;
      expect(clock.takeTicks()).toBe(speed);
    }
  });
});
