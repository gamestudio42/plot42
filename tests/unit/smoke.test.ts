import { GAME_NAME } from '@city/simulation';
import { describe, expect, it } from 'vitest';

describe('workspace wiring', () => {
  it('resolves workspace packages from tests', () => {
    expect(GAME_NAME).toBe('City Builder');
  });
});
