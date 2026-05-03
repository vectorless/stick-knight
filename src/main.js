(function () {
  const config = {
    type: Phaser.AUTO,
    width: 960,
    height: 544,
    parent: 'game',
    backgroundColor: '#0b0d12',
    pixelArt: false,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 900 },
        debug: false,
      },
    },
    scene: [
      window.TitleScene,
      window.GameScene,
      window.GameOverScene,
      window.WinScene,
    ],
  };

  new Phaser.Game(config);
})();
