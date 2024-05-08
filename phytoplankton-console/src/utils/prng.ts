/*
  Pseudo random number generator with seed. It's not suitable for crypto stuff,
  but simple and good enough to generate pseudo-random data

  Source: https://stackoverflow.com/a/47593316/916330
 */

export function makeRandomNumberGenerator(seed = 0.1) {
  let state = seed;
  return () => {
    let t = (state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    state = (state + 0.1) % Number.MAX_SAFE_INTEGER;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
