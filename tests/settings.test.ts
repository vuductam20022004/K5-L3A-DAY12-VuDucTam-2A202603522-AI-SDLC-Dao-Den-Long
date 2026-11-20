import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from '../src/render/settings';
describe('persistent settings payload', () => {
  it.each([null, 'bad json', 'null', '{}'])('uses safe defaults for %s', (raw) => {
    expect(parseSettings(raw)).toEqual(DEFAULT_SETTINGS);
  });
  it('roundtrips preferences and clamps invalid ranges', () => {
    expect(parseSettings('{"volume":0.8,"sensitivity":0.006}')).toEqual({ volume: 0.8, sensitivity: 0.006 });
    expect(parseSettings('{"volume":4,"sensitivity":-1}')).toEqual({ volume: 1, sensitivity: 0.001 });
  });
});
