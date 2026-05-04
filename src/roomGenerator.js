(function () {
  const COLS = 30;
  const ROWS = 17;
  const TILE = 32;

  function createEmptyTiles() {
    const tiles = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
          row.push(1);
        } else {
          row.push(0);
        }
      }
      tiles.push(row);
    }
    return tiles;
  }

  function addPlatform(tiles, c1, c2, r) {
    if (r < 1 || r >= ROWS - 1) return;
    const lo = Math.max(1, c1);
    const hi = Math.min(COLS - 2, c2);
    for (let c = lo; c <= hi; c++) {
      tiles[r][c] = 1;
    }
  }

  function surfaceTiles(tiles) {
    const list = [];
    for (let r = 1; r < ROWS; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        if (tiles[r][c] === 1 && tiles[r - 1][c] === 0) {
          list.push({ c, r });
        }
      }
    }
    return list;
  }

  function findPlatformRuns(tiles, minWidth) {
    const runs = [];
    for (let r = 1; r < ROWS; r++) {
      let runStart = -1;
      for (let c = 0; c < COLS; c++) {
        const standable =
          c > 0 && c < COLS - 1 &&
          tiles[r][c] === 1 &&
          tiles[r - 1][c] === 0;
        if (standable) {
          if (runStart === -1) runStart = c;
        } else {
          if (runStart !== -1) {
            const w = c - runStart;
            if (w >= minWidth) runs.push({ r, c1: runStart, c2: c - 1 });
            runStart = -1;
          }
        }
      }
      if (runStart !== -1) {
        const w = COLS - runStart;
        if (w >= minWidth) runs.push({ r, c1: runStart, c2: COLS - 1 });
      }
    }
    return runs;
  }

  // ----- Reachability BFS -----
  // Strict reach assuming basic walk + jump only — no wall jumps modeled.
  // This guarantees every level is solvable with plain platforming;
  // wall jumps stay as an optional player skill, never a hard requirement.
  // Player jump: ~4 tiles up at peak with ~5 tiles horizontal at the apex.
  function canTraverse(a, b) {
    const dc = Math.abs(b.c - a.c);
    const dr = b.r - a.r; // positive: b lower than a (drop), negative: jump up
    if (dr >= 0) {
      return dc <= 6 + Math.min(dr, 4);
    }
    const upTiles = -dr;
    if (upTiles > 4) return false;
    const maxHoriz = [6, 6, 5, 4, 3][upTiles];
    return dc <= maxHoriz;
  }

  function reachableSurfaces(tiles, start) {
    const stands = surfaceTiles(tiles);
    const reachable = new Set([`${start.c},${start.r}`]);
    const queue = [start];
    while (queue.length > 0) {
      const cur = queue.shift();
      for (const next of stands) {
        const key = `${next.c},${next.r}`;
        if (reachable.has(key)) continue;
        if (canTraverse(cur, next)) {
          reachable.add(key);
          queue.push(next);
        }
      }
    }
    return reachable;
  }

  // Remove platforms that crowd each other vertically. Two runs are "crowded"
  // when they are within 3 rows and overlap (or nearly overlap) horizontally.
  // Earlier-encountered runs (higher up, then leftmost) are preserved.
  function thinClusteredPlatforms(tiles) {
    const runs = findPlatformRuns(tiles, 1)
      .filter(r => r.r >= 1 && r.r < ROWS - 1);
    runs.sort((a, b) => a.r - b.r || a.c1 - b.c1);

    const kept = [];
    for (const run of runs) {
      let crowded = false;
      for (const k of kept) {
        const vDist = Math.abs(run.r - k.r);
        const horizOverlap = !(run.c2 < k.c1 - 2 || run.c1 > k.c2 + 2);
        if (vDist < 3 && horizOverlap) {
          crowded = true;
          break;
        }
      }
      if (crowded) {
        for (let c = run.c1; c <= run.c2; c++) tiles[run.r][c] = 0;
      } else {
        kept.push(run);
      }
    }
  }

  function pruneUnreachablePlatforms(tiles, reachable) {
    for (let r = 1; r < ROWS - 1; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        if (tiles[r][c] !== 1) continue;
        if (tiles[r - 1][c] === 0 && !reachable.has(`${c},${r}`)) {
          tiles[r][c] = 0;
        }
      }
    }
  }

  // Returns true if any solid (non-floor) tile sits within `pad` cells of
  // any tile in the proposed platform run. Used to keep platforms breathing.
  function tooCloseToExistingPlatform(tiles, c1, c2, r, pad) {
    const r0 = Math.max(1, r - pad);
    const r1 = Math.min(ROWS - 2, r + pad);
    const cc0 = Math.max(1, c1 - pad);
    const cc1 = Math.min(COLS - 2, c2 + pad);
    for (let rr = r0; rr <= r1; rr++) {
      for (let cc = cc0; cc <= cc1; cc++) {
        if (tiles[rr][cc] === 1) return true;
      }
    }
    return false;
  }

  // Add platforms anchored to existing reachable surfaces until we hit a
  // minimum platform-tile count. Each new platform is placed within jump
  // distance of an existing reachable tile so it's automatically reachable,
  // but with a spacing pad so platforms don't crowd each other.
  function fillReachablePlatforms(rng, tiles, targetCount) {
    const startStand = { c: 1, r: ROWS - 1 };
    let attempts = 0;
    while (attempts < 60) {
      attempts++;
      const surfaces = surfaceTiles(tiles);
      const interior = surfaces.filter(s => s.r < ROWS - 1).length;
      if (interior >= targetCount) break;

      const reachable = reachableSurfaces(tiles, startStand);
      const anchors = surfaces.filter(s => reachable.has(`${s.c},${s.r}`));
      if (anchors.length === 0) break;

      const anchor = rng.pick(anchors);
      const dr = -rng.int(2, 4);                // 2-4 rows above (strict reach max)
      const dc = rng.int(-3, 3);                // small horizontal offset
      const newR = anchor.r + dr;
      const newW = rng.int(2, 3);
      const newC = anchor.c + dc - Math.floor(newW / 2);

      if (newR < 3 || newR >= ROWS - 2) continue;
      if (newC < 2 || newC + newW - 1 >= COLS - 2) continue;

      let blocked = false;
      for (let c = newC; c < newC + newW; c++) {
        if (tiles[newR][c] === 1) { blocked = true; break; }
        if (tiles[newR - 1][c] === 1) { blocked = true; break; }
      }
      if (blocked) continue;

      if (tooCloseToExistingPlatform(tiles, newC, newC + newW - 1, newR, 2)) continue;

      // Validate: at least one tile of the new platform must be strictly
      // reachable from the anchor we anchored to.
      let strictlyReachable = false;
      for (let c = newC; c <= newC + newW - 1 && !strictlyReachable; c++) {
        if (canTraverse(anchor, { c, r: newR })) strictlyReachable = true;
      }
      if (!strictlyReachable) continue;

      addPlatform(tiles, newC, newC + newW - 1, newR);
    }
  }

  // Ensure at least one reachable platform exists at or above `maxRow`.
  // Used to guarantee a high spot for the key.
  function ensureHighPlatform(rng, tiles, maxRow) {
    const startStand = { c: 1, r: ROWS - 1 };
    let reachable = reachableSurfaces(tiles, startStand);
    let surfaces = surfaceTiles(tiles);
    let high = surfaces.filter(s =>
      s.r <= maxRow && s.r >= 1 &&
      s.c >= 4 && s.c <= COLS - 3 &&
      reachable.has(`${s.c},${s.r}`)
    );
    if (high.length > 0) return;

    // Try to anchor a high platform from any existing reachable surface.
    for (let attempt = 0; attempt < 30; attempt++) {
      const anchors = surfaces.filter(s => reachable.has(`${s.c},${s.r}`));
      if (anchors.length === 0) break;
      const anchor = rng.pick(anchors);
      const newR = Math.min(anchor.r - rng.int(3, 5), maxRow);
      if (newR < 2) continue;
      const newW = rng.int(2, 3);
      const newC = Math.max(2, Math.min(COLS - 3 - newW,
        anchor.c + rng.int(-3, 3) - Math.floor(newW / 2)));

      let blocked = false;
      for (let c = newC; c < newC + newW; c++) {
        if (tiles[newR][c] === 1) { blocked = true; break; }
        if (tiles[newR - 1][c] === 1) { blocked = true; break; }
      }
      if (blocked) continue;
      if (tooCloseToExistingPlatform(tiles, newC, newC + newW - 1, newR, 2)) continue;

      addPlatform(tiles, newC, newC + newW - 1, newR);
      reachable = reachableSurfaces(tiles, startStand);
      surfaces = surfaceTiles(tiles);
      high = surfaces.filter(s =>
        s.r <= maxRow && reachable.has(`${s.c},${s.r}`)
      );
      if (high.length > 0) return;
    }
  }

  // ----- Layout templates -----

  function templateOpen(rng, tiles, roomNum) {
    const numPlatforms = 3 + rng.int(0, 2) + Math.min(2, Math.floor(roomNum / 80));
    for (let i = 0; i < numPlatforms; i++) {
      const r = rng.int(6, 14);
      const w = rng.int(2, 5);
      const c = rng.int(2, COLS - 3 - w);
      addPlatform(tiles, c, c + w - 1, r);
    }
  }

  function templateStairs(rng, tiles, roomNum) {
    const ascending = rng.chance(0.5);
    const steps = rng.int(4, 6);
    const stepW = rng.int(2, 3);
    let r = ascending ? 14 : 6;
    let c = ascending ? 3 : 22;
    for (let i = 0; i < steps; i++) {
      if (r < 4 || r > 15) break;
      if (c < 2 || c + stepW - 1 > COLS - 3) break;
      addPlatform(tiles, c, c + stepW - 1, r);
      r += ascending ? -2 : 2;
      c += ascending ? stepW + rng.int(1, 2) : -(stepW + rng.int(1, 2));
    }
    // Add a few extra scattered platforms for variety.
    const extras = rng.int(2, 3);
    for (let i = 0; i < extras; i++) {
      addPlatform(tiles, rng.int(2, COLS - 5), rng.int(2, COLS - 5) + rng.int(1, 3), rng.int(5, 13));
    }
  }

  function templatePit(rng, tiles, roomNum) {
    if (roomNum < 30) {
      templateOpen(rng, tiles, roomNum);
      return;
    }
    const pitW = rng.int(3, 5);
    const pitC1 = rng.int(8, 18);
    for (let c = pitC1; c < pitC1 + pitW; c++) {
      if (c > 0 && c < COLS - 1) tiles[ROWS - 1][c] = 0;
    }
    const bridgeR = rng.int(12, 14);
    addPlatform(tiles, pitC1, pitC1 + Math.min(pitW - 1, 2), bridgeR);
    if (rng.chance(0.6)) {
      addPlatform(tiles, pitC1 + 1, pitC1 + Math.min(pitW, 3), bridgeR - rng.int(2, 3));
    }
    // Surrounding decoration platforms
    const extras = rng.int(2, 4);
    for (let i = 0; i < extras; i++) {
      addPlatform(tiles, rng.int(2, COLS - 5), rng.int(2, COLS - 5) + rng.int(1, 3), rng.int(6, 13));
    }
  }

  function templateTower(rng, tiles, roomNum) {
    const baseC = rng.int(18, 23);
    const platW = rng.int(3, 4);
    let r = 14;
    while (r > 4) {
      addPlatform(tiles, baseC, baseC + platW - 1, r);
      r -= rng.int(2, 3);
    }
    // Approach platforms so the tower is reachable from the left.
    const approachCount = rng.int(2, 3);
    let ac = 4;
    let ar = rng.int(11, 13);
    for (let i = 0; i < approachCount; i++) {
      addPlatform(tiles, ac, ac + rng.int(2, 3), ar);
      ac += rng.int(3, 5);
      ar -= rng.int(0, 2);
      if (ac > 16 || ar < 5) break;
    }
  }

  function templateSwitchback(rng, tiles, roomNum) {
    const heights = [13, 10, 7, 4];
    for (let i = 0; i < heights.length; i++) {
      const onLeft = i % 2 === 0;
      const c = onLeft ? rng.int(2, 5) : rng.int(20, 24);
      const w = rng.int(3, 5);
      addPlatform(tiles, c, c + w - 1, heights[i]);
    }
    // Mid-room stepping platform to make it more navigable.
    if (rng.chance(0.6)) {
      addPlatform(tiles, rng.int(11, 16), rng.int(11, 16) + rng.int(1, 2), rng.int(8, 11));
    }
  }

  function templateGarden(rng, tiles, roomNum) {
    // Lots of small platforms scattered around, like stepping stones.
    const numPlatforms = 5 + rng.int(0, 2);
    for (let i = 0; i < numPlatforms; i++) {
      const r = rng.int(4, 14);
      const w = rng.int(2, 3);
      const c = rng.int(2, COLS - 3 - w);
      addPlatform(tiles, c, c + w - 1, r);
    }
  }

  const TEMPLATES = [
    templateOpen,
    templateStairs,
    templatePit,
    templateTower,
    templateSwitchback,
    templateGarden,
  ];

  // ----- Moving platforms -----
  // Place 1-2 horizontal moving platforms in valid open horizontal corridors.
  function placeMovingPlatforms(rng, tiles, reachable) {
    const platforms = [];
    const desired = 1 + (rng.chance(0.5) ? 1 : 0);

    for (let attempt = 0; attempt < 12 && platforms.length < desired; attempt++) {
      const r = rng.int(5, 13);
      const widthTiles = rng.int(2, 3);
      const startC = rng.int(3, COLS - 8);
      const rangeTiles = rng.int(3, 5);

      // Need open space at row r across [startC, startC + widthTiles + rangeTiles - 1]
      let blocked = false;
      for (let c = startC - 1; c <= startC + widthTiles + rangeTiles; c++) {
        if (c < 1 || c >= COLS - 1) { blocked = true; break; }
        if (tiles[r][c] === 1 || tiles[r - 1] && tiles[r - 1][c] === 1) {
          blocked = true; break;
        }
      }
      if (blocked) continue;

      // Don't overlap an existing moving platform's row span.
      const overlap = platforms.some(p => Math.abs(p.row - r) <= 1);
      if (overlap) continue;

      const cx = (startC + widthTiles / 2) * TILE + (rangeTiles * TILE) / 2;
      const cy = r * TILE - TILE / 2 - 2;
      platforms.push({
        row: r,
        cx,
        cy,
        width: widthTiles * TILE,
        height: 12,
        range: (rangeTiles * TILE) / 2,
        speed: 50 + rng.int(0, 25),
        axis: 'h',
      });
    }
    return platforms;
  }

  function generateRoom(roomNumber, sessionSeed, opts) {
    opts = opts || {};
    const seed = sessionSeed || 0;
    const extra = opts.bonus ? 0xBE57BABE : 0;
    const mixed = ((seed ^ (roomNumber * 1013904223) ^ extra) + 1) >>> 0;
    const rng = window.makeRng(mixed);

    // Hard-mode level 60 is a special empty hall: just walls + giant door.
    // No platforms, no enemies, no key, no exit door, no chest, no machine.
    if (opts.mode === 'hard' && roomNumber === 60 && !opts.bonus) {
      const tiles = createEmptyTiles();
      // Open up the right wall opening too — but we don't actually use the
      // normal exit in this room; the giant door is handled separately.
      return {
        tiles,
        playerSpawn: { x: 1.5 * TILE, y: 15 * TILE - 4 },
        keyPos: { x: -100, y: -100 },     // off-screen, never rendered
        doorPos: { x: -100, y: -100 },    // sentinel — scene won't use this
        bonusDoorPos: null,
        enemySpawns: [],
        enemySpeed: 80,
        movingPlatforms: [],
        darkRoom: false,
        machinePos: null,
        lasers: [],
        giantDoor: {
          // Centered, fills most of the playfield height/width.
          x: COLS * TILE / 2,
          y: ROWS * TILE / 2 + 8,
          width: 18 * TILE,
          height: 13 * TILE,
        },
      };
    }

    const tiles = createEmptyTiles();
    const template = rng.pick(TEMPLATES);
    template(rng, tiles, roomNumber);

    // Door area at right wall — clear two tiles so player can walk into the door.
    tiles[14][COLS - 2] = 0;
    tiles[15][COLS - 2] = 0;

    // Thin out crowded clusters from the template before anything else.
    thinClusteredPlatforms(tiles);

    // Reachability prune: anything not reachable from spawn-on-floor gets removed.
    const startStand = { c: 1, r: ROWS - 1 };
    let reachable = reachableSurfaces(tiles, startStand);
    pruneUnreachablePlatforms(tiles, reachable);

    // Fill sparse rooms with extra reachable platforms so every room feels lively.
    const targetPlatformTiles = 7 + Math.min(4, Math.floor(roomNumber / 12));
    fillReachablePlatforms(rng, tiles, targetPlatformTiles);

    // Safety re-prune: in case any earlier step left an unreachable surface.
    reachable = reachableSurfaces(tiles, startStand);
    pruneUnreachablePlatforms(tiles, reachable);

    reachable = reachableSurfaces(tiles, startStand);
    let nonFloorSurfaces = surfaceTiles(tiles).filter(s => s.r < ROWS - 1);
    if (nonFloorSurfaces.length === 0) {
      // Place a guaranteed-reachable platform 3 rows above the spawn floor.
      addPlatform(tiles, 3, 6, 13);
      reachable = reachableSurfaces(tiles, startStand);
      nonFloorSurfaces = surfaceTiles(tiles).filter(s => s.r < ROWS - 1);
    }

    const playerSpawn = { x: 1.5 * TILE, y: 15 * TILE - 4 };

    const doorPos = {
      x: (COLS - 2) * TILE + TILE / 2,
      y: 14 * TILE + TILE,
    };

    // Key on any reachable platform — picked uniformly so it isn't tucked
    // away in a hard-to-reach spot.
    const keyCandidates = nonFloorSurfaces.filter(s =>
      s.c >= 4 && s.c <= COLS - 3 && reachable.has(`${s.c},${s.r}`)
    );
    let keyTile;
    if (keyCandidates.length > 0) {
      keyTile = rng.pick(keyCandidates);
    } else {
      // No reachable interior platform passed the column filter — drop one
      // 3 rows above the spawn floor so the key always lands on a tile we
      // can prove is reachable from spawn.
      addPlatform(tiles, 4, 7, 13);
      keyTile = { c: 5, r: 13 };
    }
    const keyPos = { x: keyTile.c * TILE + TILE / 2, y: keyTile.r * TILE - 8 };

    // Enemy spawns — runs of width >= 3, away from spawn and key, only on reachable surfaces.
    const runs = findPlatformRuns(tiles, 3);
    const validRuns = runs.filter(run => {
      if (run.r === ROWS - 1 && run.c1 < 5 && run.c2 < 6) return false;
      // Skip runs whose tiles are entirely unreachable.
      let anyReachable = false;
      for (let cc = run.c1; cc <= run.c2 && !anyReachable; cc++) {
        if (reachable.has(`${cc},${run.r}`)) anyReachable = true;
      }
      return anyReachable;
    });

    let enemyCount;
    if (opts.forceEnemyCount != null) {
      enemyCount = opts.forceEnemyCount;
    } else if (roomNumber % 50 === 0) {
      enemyCount = 15;
    } else if (roomNumber % 10 === 0) {
      enemyCount = 5;
    } else {
      enemyCount = Math.min(6, 1 + Math.floor(roomNumber / 8));
    }
    // Hard mode doubles the enemy count (forceEnemyCount overrides this).
    if (opts.mode === 'hard' && opts.forceEnemyCount == null) {
      enemyCount *= 2;
    }

    const enemySpawns = [];
    for (let i = 0; i < enemyCount; i++) {
      if (validRuns.length === 0) break;
      let placed = false;
      for (let attempt = 0; attempt < 10 && !placed; attempt++) {
        const run = rng.pick(validRuns);
        const c1 = Math.max(run.c1, 5);
        const c2 = Math.max(c1, run.c2);
        const c = rng.int(c1, c2);
        if (!reachable.has(`${c},${run.r}`)) continue;
        const enemyX = c * TILE + TILE / 2;
        const enemyY = run.r * TILE - 16;
        if (Math.abs(enemyX - keyPos.x) < TILE && Math.abs(enemyY - keyPos.y) < TILE) {
          continue;
        }
        enemySpawns.push({
          x: enemyX, y: enemyY,
          runC1: run.c1, runC2: run.c2, runR: run.r,
        });
        placed = true;
      }
    }

    const enemySpeed = 80 + Math.min(roomNumber, 50) * 1.6;

    const movingPlatforms = placeMovingPlatforms(rng, tiles, reachable);

    // On every 10th level, place a bonus chest door on a high reachable
    // platform that's away from the regular exit and the key.
    let bonusDoorPos = null;
    if (roomNumber % 10 === 0) {
      const reachableNonFloor = nonFloorSurfaces.filter(s =>
        s.c >= 3 && s.c <= COLS - 4 && reachable.has(`${s.c},${s.r}`)
      );
      let candidates = reachableNonFloor.filter(s => s.r <= 7);
      if (candidates.length === 0) candidates = reachableNonFloor.filter(s => s.r <= 10);
      if (candidates.length === 0) candidates = reachableNonFloor;
      candidates = candidates.filter(s =>
        Math.abs(s.c * TILE + TILE / 2 - keyPos.x) > TILE * 2 ||
        Math.abs(s.r * TILE - keyPos.y) > TILE * 2
      );
      if (candidates.length > 0) {
        candidates.sort((a, b) => a.r - b.r);
        const pool = candidates.slice(0, Math.min(5, candidates.length));
        const chosen = rng.pick(pool);
        bonusDoorPos = {
          x: chosen.c * TILE + TILE / 2,
          y: chosen.r * TILE - 4,
        };
      }
    }

    const darkRoom = rng.chance(opts.mode === 'hard' ? 0.10 : 0.05);

    // Challenge machine on every 10th regular level. Sits on the floor in
    // open space, away from spawn / door / bonus chest door.
    let machinePos = null;
    if (roomNumber % 10 === 0 && !opts.bonus) {
      const candidates = [];
      for (let c = 6; c < COLS - 4; c++) {
        if (tiles[ROWS - 1][c] === 1 &&
            tiles[ROWS - 2][c] === 0 &&
            reachable.has(`${c},${ROWS - 1}`)) {
          if (Math.abs(c * TILE - keyPos.x) < TILE * 2) continue;
          if (bonusDoorPos && Math.abs(c * TILE - bonusDoorPos.x) < TILE * 2) continue;
          candidates.push(c);
        }
      }
      if (candidates.length > 0) {
        const c = rng.pick(candidates);
        machinePos = { x: c * TILE + TILE / 2, y: (ROWS - 1) * TILE - 18 };
      }
    }

    // Wall lasers — only in hard mode, only on /5 regular levels.
    const lasers = [];
    if (opts.mode === 'hard' && roomNumber % 5 === 0 && !opts.bonus) {
      const count = rng.int(1, 2);
      const usedRows = new Set();
      for (let i = 0; i < count; i++) {
        let attempts = 0;
        let row;
        do {
          row = rng.int(3, 13);
          attempts++;
        } while (usedRows.has(row) && attempts < 6);
        usedRows.add(row);
        const side = rng.chance(0.5) ? 'left' : 'right';
        const x = side === 'left' ? TILE + 8 : (COLS - 1) * TILE - 8;
        const y = row * TILE + TILE / 2;
        lasers.push({ x, y, side });
      }
    }

    return {
      tiles,
      playerSpawn,
      keyPos,
      doorPos,
      bonusDoorPos,
      enemySpawns,
      enemySpeed,
      movingPlatforms,
      darkRoom,
      machinePos,
      lasers,
    };
  }

  window.RoomGenerator = {
    generateRoom,
    COLS,
    ROWS,
    TILE,
  };
})();
