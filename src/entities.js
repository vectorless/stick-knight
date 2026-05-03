(function () {
  const PLAYER_SPEED = 200;
  const JUMP_VELOCITY = -480;
  const JUMP_CUT = -180;
  const WALL_JUMP_X = 280;
  const WALL_JUMP_Y = -460;
  const WALL_JUMP_LOCK = 160;
  const WALL_SLIDE_MAX_FALL = 110;
  const ATTACK_DURATION = 150;
  const ATTACK_COOLDOWN = 300;
  const KNOCKBACK_X = 220;
  const KNOCKBACK_Y = -250;
  const INVULN_DURATION = 800;

  class Player {
    constructor(scene, x, y) {
      this.scene = scene;
      this.sprite = scene.add.rectangle(x, y, 24, 32, 0x4dc4ff);
      this.sprite.setStrokeStyle(2, 0x1d6e96);
      scene.physics.add.existing(this.sprite);
      const body = this.sprite.body;
      body.setCollideWorldBounds(true);
      body.setMaxVelocity(600, 800);

      this.facing = 1;
      this.hearts = 3;
      this.invulnerable = false;
      this.attackActiveUntil = 0;
      this.nextAttackAt = 0;
      this.wallJumpLockUntil = 0;
      this.alive = true;
      this.gold = 0;
      this.weapon = 'stick';            // 'stick' | 'poky'
      this.speedUntil = 0;              // Date.now() ms timestamp
      this.hitEnemiesThisSwing = new Set();

      this.attackHitbox = scene.add.rectangle(x, y, 34, 18, 0xfff0a0, 0.0);
      scene.physics.add.existing(this.attackHitbox);
      this.attackHitbox.body.setAllowGravity(false);
      this.attackHitbox.body.setImmovable(true);
      this.attackHitbox.body.enable = false;
      this.attackHitbox.setVisible(false);

      this.stickSprite = scene.add.rectangle(x, y, 26, 6, 0xc9a36b);
      this.stickSprite.setStrokeStyle(1, 0x5b3e1a);
      this.stickSprite.setVisible(false);
    }

    update(time, controls) {
      if (!this.alive) return;
      const body = this.sprite.body;

      const left = controls.left.isDown || controls.a.isDown;
      const right = controls.right.isDown || controls.d.isDown;

      const onGround = body.blocked.down || body.touching.down;
      const onWallLeft = body.blocked.left && !onGround;
      const onWallRight = body.blocked.right && !onGround;
      const inputLocked = time < this.wallJumpLockUntil;

      const speedMult = (Date.now() < this.speedUntil) ? 2.5 : 1;
      const moveSpeed = PLAYER_SPEED * speedMult;
      if (!inputLocked) {
        if (left && !right) {
          body.setVelocityX(-moveSpeed);
          this.facing = -1;
        } else if (right && !left) {
          body.setVelocityX(moveSpeed);
          this.facing = 1;
        } else {
          body.setVelocityX(0);
        }
      }
      // Visual cue: tint player pink while speed boost is active.
      const boosting = speedMult > 1;
      const targetColor = boosting ? 0xff66cc : 0x4dc4ff;
      if (this.sprite.fillColor !== targetColor) {
        this.sprite.setFillStyle(targetColor);
      }

      // Wall slide: when pressed against a wall and falling, cap the fall speed.
      const slidingLeft = onWallLeft && left;
      const slidingRight = onWallRight && right;
      if ((slidingLeft || slidingRight) && body.velocity.y > WALL_SLIDE_MAX_FALL) {
        body.setVelocityY(WALL_SLIDE_MAX_FALL);
      }

      const jumpPressed =
        Phaser.Input.Keyboard.JustDown(controls.up) ||
        Phaser.Input.Keyboard.JustDown(controls.w) ||
        Phaser.Input.Keyboard.JustDown(controls.space);

      if (jumpPressed) {
        if (onGround) {
          body.setVelocityY(JUMP_VELOCITY);
        } else if (onWallLeft || onWallRight) {
          const pushDir = onWallLeft ? 1 : -1;
          body.setVelocity(pushDir * WALL_JUMP_X, WALL_JUMP_Y);
          this.wallJumpLockUntil = time + WALL_JUMP_LOCK;
          this.facing = pushDir;
        }
      }

      const jumpHeld =
        controls.up.isDown || controls.w.isDown || controls.space.isDown;
      if (!jumpHeld && body.velocity.y < JUMP_CUT) {
        body.setVelocityY(JUMP_CUT);
      }

      const mouseAttack = this.scene.consumeAttackClick && this.scene.consumeAttackClick();
      const attackPressed =
        mouseAttack ||
        Phaser.Input.Keyboard.JustDown(controls.j) ||
        Phaser.Input.Keyboard.JustDown(controls.x);
      if (attackPressed && time >= this.nextAttackAt) {
        this.startAttack(time);
      }

      if (time < this.attackActiveUntil) {
        const hx = this.sprite.x + this.facing * 22;
        const hy = this.sprite.y + 2;
        this.attackHitbox.body.reset(hx, hy);
        this.attackHitbox.x = hx;
        this.attackHitbox.y = hy;
        this.stickSprite.x = hx;
        this.stickSprite.y = hy;
      } else if (this.attackHitbox.body.enable) {
        this.attackHitbox.body.enable = false;
        this.attackHitbox.setVisible(false);
        this.stickSprite.setVisible(false);
      }
    }

    startAttack(time) {
      this.attackActiveUntil = time + ATTACK_DURATION;
      this.nextAttackAt = time + ATTACK_COOLDOWN;
      this.hitEnemiesThisSwing.clear();
      this.attackHitbox.body.enable = true;
      this.attackHitbox.setVisible(true);
      this.attackHitbox.setFillStyle(0xfff0a0, 0.5);
      this.stickSprite.setVisible(true);
      this.scene.tweens.add({
        targets: this.stickSprite,
        scaleX: { from: 0.5, to: 1.1 },
        duration: ATTACK_DURATION,
      });
    }

    setWeapon(weapon) {
      this.weapon = weapon;
      if (weapon === 'poky') {
        // Poky stick: red-tipped, slightly longer; deals 2 dmg.
        this.stickSprite.setFillStyle(0xc83a3a);
        this.stickSprite.setStrokeStyle(1, 0x6a1010);
      } else {
        this.stickSprite.setFillStyle(0xc9a36b);
        this.stickSprite.setStrokeStyle(1, 0x5b3e1a);
      }
    }

    getDamage() {
      return this.weapon === 'poky' ? 2 : 1;
    }

    takeDamage(time, fromX) {
      if (this.invulnerable || !this.alive) return false;
      this.hearts--;
      this.invulnerable = true;
      const knockDir = this.sprite.x < fromX ? -1 : 1;
      this.sprite.body.setVelocity(knockDir * KNOCKBACK_X, KNOCKBACK_Y);
      this.scene.tweens.add({
        targets: this.sprite,
        alpha: 0.25,
        duration: 100,
        yoyo: true,
        repeat: 3,
      });
      this.scene.time.delayedCall(INVULN_DURATION, () => {
        this.invulnerable = false;
        this.sprite.alpha = 1;
      });
      if (this.hearts <= 0) {
        this.alive = false;
      }
      return true;
    }

    teleport(x, y) {
      this.sprite.body.reset(x, y);
      this.sprite.x = x;
      this.sprite.y = y;
      this.attackHitbox.body.enable = false;
      this.attackHitbox.setVisible(false);
      this.stickSprite.setVisible(false);
    }
  }

  const ENEMY_MAX_HP = 5;

  class Enemy {
    constructor(scene, spawn, speed) {
      this.scene = scene;
      this.sprite = scene.add.rectangle(spawn.x, spawn.y, 28, 28, 0xe44545);
      this.sprite.setStrokeStyle(2, 0x7a1d1d);
      this.sprite.enemyRef = this;
      scene.physics.add.existing(this.sprite);
      this.sprite.body.setCollideWorldBounds(true);
      this.sprite.body.setMaxVelocity(speed * 2, 800);

      this.dir = scene.rng.chance(0.5) ? -1 : 1;
      this.speed = speed;
      this.runR = spawn.runR;
      this.dead = false;
      this.hp = ENEMY_MAX_HP;
      this.stunUntil = 0;
    }

    takeDamage(dmg, knockbackDir) {
      if (this.dead) return false;
      this.hp -= dmg;
      if (this.hp <= 0) {
        this.die();
        return true;
      }
      // Hit feedback: white flash + 2-tile knockback away from the player.
      this.scene.tweens.add({
        targets: this.sprite,
        alpha: 0.35,
        duration: 70,
        yoyo: true,
      });
      const dir = knockbackDir || (this.dir > 0 ? -1 : 1);
      // 2 tiles = 64px. 320 px/s for 200ms covers that distance.
      this.stunUntil = this.scene.time.now + 200;
      this.sprite.body.setVelocity(dir * 320, -180);
      // Flip patrol direction so when the stun ends the enemy walks AWAY
      // rather than charging back into its own knockback.
      this.dir = dir;
      return false;
    }

    update() {
      if (this.dead) return;
      if (this.sprite.y > this.scene.scale.height + 100) {
        this.dead = true;
        this.sprite.destroy();
        return;
      }
      const body = this.sprite.body;

      // Stunned: let the knockback velocity carry the enemy without the
      // AI overwriting it.
      if (this.scene.time.now < this.stunUntil) {
        return;
      }

      body.setVelocityX(this.dir * this.speed);

      const probeX = this.sprite.x + this.dir * 18;
      const probeY = this.sprite.y + 20;
      if (!this.scene.tileSolidAt(probeX, probeY)) {
        this.dir *= -1;
      }
      if (body.blocked.left) this.dir = 1;
      if (body.blocked.right) this.dir = -1;
    }

    die() {
      if (this.dead) return;
      this.dead = true;
      const flash = this.scene.add.rectangle(
        this.sprite.x, this.sprite.y, 36, 36, 0xffffff, 1
      );
      this.scene.tweens.add({
        targets: flash,
        alpha: 0,
        scaleX: 1.8,
        scaleY: 1.8,
        duration: 200,
        onComplete: () => flash.destroy(),
      });
      this.sprite.destroy();
    }

    isAlive() {
      return !this.dead;
    }
  }

  window.Player = Player;
  window.Enemy = Enemy;
})();
