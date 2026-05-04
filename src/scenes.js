(function () {
  const NORMAL_TOTAL_ROOMS = 50;
  const HARD_TOTAL_ROOMS = 60;
  const totalRoomsFor = (mode) => (mode === 'hard' ? HARD_TOTAL_ROOMS : NORMAL_TOTAL_ROOMS);

  const ACHIEVEMENTS = [
    { id: 'room25',   name: 'Halfway-ish',     desc: 'Reach level 25' },
    { id: 'room50',   name: 'Stick Champion',  desc: 'Reach level 50' },
    { id: 'gold150',  name: 'Treasure Hunter', desc: 'Carry 150 gold at once' },
  ];

  const ACH_STORAGE_KEY = 'stick-knight-achievements';

  function loadAchievements() {
    try {
      const raw = localStorage.getItem(ACH_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveAchievements(state) {
    try {
      localStorage.setItem(ACH_STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* localStorage unavailable; lose progress this session */ }
  }

  function drawStoneBackground(scene, gfx, detailed) {
    const W = scene.scale.width;
    const H = scene.scale.height;
    const brickW = 64;
    const brickH = 32;
    const rng = scene.rng;
    for (let row = 0; (row * brickH) < H + brickH; row++) {
      const y = row * brickH;
      const offset = (row % 2) * (brickW / 2);
      for (let col = -1; col * brickW + offset < W + brickW; col++) {
        const x = col * brickW + offset;
        const grey = 70 + rng.int(-20, 25);
        const r = Math.max(0, Math.min(255, grey));
        const fill = (r << 16) | (r << 8) | r;
        gfx.fillStyle(fill, 1);
        gfx.fillRect(x, y, brickW - 2, brickH - 2);
        gfx.lineStyle(1, 0x1a1a1a, 1);
        gfx.strokeRect(x, y, brickW - 2, brickH - 2);
        if (detailed) {
          // Top-edge highlight strip — gives the brick a chiseled look.
          const hl = Math.min(255, r + 40);
          const hlColor = (hl << 16) | (hl << 8) | hl;
          gfx.fillStyle(hlColor, 1);
          gfx.fillRect(x + 3, y + 2, brickW - 14, 2);
          gfx.fillRect(x + 3, y + 2, 2, brickH - 12);
          // Random hairline crack inside the brick.
          if (rng.chance(0.35)) {
            const cx = x + rng.int(8, brickW - 12);
            const cy = y + rng.int(6, brickH - 10);
            const len = rng.int(8, 18);
            const slope = rng.float(-0.6, 0.6);
            gfx.lineStyle(1, 0x111111, 1);
            gfx.lineBetween(cx, cy, cx + len, cy + Math.round(len * slope));
          }
          // Occasional darker flecks (small dots).
          if (rng.chance(0.4)) {
            gfx.fillStyle(0x2a2a2a, 1);
            gfx.fillRect(
              x + rng.int(8, brickW - 10),
              y + rng.int(6, brickH - 8),
              2, 2
            );
          }
        }
      }
    }
  }

  // Small triangular stalactites hanging from just below the top wall.
  function drawStalactites(scene, gfx) {
    const W = scene.scale.width;
    const TILE = 32;
    const baseY = TILE; // top wall ends here
    const count = scene.rng.int(10, 16);
    for (let i = 0; i < count; i++) {
      const x = scene.rng.int(20, W - 20);
      const baseW = scene.rng.int(6, 14);
      const len = scene.rng.int(8, 22);
      const grey = 60 + scene.rng.int(-10, 15);
      const c = Math.max(0, Math.min(255, grey));
      const fill = (c << 16) | (c << 8) | c;
      gfx.fillStyle(fill, 1);
      gfx.fillTriangle(
        x - baseW / 2, baseY,
        x + baseW / 2, baseY,
        x, baseY + len
      );
      gfx.lineStyle(1, 0x1a1c20, 1);
      gfx.strokeTriangle(
        x - baseW / 2, baseY,
        x + baseW / 2, baseY,
        x, baseY + len
      );
      // Tiny highlight on the left edge for a touch of shape.
      const hl = Math.min(255, c + 30);
      const hlColor = (hl << 16) | (hl << 8) | hl;
      gfx.lineStyle(1, hlColor, 1);
      gfx.lineBetween(x - baseW / 2 + 1, baseY + 1, x - 1, baseY + len - 2);
    }
  }

  function hsvToHex(h, s, v) {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    let r = 0, g = 0, b = 0;
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
  }

  // ----- Title -----
  class TitleScene extends Phaser.Scene {
    constructor() {
      super('TitleScene');
    }
    create() {
      const w = this.scale.width;
      const h = this.scale.height;
      this.add.rectangle(w / 2, h / 2, w, h, 0x141821);

      this.add.text(w / 2, 100, 'STICK KNIGHT', {
        fontFamily: 'monospace',
        fontSize: '56px',
        color: '#f4d35e',
      }).setOrigin(0.5);

      this.add.text(w / 2, 160, '50 levels. one stick. one key per level.', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#cccccc',
      }).setOrigin(0.5);

      const controls = [
        'CONTROLS',
        '',
        '  Move        <-  ->   or   A  D',
        '  Jump        Space / W / Up  (hold for higher jump)',
        '  Wall jump   while sliding on a wall, press jump',
        '  Attack      Left Click / J / X   (5 hits to kill an enemy)',
        '  Shop        E       Achievements  Q       Interact  F',
        '',
        '  Find the key, kill enemies, exit through the door on the right.',
      ];
      this.add.text(w / 2, h / 2 - 10, controls.join('\n'), {
        fontFamily: 'monospace',
        fontSize: '17px',
        color: '#dddddd',
        align: 'center',
      }).setOrigin(0.5);

      let secretUnlocked = false;
      try { secretUnlocked = localStorage.getItem('stick-knight-secret') === '1'; }
      catch (e) {}

      this.add.text(w / 2, h - 175, 'CHOOSE A DIFFICULTY', {
        fontFamily: 'monospace', fontSize: '18px',
        color: '#cccccc', fontStyle: 'bold',
      }).setOrigin(0.5);
      this.add.text(w / 2, h - 145, '1.  NORMAL', {
        fontFamily: 'monospace', fontSize: '20px',
        color: '#9be39b', fontStyle: 'bold',
      }).setOrigin(0.5);
      this.add.text(w / 2, h - 115,
        '2.  HARD  —  2x enemies, more dark rooms, lasers on /5, /20 checkpoints, 60 levels',
        { fontFamily: 'monospace', fontSize: '14px',
          color: '#ff8888', fontStyle: 'bold' }
      ).setOrigin(0.5);
      if (secretUnlocked) {
        this.add.text(w / 2, h - 85,
          '3.  SECRET  —  start with poky stick + 100 gold, pink everything',
          { fontFamily: 'monospace', fontSize: '14px',
            color: '#ff7ae0', fontStyle: 'bold' }
        ).setOrigin(0.5);
      }
      this.add.text(w / 2, h - 50,
        secretUnlocked ? 'press 1, 2, or 3 to start' : 'press 1 or 2 to start',
        { fontFamily: 'monospace', fontSize: '14px', color: '#888888' }
      ).setOrigin(0.5);

      const startRun = (mode) => {
        window.STICK_CHECKPOINT = null;
        const seed = (Math.random() * 0x7fffffff) >>> 0;
        const data = { roomNumber: 1, hearts: 3, seed, mode };
        if (mode === 'secret') {
          data.gold = 100;
          data.weapon = 'poky';
        }
        this.scene.start('GameScene', data);
      };
      this.input.keyboard.once('keydown-ONE', () => startRun('normal'));
      this.input.keyboard.once('keydown-TWO', () => startRun('hard'));
      if (secretUnlocked) {
        this.input.keyboard.once('keydown-THREE', () => startRun('secret'));
      }
      this.input.keyboard.once('keydown-ENTER', () => startRun('normal'));
    }
  }

  // ----- Game -----
  class GameScene extends Phaser.Scene {
    constructor() {
      super('GameScene');
    }

    init(data) {
      data = data || {};
      this.roomNumber = data.roomNumber || 1;
      this.startingHearts = data.hearts || 3;
      this.sessionSeed = data.seed != null
        ? data.seed
        : (Math.random() * 0x7fffffff) >>> 0;
      this.startingGold = data.gold || 0;
      this.startingWeapon = data.weapon || 'stick';
      this.startingSpeedUntil = data.speedUntil || 0;
      this.startingHasSlumberKey = !!data.hasSlumberKey;
      this.isBonus = !!data.bonus;
      this.bonusOriginLevel = data.bonusOriginLevel || 0;
      this.bonusCompleted = false;
      this.challengePromptOpen = false;
      this.mode = data.mode === 'hard' ? 'hard' : 'normal';
      this.totalRooms = totalRoomsFor(this.mode);
    }

    create() {
      const w = this.scale.width;
      const h = this.scale.height;

      this.bg = this.add.rectangle(w / 2, h / 2, w, h, 0x1a1d28).setDepth(-10);

      // Extend the world below the visible canvas so pit falls actually kill.
      // The player drops off-screen and we detect death by y position.
      this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height + 200);
      this.physics.world.setBoundsCollision(true, true, true, false);

      this.controls = {
        left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
        right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
        up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
        a: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        d: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        w: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        space: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        j: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J),
        x: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X),
        skipNext: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CLOSED_BRACKET),
        skipPrev: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.OPEN_BRACKET),
        shop: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
        buy1: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
        buy2: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
        buy3: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
        buy4: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
        buy5: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE),
        esc: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
        achievements: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
        interact: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
      };

      this.achievements = loadAchievements();

      this.platformsGroup = this.physics.add.staticGroup();
      this.movingPlatformsGroup = this.physics.add.group({
        allowGravity: false,
        immovable: true,
      });
      this.enemiesGroup = this.physics.add.group();

      this.player = new window.Player(this, 0, 0);
      this.player.hearts = this.startingHearts;
      this.player.gold = this.startingGold;
      this.player.speedUntil = this.startingSpeedUntil;
      this.player.setWeapon(this.startingWeapon);
      this.player.hasSlumberKey = this.startingHasSlumberKey;

      this.physics.add.collider(this.player.sprite, this.platformsGroup);
      this.physics.add.collider(this.enemiesGroup, this.platformsGroup);
      this.physics.add.collider(this.player.sprite, this.movingPlatformsGroup);
      this.physics.add.collider(this.enemiesGroup, this.movingPlatformsGroup);

      this.laserProjectiles = [];

      this.physics.add.overlap(
        this.player.attackHitbox,
        this.enemiesGroup,
        (_hb, enemySprite) => {
          const enemy = enemySprite.enemyRef;
          if (!enemy || enemy.dead) return;
          // Each swing can hit a given enemy at most once (the hitbox
          // overlaps for ~150ms, which is many physics frames).
          if (this.player.hitEnemiesThisSwing.has(enemy)) return;
          this.player.hitEnemiesThisSwing.add(enemy);
          const killed = enemy.takeDamage(this.player.getDamage(), this.player.facing);
          if (killed && !this.isBonus) {
            this.player.gold += 10;
            this.refreshGoldHud();
            if (this.player.gold >= 150) this.unlockAchievement('gold150');
          }
        }
      );

      this.physics.add.overlap(
        this.player.sprite,
        this.enemiesGroup,
        (_p, enemySprite) => {
          if (!enemySprite.enemyRef || enemySprite.enemyRef.dead) return;
          this.player.takeDamage(this.time.now, enemySprite.x);
        }
      );

      // HUD: drawn above everything (depth 1000) so the top wall doesn't cover it.
      // Dark strip across the top to anchor the HUD visually.
      this.hudBar = this.add.rectangle(w / 2, 18, w, 36, 0x000000, 0.55);
      this.hudBar.setDepth(999);

      this.hudHpLabel = this.add.text(12, 18, 'HP', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffb0b0',
      }).setOrigin(0, 0.5).setDepth(1000);

      this.hudHearts = [];
      for (let i = 0; i < 3; i++) {
        const heart = this.add.rectangle(50 + i * 26, 18, 20, 20, 0xe54545);
        heart.setStrokeStyle(2, 0x7a1d1d);
        heart.setDepth(1000);
        this.hudHearts.push(heart);
      }

      this.hudGoldText = this.add.text(140, 18, 'G:0', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#f4d35e',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5).setDepth(1000);

      this.hudWeaponText = this.add.text(230, 18, 'WPN:STICK', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#cccccc',
      }).setOrigin(0, 0.5).setDepth(1000);

      this.hudSpeedText = this.add.text(350, 18, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ff66cc',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5).setDepth(1000);

      this.hudTimeText = this.add.text(660, 18, '', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#cdeeff',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5).setDepth(1000);

      this.hudShopHint = this.add.text(w / 2, h - 16, 'press E for shop', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#888888',
      }).setOrigin(0.5).setDepth(1000);

      this.hudRoomText = this.add.text(w / 2, 18, '', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#f4d35e',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(1000);

      this.hudKeyLabel = this.add.text(w - 90, 18, 'KEY', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#dddddd',
      }).setOrigin(0, 0.5).setDepth(1000);
      this.hudKeyIcon = this.add.rectangle(w - 40, 18, 18, 14, 0xfff36a);
      this.hudKeyIcon.setStrokeStyle(2, 0x8a6e10);
      this.hudKeyIcon.setDepth(1000);
      this.hudKeyText = this.add.text(w - 18, 18, '-', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#888888',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(1000);

      this.transitioning = false;
      this.attackClickQueued = false;
      this.input.on('pointerdown', (pointer) => {
        if (pointer.leftButtonDown() && !this.shopOpen && !this.transitioning) {
          this.attackClickQueued = true;
        }
      });

      this.buildRoom(this.roomNumber);
    }

    consumeAttackClick() {
      if (this.attackClickQueued) {
        this.attackClickQueued = false;
        return true;
      }
      return false;
    }

    buildRoom(roomNumber) {
      this.platformsGroup.clear(true, true);
      this.movingPlatformsGroup.clear(true, true);
      this.movingPlatforms = [];
      if (this.enemies) {
        this.enemies.forEach(e => {
          if (!e.dead && e.sprite && e.sprite.active) e.sprite.destroy();
        });
      }
      this.enemies = [];
      if (this.keySprite) this.keySprite.destroy();
      if (this.doorSprite) this.doorSprite.destroy();
      if (this.doorBar1) this.doorBar1.destroy();
      if (this.doorBar2) this.doorBar2.destroy();
      if (this.bonusDoorSprite) this.bonusDoorSprite.destroy();
      if (this.bonusDoorLabel) this.bonusDoorLabel.destroy();
      if (this.darkOverlay) { this.darkOverlay.destroy(); this.darkOverlay = null; }
      if (this.darkMaskGfx) { this.darkMaskGfx.destroy(); this.darkMaskGfx = null; }
      if (this.stoneOverlay) { this.stoneOverlay.destroy(); this.stoneOverlay = null; }
      if (this.stalactiteOverlay) { this.stalactiteOverlay.destroy(); this.stalactiteOverlay = null; }
      if (this.machineSprite) { this.machineSprite.destroy(); this.machineSprite = null; }
      if (this.machineLight) { this.machineLight.destroy(); this.machineLight = null; }
      if (this.machineLabel) { this.machineLabel.destroy(); this.machineLabel = null; }
      if (this.challengeBanner) { this.challengeBanner.destroy(); this.challengeBanner = null; }
      if (this.giantDoorSprite) { this.giantDoorSprite.destroy(); this.giantDoorSprite = null; }
      if (this.giantDoorDecor) {
        for (const d of this.giantDoorDecor) d.destroy();
        this.giantDoorDecor = null;
      }
      if (this.giantDoorLabel) { this.giantDoorLabel.destroy(); this.giantDoorLabel = null; }
      if (this.laserTurrets) {
        for (const t of this.laserTurrets) {
          if (t.lens) t.lens.destroy();
          t.destroy();
        }
        this.laserTurrets = null;
      }
      if (this.laserProjectiles) {
        for (const p of this.laserProjectiles) {
          if (p && p.active) p.destroy();
        }
        this.laserProjectiles = [];
      }

      this.rng = window.makeRng((roomNumber * 7919 + 31) ^ this.sessionSeed);

      // Per-level background hue. Kept dim (low value) so foreground stays readable.
      // Secret mode forces a pink tint regardless of level.
      let hue, sat, val;
      if (this.mode === 'secret') {
        hue = 0.88;
        sat = 0.55;
        val = 0.16;
      } else {
        hue = this.rng.float(0, 1);
        sat = this.rng.float(0.25, 0.5);
        val = this.rng.float(0.10, 0.18);
      }
      this.bg.setFillStyle(hsvToHex(hue, sat, val));

      // Procedural stone-brick overlay at 50% alpha. Detailed variant on /10
      // levels gets highlights and cracks for a more ornate feel.
      this.stoneOverlay = this.add.graphics();
      this.stoneOverlay.setAlpha(0.5);
      this.stoneOverlay.setDepth(-5);
      drawStoneBackground(this, this.stoneOverlay, roomNumber % 10 === 0);

      // Small stalactites hanging from the ceiling — purely decorative.
      this.stalactiteOverlay = this.add.graphics();
      this.stalactiteOverlay.setAlpha(0.85);
      this.stalactiteOverlay.setDepth(-3);
      drawStalactites(this, this.stalactiteOverlay);

      const generatorOpts = this.isBonus
        ? { bonus: true, forceEnemyCount: 15, mode: this.mode }
        : { mode: this.mode };
      const room = window.RoomGenerator.generateRoom(roomNumber, this.sessionSeed, generatorOpts);
      this.room = room;
      this.tiles = room.tiles;
      this.tileSize = window.RoomGenerator.TILE;
      this.cols = window.RoomGenerator.COLS;
      this.rows = window.RoomGenerator.ROWS;
      this.hasKey = false;

      // Full-heal on every 10th room (boss + super-boss rooms).
      if (roomNumber % 10 === 0 && this.player.hearts < 3) {
        this.player.hearts = 3;
        this.healFlash();
      }

      // Save a checkpoint on entering certain levels. Normal mode: every
      // 10th level. Hard mode: every 20th, but level 50 is explicitly NOT
      // a checkpoint (the final super-boss has to be earned).
      const checkpointCadence = this.mode === 'hard' ? 20 : 10;
      const skipCheckpoint = this.mode === 'hard' && roomNumber === 50;
      if (roomNumber % checkpointCadence === 0 && !skipCheckpoint) {
        window.STICK_CHECKPOINT = {
          roomNumber: roomNumber,
          seed: this.sessionSeed,
          gold: this.player.gold,
          weapon: this.player.weapon,
          mode: this.mode,
          hasSlumberKey: this.player.hasSlumberKey,
        };
        this.showCheckpointBanner();
      }

      // Reach-level achievements.
      if (roomNumber >= 25) this.unlockAchievement('room25');
      if (roomNumber >= 50) this.unlockAchievement('room50');

      // platforms — merge contiguous solid tiles per row
      const TILE = this.tileSize;
      for (let r = 0; r < this.rows; r++) {
        let runStart = -1;
        for (let c = 0; c <= this.cols; c++) {
          const solid = c < this.cols && this.tiles[r][c] === 1;
          if (solid && runStart === -1) runStart = c;
          if (!solid && runStart !== -1) {
            const w = (c - runStart) * TILE;
            const x = runStart * TILE + w / 2;
            const y = r * TILE + TILE / 2;
            const isWallOrCeiling = r === 0 || c === this.cols || c === 0;
            const fill = (r === this.rows - 1 || isWallOrCeiling) ? 0x363a40 : 0x575c64;
            const rect = this.add.rectangle(x, y, w, TILE, fill);
            rect.setStrokeStyle(2, 0x1a1c20);
            this.physics.add.existing(rect, true);
            this.platformsGroup.add(rect);
            runStart = -1;
          }
        }
      }

      this.player.teleport(room.playerSpawn.x, room.playerSpawn.y);
      this.player.sprite.body.setVelocity(0, 0);

      if (!this.isBonus && !room.giantDoor) {
        this.keySprite = this.add.rectangle(room.keyPos.x, room.keyPos.y, 18, 14, 0xfff36a);
        this.keySprite.setStrokeStyle(2, 0x8a6e10);
        this.physics.add.existing(this.keySprite);
        this.keySprite.body.setAllowGravity(false);
        this.keySprite.body.setImmovable(true);
        this.tweens.add({
          targets: this.keySprite,
          y: room.keyPos.y - 6,
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        this.physics.add.overlap(this.player.sprite, this.keySprite, () => {
          if (this.hasKey || !this.keySprite.active) return;
          this.hasKey = true;
          this.tweens.killTweensOf(this.keySprite);
          const flash = this.add.rectangle(this.keySprite.x, this.keySprite.y, 30, 30, 0xfff36a, 1);
          this.tweens.add({
            targets: flash, alpha: 0, scaleX: 2, scaleY: 2, duration: 250,
            onComplete: () => flash.destroy(),
          });
          this.keySprite.destroy();
          this.refreshDoorVisual();
        });

        this.doorSprite = this.add.rectangle(room.doorPos.x, room.doorPos.y, 28, 60, 0x444444);
        this.doorSprite.setStrokeStyle(3, 0x222222);
        this.physics.add.existing(this.doorSprite);
        this.doorSprite.body.setAllowGravity(false);
        this.doorSprite.body.setImmovable(true);
        this.doorBar1 = this.add.rectangle(room.doorPos.x - 6, room.doorPos.y - 6, 22, 4, 0x222222);
        this.doorBar2 = this.add.rectangle(room.doorPos.x + 6, room.doorPos.y + 6, 22, 4, 0x222222);
        this.refreshDoorVisual();

        this.physics.add.overlap(this.player.sprite, this.doorSprite, () => {
          if (!this.hasKey || this.transitioning) return;
          this.transitioning = true;
          this.cameras.main.flash(180, 255, 255, 255);
          this.time.delayedCall(180, () => {
            if (this.roomNumber >= this.totalRooms) {
              this.scene.start('WinScene');
            } else {
              this.scene.start('GameScene', {
                roomNumber: this.roomNumber + 1,
                hearts: this.player.hearts,
                seed: this.sessionSeed,
                gold: this.player.gold,
                weapon: this.player.weapon,
                speedUntil: this.player.speedUntil,
                mode: this.mode,
          hasSlumberKey: this.player.hasSlumberKey,
              });
            }
          });
        });
      }

      // Wall lasers — turrets that periodically fire projectiles at the player.
      this.laserTurrets = [];
      for (const l of room.lasers || []) {
        const w = 16, h = 14;
        const turret = this.add.rectangle(l.x, l.y, w, h, 0xb02828);
        turret.setStrokeStyle(2, 0x4a0d0d);
        turret.laserSide = l.side;
        // Stagger initial fire timing so turrets aren't synchronized.
        turret.nextFireAt = this.time.now + 700 + this.rng.int(0, 800);
        // Small lens dot facing into the room.
        const lensX = l.x + (l.side === 'left' ? 6 : -6);
        const lens = this.add.rectangle(lensX, l.y, 4, 4, 0xff8c8c);
        turret.lens = lens;
        this.laserTurrets.push(turret);
      }

      // Challenge machine — only on every 10th regular level.
      if (!this.isBonus && room.machinePos) {
        const mx = room.machinePos.x;
        const my = room.machinePos.y;
        this.machineSprite = this.add.rectangle(mx, my, 26, 28, 0x3aa1c4);
        this.machineSprite.setStrokeStyle(3, 0x123e52);
        this.physics.add.existing(this.machineSprite);
        this.machineSprite.body.setAllowGravity(false);
        this.machineSprite.body.setImmovable(true);
        // Indicator light dot
        this.machineLight = this.add.rectangle(mx, my - 8, 6, 6, 0xffd24d);
        this.tweens.add({
          targets: this.machineLight, alpha: { from: 0.4, to: 1 },
          duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        this.machineLabel = this.add.text(mx, my - 30, 'F: CHALLENGE', {
          fontFamily: 'monospace', fontSize: '11px',
          color: '#a8e6f5', fontStyle: 'bold',
        }).setOrigin(0.5);
      }

      // Giant door — hard-mode level 60 only. Press F while overlapping
      // it (with the slumber key) to unlock secret mode.
      if (room.giantDoor) {
        const g = room.giantDoor;
        this.giantDoorSprite = this.add.rectangle(g.x, g.y, g.width, g.height, 0x232040);
        this.giantDoorSprite.setStrokeStyle(6, 0x9080d8);
        this.physics.add.existing(this.giantDoorSprite);
        this.giantDoorSprite.body.setAllowGravity(false);
        this.giantDoorSprite.body.setImmovable(true);

        this.giantDoorDecor = [];
        const decor = this.giantDoorDecor;

        // Inner panel border for a layered look.
        const inner = this.add.rectangle(g.x, g.y, g.width - 36, g.height - 36);
        inner.setStrokeStyle(3, 0x4a3a78);
        decor.push(inner);

        // Decorative corner bolts.
        const bolt = (bx, by) => {
          const r = this.add.rectangle(bx, by, 14, 14, 0x4a3a78);
          r.setStrokeStyle(2, 0x12102a);
          decor.push(r);
        };
        const bx = g.width / 2 - 30, by = g.height / 2 - 30;
        bolt(g.x - bx, g.y - by); bolt(g.x + bx, g.y - by);
        bolt(g.x - bx, g.y + by); bolt(g.x + bx, g.y + by);

        // Crescent moon to the upper-left of the keyhole.
        const moonGfx = this.add.graphics().setDepth(0);
        const mx = g.x - 130, my = g.y - 80, mr = 38;
        moonGfx.fillStyle(0xeae3ff, 1);
        moonGfx.fillCircle(mx, my, mr);
        moonGfx.fillStyle(0x232040, 1);
        moonGfx.fillCircle(mx + 14, my - 6, mr);
        decor.push(moonGfx);

        // Big keyhole in the center, drawn as graphics (circle + tapered slot).
        const khGfx = this.add.graphics();
        khGfx.fillStyle(0x0e0c1c, 1);
        khGfx.fillCircle(g.x, g.y - 30, 36);
        khGfx.fillTriangle(
          g.x - 26, g.y - 30,
          g.x + 26, g.y - 30,
          g.x,       g.y + 90
        );
        khGfx.lineStyle(3, 0x9080d8, 1);
        khGfx.strokeCircle(g.x, g.y - 30, 36);
        decor.push(khGfx);

        // Sleepy 'z's drifting around the door.
        const zPositions = [
          { x: g.x + 110, y: g.y - 90, size: 36 },
          { x: g.x + 150, y: g.y - 130, size: 28 },
          { x: g.x + 180, y: g.y - 160, size: 20 },
          { x: g.x - 180, y: g.y + 110, size: 30 },
          { x: g.x - 140, y: g.y + 70,  size: 22 },
        ];
        for (const z of zPositions) {
          const t = this.add.text(z.x, z.y, 'z', {
            fontFamily: 'monospace', fontSize: `${z.size}px`,
            color: '#7a6abe', fontStyle: 'bold italic',
          }).setOrigin(0.5);
          this.tweens.add({
            targets: t,
            y: z.y - 6,
            alpha: { from: 0.7, to: 1 },
            duration: 1400 + z.size * 10,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
          decor.push(t);
        }

        this.giantDoorLabel = this.add.text(g.x, g.y - g.height / 2 - 26,
          'press F if you have the slumber key',
          { fontFamily: 'monospace', fontSize: '14px',
            color: '#c8b3ff', fontStyle: 'italic' }
        ).setOrigin(0.5);
      }

      // Challenge banner shown while inside the bonus room.
      if (this.isBonus) {
        const W = this.scale.width;
        this.challengeBanner = this.add.text(W / 2, 60,
          `CHALLENGE — DEFEAT ALL ${room.enemySpawns.length} ENEMIES`,
          {
            fontFamily: 'monospace', fontSize: '20px',
            color: '#ffae5e', fontStyle: 'bold',
            backgroundColor: '#000000', padding: { x: 14, y: 6 },
          }
        ).setOrigin(0.5).setDepth(1500);
      }

      // Bonus chest door — only on every 10th regular level (not in bonus room).
      if (!this.isBonus && room.bonusDoorPos) {
        const bx = room.bonusDoorPos.x;
        const by = room.bonusDoorPos.y - 22;
        this.bonusDoorSprite = this.add.rectangle(bx, by, 24, 44, 0x9b4dc4);
        this.bonusDoorSprite.setStrokeStyle(3, 0x4f1d80);
        this.physics.add.existing(this.bonusDoorSprite);
        this.bonusDoorSprite.body.setAllowGravity(false);
        this.bonusDoorSprite.body.setImmovable(true);
        this.bonusDoorLabel = this.add.text(bx, by - 30, 'CHEST', {
          fontFamily: 'monospace', fontSize: '11px',
          color: '#e0b3ff', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.tweens.add({
          targets: this.bonusDoorSprite,
          y: by - 4,
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        this.physics.add.overlap(this.player.sprite, this.bonusDoorSprite, () => {
          if (!this.hasKey || this.transitioning) return;
          this.transitioning = true;
          this.openChest();
        });
      }

      // moving platforms
      for (const mp of room.movingPlatforms) {
        const rect = this.add.rectangle(mp.cx, mp.cy, mp.width, mp.height, 0xf5b945);
        rect.setStrokeStyle(2, 0x9c6300);
        this.movingPlatformsGroup.add(rect);
        rect.body.setAllowGravity(false);
        rect.body.setImmovable(true);
        rect.movingData = {
          axis: mp.axis,
          centerX: mp.cx,
          centerY: mp.cy,
          range: mp.range,
          speed: mp.speed,
          dir: 1,
        };
        if (mp.axis === 'h') rect.body.setVelocityX(mp.speed);
        else rect.body.setVelocityY(mp.speed);
        this.movingPlatforms.push(rect);
      }

      // enemies
      for (const spawn of room.enemySpawns) {
        const enemy = new window.Enemy(this, spawn, room.enemySpeed);
        this.enemiesGroup.add(enemy.sprite);
        this.enemies.push(enemy);
      }

      const isSuperBoss = roomNumber % 50 === 0;
      const isBoss = !isSuperBoss && roomNumber % 10 === 0;
      let lvlSuffix = '';
      let lvlColor = '#f4d35e';
      if (this.mode === 'secret') {
        lvlSuffix = '  ~ SECRET ~';
        lvlColor = '#ff7ae0';
      } else if (isSuperBoss) {
        lvlSuffix = '  ** SUPER **';
        lvlColor = '#ff5050';
      } else if (isBoss) {
        lvlSuffix = '  * BOSS *';
        lvlColor = '#ff9a3c';
      }
      this.hudRoomText.setText(`LVL ${roomNumber} / ${this.totalRooms}${lvlSuffix}`);
      this.hudRoomText.setColor(lvlColor);

      // Fresh 2-minute timer for this level.
      this.timeLeftMs = 120000;
      this.timeUpTriggered = false;

      // Dark-room overlay: black rectangle covering the playfield with an
      // inverted circular mask cut around the player. Updated each frame.
      if (room.darkRoom) {
        const W = this.scale.width;
        const H = this.scale.height;
        this.darkOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.95);
        this.darkOverlay.setDepth(900);
        this.darkMaskGfx = this.make.graphics();
        const mask = this.darkMaskGfx.createGeometryMask();
        mask.invertAlpha = true;
        this.darkOverlay.setMask(mask);
        this.updateDarkMask();
      }

      this.refreshHearts();
      this.refreshKeyHud();
      this.refreshGoldHud();
      this.refreshWeaponHud();
      this.refreshSpeedHud();
      this.refreshTimeHud();
    }

    refreshDoorVisual() {
      if (!this.doorSprite || !this.doorSprite.active) return;
      if (this.hasKey) {
        this.doorSprite.setFillStyle(0x59c25a);
        this.doorSprite.setStrokeStyle(3, 0x2a6f2c);
        this.doorBar1.setVisible(false);
        this.doorBar2.setVisible(false);
      } else {
        this.doorSprite.setFillStyle(0x3a3a3a);
        this.doorSprite.setStrokeStyle(3, 0x1a1a1a);
        this.doorBar1.setVisible(true);
        this.doorBar2.setVisible(true);
      }
      this.refreshKeyHud();
    }

    refreshHearts() {
      for (let i = 0; i < this.hudHearts.length; i++) {
        this.hudHearts[i].setFillStyle(i < this.player.hearts ? 0xe54545 : 0x444444);
      }
    }

    refreshGoldHud() {
      if (this.hudGoldText) this.hudGoldText.setText(`G:${this.player.gold}`);
    }

    refreshWeaponHud() {
      if (!this.hudWeaponText) return;
      const w = this.player.weapon === 'poky' ? 'POKY' : 'STICK';
      this.hudWeaponText.setText(`WPN:${w}`);
      this.hudWeaponText.setColor(this.player.weapon === 'poky' ? '#ff8888' : '#cccccc');
    }

    refreshSpeedHud() {
      if (!this.hudSpeedText) return;
      const remainingMs = this.player.speedUntil - Date.now();
      if (remainingMs > 0) {
        const sec = Math.ceil(remainingMs / 1000);
        this.hudSpeedText.setText(`SPD ${sec}s`);
      } else {
        this.hudSpeedText.setText('');
      }
    }

    refreshTimeHud() {
      if (!this.hudTimeText) return;
      const ms = Math.max(0, this.timeLeftMs || 0);
      const totalSec = Math.ceil(ms / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      this.hudTimeText.setText(`TIME ${m}:${s.toString().padStart(2, '0')}`);
      this.hudTimeText.setColor(totalSec <= 30 ? '#ff5050' : '#cdeeff');
    }

    updateLasers(time) {
      if (!this.laserTurrets || this.laserTurrets.length === 0) return;
      for (const t of this.laserTurrets) {
        if (!t.active) continue;
        if (time >= t.nextFireAt) {
          this.fireLaser(t);
          t.nextFireAt = time + 1500;
        }
      }
    }

    fireLaser(turret) {
      const px = this.player.sprite.x;
      const py = this.player.sprite.y;
      const dx = px - turret.x;
      const dy = py - turret.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) return;
      const speed = 260;

      // Spawn the projectile slightly inside the room so its body doesn't
      // overlap the wall on the first physics step.
      const offset = 14;
      const sx = turret.x + (turret.laserSide === 'left' ? offset : -offset);
      const proj = this.add.rectangle(sx, turret.y, 8, 8, 0xff5050);
      proj.setStrokeStyle(1, 0x4a0000);
      this.physics.add.existing(proj);
      const body = proj.body;
      body.setAllowGravity(false);
      body.setImmovable(false);
      body.setCollideWorldBounds(false);

      // Per-projectile collider/overlap so we don't depend on a Physics
      // Arcade Group resetting body state when objects are added to it.
      this.physics.add.collider(proj, this.platformsGroup, () => {
        this.removeLaserProjectile(proj);
      });
      this.physics.add.overlap(proj, this.player.sprite, () => {
        this.player.takeDamage(this.time.now, proj.x);
        this.removeLaserProjectile(proj);
      });

      // Set velocity LAST so nothing in the setup pipeline can clear it.
      body.setVelocity((dx / len) * speed, (dy / len) * speed);

      this.laserProjectiles.push(proj);

      if (turret.lens) {
        turret.lens.setFillStyle(0xfff0f0);
        this.time.delayedCall(80, () => {
          if (turret.lens && turret.lens.active) {
            turret.lens.setFillStyle(0xff8c8c);
          }
        });
      }
      this.time.delayedCall(5000, () => {
        if (proj && proj.active) this.removeLaserProjectile(proj);
      });
    }

    removeLaserProjectile(proj) {
      if (!proj || !proj.active) return;
      const i = this.laserProjectiles ? this.laserProjectiles.indexOf(proj) : -1;
      if (i >= 0) this.laserProjectiles.splice(i, 1);
      proj.destroy();
    }

    updateDarkMask() {
      if (!this.darkMaskGfx) return;
      const TILE = window.RoomGenerator.TILE;
      const radius = TILE * 3 + 16; // 3 tiles around the player + a bit
      this.darkMaskGfx.clear();
      this.darkMaskGfx.fillStyle(0xffffff);
      this.darkMaskGfx.fillCircle(this.player.sprite.x, this.player.sprite.y, radius);
    }

    showCheckpointBanner() {
      const w = this.scale.width;
      const banner = this.add.text(w / 2, 70, 'CHECKPOINT', {
        fontFamily: 'monospace', fontSize: '20px',
        color: '#9be39b', fontStyle: 'bold',
        backgroundColor: '#000000', padding: { x: 12, y: 6 },
      }).setOrigin(0.5).setDepth(1500).setAlpha(0);
      this.tweens.add({
        targets: banner,
        alpha: { from: 0, to: 1 },
        duration: 200,
        yoyo: true,
        hold: 900,
        onComplete: () => banner.destroy(),
      });
    }

    healFlash() {
      // Brief green pulse on the hearts to signal a heal.
      for (const heart of this.hudHearts) {
        heart.setFillStyle(0x59c25a);
        this.tweens.add({
          targets: heart,
          scaleX: 1.4, scaleY: 1.4,
          duration: 180,
          yoyo: true,
          onComplete: () => this.refreshHearts(),
        });
      }
    }

    refreshKeyHud() {
      if (this.hasKey) {
        this.hudKeyIcon.setFillStyle(0xfff36a);
        this.hudKeyText.setText('OK');
        this.hudKeyText.setColor('#9be39b');
      } else {
        this.hudKeyIcon.setFillStyle(0x4a4a3a);
        this.hudKeyText.setText('-');
        this.hudKeyText.setColor('#888888');
      }
    }

    tileSolidAt(worldX, worldY) {
      const c = Math.floor(worldX / this.tileSize);
      const r = Math.floor(worldY / this.tileSize);
      if (c < 0 || c >= this.cols) return true;
      if (r < 0 || r >= this.rows) return true;
      return this.tiles[r][c] === 1;
    }

    updateMovingPlatforms() {
      if (!this.movingPlatforms) return;
      const player = this.player.sprite;
      const onGround = player.body.blocked.down || player.body.touching.down;

      for (const p of this.movingPlatforms) {
        const md = p.movingData;
        if (md.axis === 'h') {
          if (p.x >= md.centerX + md.range && md.dir > 0) {
            md.dir = -1;
            p.body.setVelocityX(-md.speed);
          } else if (p.x <= md.centerX - md.range && md.dir < 0) {
            md.dir = 1;
            p.body.setVelocityX(md.speed);
          }
          // Carry the player horizontally if standing on top of this platform.
          if (onGround) {
            const playerBottom = player.y + 16;
            const platformTop = p.y - p.height / 2;
            const yClose = Math.abs(playerBottom - platformTop) < 6;
            const xOverlap = Math.abs(player.x - p.x) < (p.width / 2 + 13);
            if (yClose && xOverlap) {
              player.x += p.body.deltaX();
            }
          }
        } else {
          if (p.y >= md.centerY + md.range && md.dir > 0) {
            md.dir = -1;
            p.body.setVelocityY(-md.speed);
          } else if (p.y <= md.centerY - md.range && md.dir < 0) {
            md.dir = 1;
            p.body.setVelocityY(md.speed);
          }
        }
      }
    }

    unlockAchievement(id) {
      if (!this.achievements) this.achievements = loadAchievements();
      if (this.achievements[id]) return;
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      if (!ach) return;
      this.achievements[id] = true;
      saveAchievements(this.achievements);
      this.showAchievementToast(ach);
    }

    showAchievementToast(ach) {
      const w = this.scale.width;
      const banner = this.add.text(w / 2, 110,
        `★ ACHIEVEMENT  —  ${ach.name}`,
        {
          fontFamily: 'monospace', fontSize: '20px',
          color: '#f4d35e', fontStyle: 'bold',
          backgroundColor: '#000000', padding: { x: 14, y: 8 },
        }
      ).setOrigin(0.5).setDepth(1500).setAlpha(0);
      this.tweens.add({
        targets: banner,
        alpha: { from: 0, to: 1 },
        duration: 250,
        yoyo: true,
        hold: 1600,
        onComplete: () => banner.destroy(),
      });
    }

    openAchievements() {
      if (this.achievementsOpen || this.shopOpen || this.transitioning) return;
      this.achievementsOpen = true;
      this.physics.pause();
      const w = this.scale.width;
      const h = this.scale.height;
      const D = 2000;

      this.achGroup = this.add.container(0, 0).setDepth(D);
      const dim = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.6);
      const panel = this.add.rectangle(w / 2, h / 2, 620, 380, 0x1a1d28, 0.97);
      panel.setStrokeStyle(3, 0xf4d35e);
      const title = this.add.text(w / 2, h / 2 - 150, 'ACHIEVEMENTS', {
        fontFamily: 'monospace', fontSize: '30px',
        color: '#f4d35e', fontStyle: 'bold',
      }).setOrigin(0.5);

      const unlockedCount = ACHIEVEMENTS.filter(a => this.achievements[a.id]).length;
      const summary = this.add.text(w / 2, h / 2 - 110,
        `${unlockedCount} / ${ACHIEVEMENTS.length} unlocked`,
        { fontFamily: 'monospace', fontSize: '16px', color: '#cccccc' }
      ).setOrigin(0.5);

      this.achGroup.add([dim, panel, title, summary]);

      let y = h / 2 - 60;
      for (const a of ACHIEVEMENTS) {
        const got = !!this.achievements[a.id];
        const marker = this.add.text(w / 2 - 250, y, got ? '★' : '☆', {
          fontFamily: 'monospace', fontSize: '28px',
          color: got ? '#f4d35e' : '#555555', fontStyle: 'bold',
        }).setOrigin(0, 0.5);
        const name = this.add.text(w / 2 - 210, y, a.name, {
          fontFamily: 'monospace', fontSize: '20px',
          color: got ? '#dddddd' : '#777777', fontStyle: 'bold',
        }).setOrigin(0, 0.5);
        const desc = this.add.text(w / 2 - 210, y + 22, a.desc, {
          fontFamily: 'monospace', fontSize: '14px',
          color: got ? '#9be39b' : '#555555',
        }).setOrigin(0, 0.5);
        this.achGroup.add([marker, name, desc]);
        y += 60;
      }

      const hint = this.add.text(w / 2, h / 2 + 150, 'press Q or ESC to close', {
        fontFamily: 'monospace', fontSize: '14px', color: '#888888',
      }).setOrigin(0.5);
      this.achGroup.add([hint]);
    }

    closeAchievements() {
      if (!this.achievementsOpen) return;
      this.achievementsOpen = false;
      this.physics.resume();
      if (this.achGroup) {
        this.achGroup.destroy(true);
        this.achGroup = null;
      }
    }

    showSlumberKeyHint() {
      const w = this.scale.width;
      const t = this.add.text(w / 2, 70,
        'you do not have the slumber man’s key',
        {
          fontFamily: 'monospace', fontSize: '16px',
          color: '#c8b3ff', fontStyle: 'italic',
          backgroundColor: '#000000', padding: { x: 12, y: 6 },
        }
      ).setOrigin(0.5).setDepth(2200).setAlpha(0);
      this.tweens.add({
        targets: t, alpha: { from: 0, to: 1 },
        duration: 200, yoyo: true, hold: 1100,
        onComplete: () => t.destroy(),
      });
    }

    unlockSecretMode() {
      this.transitioning = true;
      try { localStorage.setItem('stick-knight-secret', '1'); } catch (e) {}

      const w = this.scale.width;
      const h = this.scale.height;
      const dim = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.85).setDepth(2400);
      const big = this.add.text(w / 2, h / 2 - 30, 'SECRET MODE UNLOCKED', {
        fontFamily: 'monospace', fontSize: '34px',
        color: '#ff7ae0', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(2401);
      const small = this.add.text(w / 2, h / 2 + 30, '… and you die.', {
        fontFamily: 'monospace', fontSize: '20px',
        color: '#aaaaaa', fontStyle: 'italic',
      }).setOrigin(0.5).setDepth(2401);
      this.cameras.main.flash(280, 255, 100, 220);

      this.time.delayedCall(2200, () => {
        dim.destroy(); big.destroy(); small.destroy();
        this.scene.start('GameOverScene', {
          roomNumber: this.roomNumber,
          mode: this.mode,
        });
      });
    }

    openChallengePrompt() {
      if (this.challengePromptOpen) return;
      this.challengePromptOpen = true;
      this.physics.pause();

      const w = this.scale.width;
      const h = this.scale.height;
      const D = 2000;
      this.challengePromptGroup = this.add.container(0, 0).setDepth(D);

      const dim = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.6);
      const panel = this.add.rectangle(w / 2, h / 2, 560, 280, 0x1a2228, 0.97);
      panel.setStrokeStyle(3, 0x3aa1c4);
      const title = this.add.text(w / 2, h / 2 - 90, 'CHALLENGE ROOM', {
        fontFamily: 'monospace', fontSize: '26px',
        color: '#a8e6f5', fontStyle: 'bold',
      }).setOrigin(0.5);
      const desc = this.add.text(w / 2, h / 2 - 40,
        'enter a sealed room with 15 enemies\nclear them all to win 250 gold',
        { fontFamily: 'monospace', fontSize: '15px', color: '#cccccc', align: 'center' }
      ).setOrigin(0.5);
      const accept = this.add.text(w / 2, h / 2 + 30, '1.  ACCEPT', {
        fontFamily: 'monospace', fontSize: '20px',
        color: '#9be39b', fontStyle: 'bold',
      }).setOrigin(0.5);
      const decline = this.add.text(w / 2, h / 2 + 65, '2.  DECLINE', {
        fontFamily: 'monospace', fontSize: '20px',
        color: '#dddddd',
      }).setOrigin(0.5);
      const hint = this.add.text(w / 2, h / 2 + 110,
        'press 1 or 2,  ESC to back out',
        { fontFamily: 'monospace', fontSize: '12px', color: '#888888' }
      ).setOrigin(0.5);

      this.challengePromptGroup.add([dim, panel, title, desc, accept, decline, hint]);
    }

    closeChallengePrompt() {
      if (!this.challengePromptOpen) return;
      this.challengePromptOpen = false;
      this.physics.resume();
      if (this.challengePromptGroup) {
        this.challengePromptGroup.destroy(true);
        this.challengePromptGroup = null;
      }
    }

    declineChallenge() {
      this.closeChallengePrompt();
    }

    acceptChallenge() {
      this.closeChallengePrompt();
      this.transitioning = true;
      // Save a checkpoint pointing back to this bonus room — death sends
      // the player back here to retry the challenge.
      window.STICK_CHECKPOINT = {
        roomNumber: this.roomNumber,
        seed: this.sessionSeed,
        gold: this.player.gold,
        weapon: this.player.weapon,
        bonus: true,
        bonusOriginLevel: this.roomNumber,
        mode: this.mode,
          hasSlumberKey: this.player.hasSlumberKey,
      };
      this.cameras.main.flash(220, 80, 200, 240);
      this.time.delayedCall(180, () => {
        this.scene.start('GameScene', {
          roomNumber: this.roomNumber,
          hearts: this.player.hearts,
          seed: this.sessionSeed,
          gold: this.player.gold,
          weapon: this.player.weapon,
          speedUntil: this.player.speedUntil,
          bonus: true,
          bonusOriginLevel: this.roomNumber,
          mode: this.mode,
          hasSlumberKey: this.player.hasSlumberKey,
        });
      });
    }

    completeChallenge() {
      // Award 250 gold and advance to the level after the bonus origin.
      this.transitioning = true;
      this.player.gold += 250;
      this.refreshGoldHud();
      if (this.player.gold >= 150) this.unlockAchievement('gold150');

      const w = this.scale.width;
      const h = this.scale.height;
      const banner = this.add.text(w / 2, h / 2,
        'CHALLENGE CLEARED!  +250 gold',
        {
          fontFamily: 'monospace', fontSize: '28px',
          color: '#f4d35e', fontStyle: 'bold',
          backgroundColor: '#000000', padding: { x: 24, y: 14 },
        }
      ).setOrigin(0.5).setDepth(2000);
      this.cameras.main.flash(260, 240, 220, 80);

      const nextLevel = (this.bonusOriginLevel || this.roomNumber) + 1;
      // Replace the checkpoint with one pointing at the next regular level
      // so dying after the bonus doesn't drag the player back into it.
      window.STICK_CHECKPOINT = {
        roomNumber: Math.min(nextLevel, this.totalRooms),
        seed: this.sessionSeed,
        gold: this.player.gold,
        weapon: this.player.weapon,
        mode: this.mode,
          hasSlumberKey: this.player.hasSlumberKey,
      };

      this.time.delayedCall(1700, () => {
        banner.destroy();
        if (nextLevel > this.totalRooms) {
          this.scene.start('WinScene');
        } else {
          this.scene.start('GameScene', {
            roomNumber: nextLevel,
            hearts: this.player.hearts,
            seed: this.sessionSeed,
            gold: this.player.gold,
            weapon: this.player.weapon,
            speedUntil: this.player.speedUntil,
            mode: this.mode,
          hasSlumberKey: this.player.hasSlumberKey,
          });
        }
      });
    }

    openChest() {
      // Roll a reward. If we'd hand out poky stick but the player already
      // owns one, swap it for bonus gold.
      const pool = ['gold', 'heal', 'speed', 'poky'];
      let reward = this.rng.pick(pool);
      let msg;
      if (reward === 'gold') {
        this.player.gold += 50;
        msg = 'CHEST!  +50 gold';
      } else if (reward === 'heal') {
        this.player.hearts = 3;
        msg = 'CHEST!  healing potion';
      } else if (reward === 'speed') {
        const now = Date.now();
        const remaining = Math.max(0, this.player.speedUntil - now);
        this.player.speedUntil = now + Math.min(remaining + 20000, 60000);
        msg = 'CHEST!  speed potion (20s)';
      } else {
        if (this.player.weapon === 'poky') {
          this.player.gold += 100;
          msg = 'CHEST!  poky stick (already owned, +100 gold)';
        } else {
          this.player.setWeapon('poky');
          msg = 'CHEST!  poky stick';
        }
      }
      this.refreshHearts();
      this.refreshGoldHud();
      this.refreshWeaponHud();
      this.refreshSpeedHud();
      if (this.player.gold >= 150) this.unlockAchievement('gold150');

      const w = this.scale.width;
      const h = this.scale.height;
      const banner = this.add.text(w / 2, h / 2, msg, {
        fontFamily: 'monospace', fontSize: '28px',
        color: '#f4d35e', fontStyle: 'bold',
        backgroundColor: '#000000', padding: { x: 24, y: 14 },
      }).setOrigin(0.5).setDepth(2000);
      this.cameras.main.flash(220, 255, 220, 80);

      this.time.delayedCall(1500, () => {
        banner.destroy();
        if (this.roomNumber >= this.totalRooms) {
          this.scene.start('WinScene');
        } else {
          this.scene.start('GameScene', {
            roomNumber: this.roomNumber + 1,
            hearts: this.player.hearts,
            seed: this.sessionSeed,
            gold: this.player.gold,
            weapon: this.player.weapon,
            speedUntil: this.player.speedUntil,
            mode: this.mode,
          hasSlumberKey: this.player.hasSlumberKey,
          });
        }
      });
    }

    openShop() {
      if (this.shopOpen) return;
      this.shopOpen = true;
      this.physics.pause();

      const w = this.scale.width;
      const h = this.scale.height;
      const D = 2000;

      this.shopGroup = this.add.container(0, 0).setDepth(D);

      const dim = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.6);
      const panel = this.add.rectangle(w / 2, h / 2, 660, 490, 0x1a1d28, 0.97);
      panel.setStrokeStyle(3, 0xf4d35e);
      const title = this.add.text(w / 2, h / 2 - 190, 'SHOP', {
        fontFamily: 'monospace', fontSize: '34px', color: '#f4d35e', fontStyle: 'bold',
      }).setOrigin(0.5);

      this.shopGoldText = this.add.text(w / 2, h / 2 - 150, '', {
        fontFamily: 'monospace', fontSize: '18px', color: '#f4d35e',
      }).setOrigin(0.5);

      this.shopItems = [
        { key: 'heal',    hotkey: '1', name: 'Healing Potion',     desc: 'restore all hearts',                  price: 30 },
        { key: 'speed',   hotkey: '2', name: 'Speed Potion',       desc: '2.5x speed for 20s',                  price: 60 },
        { key: 'poky',    hotkey: '3', name: 'Poky Stick',         desc: '3-hit kill weapon (perm)',            price: 120 },
        { key: 'skip',    hotkey: '4', name: 'Skip Level',         desc: 'advance immediately',                 price: 0 },
        { key: 'slumber', hotkey: '5', name: "Slumber Man's Key",  desc: '???',                                 price: 300 },
      ];
      this.shopItemTexts = [];
      let y = h / 2 - 100;
      for (const item of this.shopItems) {
        const left = this.add.text(w / 2 - 270, y,
          `${item.hotkey}.  ${item.name}`,
          { fontFamily: 'monospace', fontSize: '20px', color: '#dddddd' }
        ).setOrigin(0, 0.5);
        const desc = this.add.text(w / 2 - 270, y + 20,
          `      ${item.desc}`,
          { fontFamily: 'monospace', fontSize: '14px', color: '#888888' }
        ).setOrigin(0, 0.5);
        const price = this.add.text(w / 2 + 250, y, `${item.price}g`, {
          fontFamily: 'monospace', fontSize: '20px', color: '#f4d35e', fontStyle: 'bold',
        }).setOrigin(1, 0.5);
        this.shopItemTexts.push({ left, desc, price, item });
        y += 54;
      }

      const hint = this.add.text(w / 2, h / 2 + 215, 'press 1-5 to buy   E or ESC to close', {
        fontFamily: 'monospace', fontSize: '14px', color: '#888888',
      }).setOrigin(0.5);

      this.shopGroup.add([dim, panel, title, this.shopGoldText, hint]);
      for (const t of this.shopItemTexts) this.shopGroup.add([t.left, t.desc, t.price]);
      this.refreshShopUi();
    }

    refreshShopUi() {
      if (!this.shopOpen) return;
      this.shopGoldText.setText(`Your gold: ${this.player.gold}g`);
      for (const t of this.shopItemTexts) {
        const affordable = this.player.gold >= t.item.price;
        const owned =
          (t.item.key === 'poky' && this.player.weapon === 'poky') ||
          (t.item.key === 'slumber' && this.player.hasSlumberKey);
        if (owned) {
          t.price.setText('OWNED');
          t.price.setColor('#888888');
          t.left.setColor('#666666');
        } else if (affordable) {
          t.price.setColor('#f4d35e');
          t.left.setColor('#dddddd');
        } else {
          t.price.setColor('#aa3838');
          t.left.setColor('#777777');
        }
      }
    }

    closeShop() {
      if (!this.shopOpen) return;
      this.shopOpen = false;
      this.physics.resume();
      if (this.shopGroup) {
        this.shopGroup.destroy(true);
        this.shopGroup = null;
      }
      this.shopItemTexts = null;
    }

    tryBuy(key) {
      const item = this.shopItems.find(it => it.key === key);
      if (!item) return;
      if (item.key === 'poky' && this.player.weapon === 'poky') return;
      if (item.key === 'slumber' && this.player.hasSlumberKey) return;
      if (this.player.gold < item.price) return;
      this.player.gold -= item.price;
      if (item.key === 'heal') {
        this.player.hearts = 3;
        this.healFlash();
      } else if (item.key === 'speed') {
        const now = Date.now();
        // Stack with any remaining time, capped at 60s.
        const remaining = Math.max(0, this.player.speedUntil - now);
        this.player.speedUntil = now + Math.min(remaining + 20000, 60000);
        this.refreshSpeedHud();
      } else if (item.key === 'poky') {
        this.player.setWeapon('poky');
        this.refreshWeaponHud();
      } else if (item.key === 'slumber') {
        this.player.hasSlumberKey = true;
        // Tiny banner so the purchase is felt.
        const w = this.scale.width;
        const banner = this.add.text(w / 2, 80,
          "you bought the slumber man's key . . .",
          {
            fontFamily: 'monospace', fontSize: '16px',
            color: '#c8b3ff', fontStyle: 'italic',
            backgroundColor: '#000000', padding: { x: 12, y: 6 },
          }
        ).setOrigin(0.5).setDepth(2200).setAlpha(0);
        this.tweens.add({
          targets: banner, alpha: { from: 0, to: 1 },
          duration: 250, yoyo: true, hold: 1400,
          onComplete: () => banner.destroy(),
        });
      } else if (item.key === 'skip') {
        this.refreshGoldHud();
        this.closeShop();
        this.transitioning = true;
        this.cameras.main.flash(220, 180, 80, 200);
        this.time.delayedCall(180, () => {
          if (this.roomNumber >= this.totalRooms) {
            this.scene.start('WinScene');
          } else {
            this.scene.start('GameScene', {
              roomNumber: this.roomNumber + 1,
              hearts: this.player.hearts,
              seed: this.sessionSeed,
              gold: this.player.gold,
              weapon: this.player.weapon,
              speedUntil: this.player.speedUntil,
              mode: this.mode,
          hasSlumberKey: this.player.hasSlumberKey,
            });
          }
        });
        return;
      }
      this.refreshGoldHud();
      this.refreshShopUi();
    }

    update(time, delta) {
      if (this.transitioning) return;

      // Challenge prompt — accept (1) / decline (2 or ESC).
      if (this.challengePromptOpen) {
        if (Phaser.Input.Keyboard.JustDown(this.controls.buy1)) {
          this.acceptChallenge();
        } else if (Phaser.Input.Keyboard.JustDown(this.controls.buy2) ||
                   Phaser.Input.Keyboard.JustDown(this.controls.esc)) {
          this.declineChallenge();
        }
        return;
      }

      // Achievements menu — close-only input while open.
      if (this.achievementsOpen) {
        if (Phaser.Input.Keyboard.JustDown(this.controls.achievements) ||
            Phaser.Input.Keyboard.JustDown(this.controls.esc)) {
          this.closeAchievements();
        }
        return;
      }

      // Shop input is handled even while paused so the player can close it.
      if (this.shopOpen) {
        if (Phaser.Input.Keyboard.JustDown(this.controls.shop) ||
            Phaser.Input.Keyboard.JustDown(this.controls.esc)) {
          this.closeShop();
        } else if (Phaser.Input.Keyboard.JustDown(this.controls.buy1)) {
          this.tryBuy('heal');
        } else if (Phaser.Input.Keyboard.JustDown(this.controls.buy2)) {
          this.tryBuy('speed');
        } else if (Phaser.Input.Keyboard.JustDown(this.controls.buy3)) {
          this.tryBuy('poky');
        } else if (Phaser.Input.Keyboard.JustDown(this.controls.buy4)) {
          this.tryBuy('skip');
        } else if (Phaser.Input.Keyboard.JustDown(this.controls.buy5)) {
          this.tryBuy('slumber');
        }
        return;
      }
      if (Phaser.Input.Keyboard.JustDown(this.controls.shop)) {
        this.openShop();
        return;
      }
      if (Phaser.Input.Keyboard.JustDown(this.controls.achievements)) {
        this.openAchievements();
        return;
      }

      this.updateMovingPlatforms();
      this.player.update(time, this.controls);
      for (const e of this.enemies) e.update();
      this.updateDarkMask();
      this.updateLasers(time);

      // F near the challenge machine opens the accept/decline prompt.
      if (this.machineSprite && !this.challengePromptOpen &&
          Phaser.Input.Keyboard.JustDown(this.controls.interact)) {
        const dx = this.player.sprite.x - this.machineSprite.x;
        const dy = this.player.sprite.y - this.machineSprite.y;
        if (Math.abs(dx) < 28 && Math.abs(dy) < 36) {
          this.openChallengePrompt();
          return;
        }
      }

      // F on the giant door — secret-mode unlock if the player has the key.
      if (this.giantDoorSprite &&
          Phaser.Input.Keyboard.JustDown(this.controls.interact)) {
        const g = this.giantDoorSprite;
        const px = this.player.sprite.x;
        const py = this.player.sprite.y;
        const inDoor =
          Math.abs(px - g.x) < g.displayWidth / 2 + 16 &&
          Math.abs(py - g.y) < g.displayHeight / 2 + 16;
        if (inDoor) {
          if (this.player.hasSlumberKey) {
            this.unlockSecretMode();
            return;
          } else {
            this.showSlumberKeyHint();
          }
        }
      }

      // Bonus room completion check: all enemies dead → reward and advance.
      if (this.isBonus && !this.bonusCompleted) {
        const alive = this.enemies.some(e => !e.dead);
        if (!alive && this.enemies.length > 0) {
          this.bonusCompleted = true;
          this.completeChallenge();
          return;
        }
      }

      // Tick the per-level timer. Pauses naturally because we early-return
      // out of update() while the shop is open or transitioning.
      if (this.timeLeftMs > 0) {
        this.timeLeftMs -= delta;
        if (this.timeLeftMs <= 0 && !this.timeUpTriggered) {
          this.timeUpTriggered = true;
          this.timeLeftMs = 0;
          this.player.hearts = 0;
          this.player.alive = false;
        }
      }

      this.refreshHearts();
      this.refreshSpeedHud();
      this.refreshTimeHud();

      // dev: skip rooms (handy for testing)
      if (Phaser.Input.Keyboard.JustDown(this.controls.skipNext)) {
        this.transitioning = true;
        if (this.roomNumber >= this.totalRooms) {
          this.scene.start('WinScene');
        } else {
          this.scene.start('GameScene', {
            roomNumber: this.roomNumber + 1,
            hearts: this.player.hearts,
            seed: this.sessionSeed,
            gold: this.player.gold,
            weapon: this.player.weapon,
            speedUntil: this.player.speedUntil,
            mode: this.mode,
          hasSlumberKey: this.player.hasSlumberKey,
          });
        }
        return;
      }
      if (Phaser.Input.Keyboard.JustDown(this.controls.skipPrev) && this.roomNumber > 1) {
        this.transitioning = true;
        this.scene.start('GameScene', {
          roomNumber: this.roomNumber - 1,
          hearts: this.player.hearts,
          seed: this.sessionSeed,
          gold: this.player.gold,
          weapon: this.player.weapon,
          speedUntil: this.player.speedUntil,
          mode: this.mode,
          hasSlumberKey: this.player.hasSlumberKey,
        });
        return;
      }

      // fall-out-of-room death
      if (this.player.sprite.y > this.scale.height + 80) {
        this.player.hearts = 0;
        this.player.alive = false;
      }

      if (!this.player.alive) {
        this.transitioning = true;
        this.time.delayedCall(400, () => {
          this.scene.start('GameOverScene', { roomNumber: this.roomNumber, mode: this.mode });
        });
      }
    }
  }

  // ----- Game Over -----
  class GameOverScene extends Phaser.Scene {
    constructor() {
      super('GameOverScene');
    }
    init(data) {
      data = data || {};
      this.roomNumber = data.roomNumber || 1;
      this.runMode = data.mode === 'hard' ? 'hard' : 'normal';
    }
    create() {
      const w = this.scale.width;
      const h = this.scale.height;
      this.add.rectangle(w / 2, h / 2, w, h, 0x180c0c);
      this.add.text(w / 2, 180, 'YOU DIED', {
        fontFamily: 'monospace',
        fontSize: '64px',
        color: '#e54545',
      }).setOrigin(0.5);
      const total = totalRoomsFor(this.runMode);
      this.add.text(w / 2, 260, `made it to level ${this.roomNumber} of ${total}`, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#dddddd',
      }).setOrigin(0.5);

      const cp = window.STICK_CHECKPOINT;
      const retryText = cp
        ? `press ENTER to retry from level ${cp.roomNumber}`
        : 'press ENTER to try again';
      this.add.text(w / 2, 360, retryText, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#aaaaaa',
      }).setOrigin(0.5);
      if (cp) {
        this.add.text(w / 2, 395, '(R for a fresh run from level 1)', {
          fontFamily: 'monospace', fontSize: '14px', color: '#666666',
        }).setOrigin(0.5);
      }

      const retry = () => {
        if (cp) {
          this.scene.start('GameScene', {
            roomNumber: cp.roomNumber,
            hearts: 3,
            seed: cp.seed,
            gold: cp.gold,
            weapon: cp.weapon,
            speedUntil: 0,
            bonus: !!cp.bonus,
            bonusOriginLevel: cp.bonusOriginLevel || 0,
            mode: cp.mode || 'normal',
            hasSlumberKey: !!cp.hasSlumberKey,
          });
        } else {
          this.scene.start('TitleScene');
        }
      };
      const freshRun = () => {
        window.STICK_CHECKPOINT = null;
        this.scene.start('TitleScene');
      };
      this.input.keyboard.once('keydown-ENTER', retry);
      this.input.keyboard.once('keydown-SPACE', retry);
      this.input.keyboard.once('keydown-R', freshRun);
    }
  }

  // ----- Win -----
  class WinScene extends Phaser.Scene {
    constructor() {
      super('WinScene');
    }
    create() {
      const w = this.scale.width;
      const h = this.scale.height;
      this.add.rectangle(w / 2, h / 2, w, h, 0x0c1810);
      this.add.text(w / 2, 200, 'YOU CLEARED 50 LEVELS', {
        fontFamily: 'monospace',
        fontSize: '40px',
        color: '#f4d35e',
      }).setOrigin(0.5);
      this.add.text(w / 2, 260, 'the stick was mighty.', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#9be39b',
      }).setOrigin(0.5);
      this.add.text(w / 2, 380, 'press ENTER to play again', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#aaaaaa',
      }).setOrigin(0.5);
      this.input.keyboard.once('keydown-ENTER', () => {
        window.STICK_CHECKPOINT = null;
        this.scene.start('TitleScene');
      });
    }
  }

  window.TitleScene = TitleScene;
  window.GameScene = GameScene;
  window.GameOverScene = GameOverScene;
  window.WinScene = WinScene;
})();
