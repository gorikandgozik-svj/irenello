// Project entry point. Attach game systems, load a scene manifest or add geometry here.
const game=new SKERRY.Game(document.querySelector('canvas'),{physicsHz:120});
game.world.camera=SKERRY.basis([3,2,5],[0,0,0]);
game.start();
