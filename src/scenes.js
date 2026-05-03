(function () {
  const TOTAL_ROOMS = 50;

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
        '  Shop        E              (gold drops from kills)',
        '',
        '  Find the key, kill enemies, exit through the door on the right.',
        '',
        '  Press ENTER to start',
      ];
      this.add.text(w / 2, h / 2 + 20, controls.join('\n'), {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#dddddd',
        align: 'center',
      }).setOrigin(0.5);

      const startRun = () => {
        window.STICK_CHECKPOINT = null;
        const seed = (Math.random() * 0x7fffffff) >>> 0;
        this.scene.start('GameScene', { roomNumber: 1, hearts: 3, seed });
      };
      this.input.keyboard.once('keydown-ENTER', startRun);
      this.input.keyboard.once('keydown-SPACE', startRun);
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
    }

    create() {
      const w = this.scale.width;
      const h = this.scale.height;

      this.bg = this.add.rectangle(w / 2, h / 2, w, h, 0x1a1d28);

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
        esc: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      };

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

      this.physics.add.collider(this.player.sprite, this.platformsGroup);
      this.physics.add.collider(this.enemiesGroup, this.platformsGroup);
      this.physics.add.collider(this.player.sprite, this.movingPlatformsGroup);
      this.physics.add.collider(this.enemiesGroup, this.movingPlatformsGroup);

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
          if (killed) {
            this.player.gold += 10;
            this.refreshGoldHud();
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

      this.rng = window.makeRng((roomNumber * 7919 + 31) ^ this.sessionSeed);

      // Per-level background hue. Kept dim (low value) so foreground stays readable.
      const hue = this.rng.float(0, 1);
      const sat = this.rng.float(0.25, 0.5);
      const val = this.rng.float(0.10, 0.18);
      this.bg.setFillStyle(hsvToHex(hue, sat, val));

      const room = window.RoomGenerator.generateRoom(roomNumber, this.sessionSeed);
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

      // Save a checkpoint when entering every 10th level. Death sends the
      // player back to the most recent checkpoint instead of level 1.
      if (roomNumber % 10 === 0) {
        window.STICK_CHECKPOINT = {
          roomNumber: roomNumber,
          seed: this.sessionSeed,
          gold: this.player.gold,
          weapon: this.player.weapon,
        };
        this.showCheckpointBanner();
      }

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
            const fill = (r === this.rows - 1 || isWallOrCeiling) ? 0x4a3522 : 0x6f4e2c;
            const rect = this.add.rectangle(x, y, w, TILE, fill);
            rect.setStrokeStyle(2, 0x2a1a0a);
            this.physics.add.existing(rect, true);
            this.platformsGroup.add(rect);
            runStart = -1;
          }
        }
      }

      this.player.teleport(room.playerSpawn.x, room.playerSpawn.y);
      this.player.sprite.body.setVelocity(0, 0);

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
          if (this.roomNumber >= TOTAL_ROOMS) {
            this.scene.start('WinScene');
          } else {
            this.scene.start('GameScene', {
              roomNumber: this.roomNumber + 1,
              hearts: this.player.hearts,
              seed: this.sessionSeed,
              gold: this.player.gold,
              weapon: this.player.weapon,
              speedUntil: this.player.speedUntil,
            });
          }
        });
      });

      // Bonus chest door — only on every 10th level.
      if (room.bonusDoorPos) {
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
      if (isSuperBoss) {
        lvlSuffix = '  ** SUPER **';
        lvlColor = '#ff5050';
      } else if (isBoss) {
        lvlSuffix = '  * BOSS *';
        lvlColor = '#ff9a3c';
      }
      this.hudRoomText.setText(`LVL ${roomNumber} / ${TOTAL_ROOMS}${lvlSuffix}`);
      this.hudRoomText.setColor(lvlColor);

      // Fresh 2-minute timer for this level.
      this.timeLeftMs = 120000;
      this.timeUpTriggered = false;

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
        if (this.roomNumber >= TOTAL_ROOMS) {
          this.scene.start('WinScene');
        } else {
          this.scene.start('GameScene', {
            roomNumber: this.roomNumber + 1,
            hearts: this.player.hearts,
            seed: this.sessionSeed,
            gold: this.player.gold,
            weapon: this.player.weapon,
            speedUntil: this.player.speedUntil,
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
      const panel = this.add.rectangle(w / 2, h / 2, 620, 440, 0x1a1d28, 0.97);
      panel.setStrokeStyle(3, 0xf4d35e);
      const title = this.add.text(w / 2, h / 2 - 190, 'SHOP', {
        fontFamily: 'monospace', fontSize: '34px', color: '#f4d35e', fontStyle: 'bold',
      }).setOrigin(0.5);

      this.shopGoldText = this.add.text(w / 2, h / 2 - 150, '', {
        fontFamily: 'monospace', fontSize: '18px', color: '#f4d35e',
      }).setOrigin(0.5);

      this.shopItems = [
        { key: 'heal',  hotkey: '1', name: 'Healing Potion', desc: 'restore all hearts',          price: 30 },
        { key: 'speed', hotkey: '2', name: 'Speed Potion',   desc: '2.5x speed for 20s',          price: 60 },
        { key: 'poky',  hotkey: '3', name: 'Poky Stick',     desc: '3-hit kill weapon (perm)',    price: 120 },
        { key: 'skip',  hotkey: '4', name: 'Skip Level',     desc: 'advance immediately',         price: 20 },
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

      const hint = this.add.text(w / 2, h / 2 + 190, 'press 1/2/3/4 to buy   E or ESC to close', {
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
        const owned = t.item.key === 'poky' && this.player.weapon === 'poky';
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
      if (item.key === 'poky' && this.player.weapon === 'poky') return; // already owned
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
      } else if (item.key === 'skip') {
        this.refreshGoldHud();
        this.closeShop();
        this.transitioning = true;
        this.cameras.main.flash(220, 180, 80, 200);
        this.time.delayedCall(180, () => {
          if (this.roomNumber >= TOTAL_ROOMS) {
            this.scene.start('WinScene');
          } else {
            this.scene.start('GameScene', {
              roomNumber: this.roomNumber + 1,
              hearts: this.player.hearts,
              seed: this.sessionSeed,
              gold: this.player.gold,
              weapon: this.player.weapon,
              speedUntil: this.player.speedUntil,
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
        }
        return;
      }
      if (Phaser.Input.Keyboard.JustDown(this.controls.shop)) {
        this.openShop();
        return;
      }

      this.updateMovingPlatforms();
      this.player.update(time, this.controls);
      for (const e of this.enemies) e.update();

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
        if (this.roomNumber >= TOTAL_ROOMS) {
          this.scene.start('WinScene');
        } else {
          this.scene.start('GameScene', {
            roomNumber: this.roomNumber + 1,
            hearts: this.player.hearts,
            seed: this.sessionSeed,
            gold: this.player.gold,
            weapon: this.player.weapon,
            speedUntil: this.player.speedUntil,
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
          this.scene.start('GameOverScene', { roomNumber: this.roomNumber });
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
      this.roomNumber = data && data.roomNumber ? data.roomNumber : 1;
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
      this.add.text(w / 2, 260, `made it to level ${this.roomNumber} of ${TOTAL_ROOMS}`, {
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
          });
        } else {
          const seed = (Math.random() * 0x7fffffff) >>> 0;
          this.scene.start('GameScene', { roomNumber: 1, hearts: 3, seed });
        }
      };
      const freshRun = () => {
        window.STICK_CHECKPOINT = null;
        const seed = (Math.random() * 0x7fffffff) >>> 0;
        this.scene.start('GameScene', { roomNumber: 1, hearts: 3, seed });
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
