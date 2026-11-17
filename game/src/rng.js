// Neon Bay — deterministic seeded random numbers. Every random choice in
// the city, traffic and missions comes from one of these, so a seed rebuilds
// the same Neon Bay (and the same screenshots) every time.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const rand = mulberry32(seed);
  return {
    rand,
    range(min, max) {
      return min + rand() * (max - min);
    },
    int(min, max) {
      return Math.floor(min + rand() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(rand() * list.length)];
    },
    chance(p) {
      return rand() < p;
    },
    shuffle(list) {
      const copy = list.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}
