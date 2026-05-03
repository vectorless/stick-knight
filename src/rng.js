// Mulberry32 — small, fast, deterministic 32-bit PRNG.
// Seeding by an integer roomNumber gives the same room layout every time.
(function () {
  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRng(seed) {
    const r = mulberry32(seed);
    return {
      next: r,
      // integer in [min, max] inclusive
      int(min, max) {
        return Math.floor(r() * (max - min + 1)) + min;
      },
      float(min, max) {
        return r() * (max - min) + min;
      },
      pick(arr) {
        return arr[Math.floor(r() * arr.length)];
      },
      chance(p) {
        return r() < p;
      },
    };
  }

  window.makeRng = makeRng;
})();
