const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../SkerrySDK.js');
const {Game, GameWorld, VoxelVolume, ElevationAtlas, TerrariumAtlas} = globalThis.SKERRY;

async function verify() {
  const game = {world: new GameWorld(), streams: new Set(), upload: async mesh => mesh.parts, release() {}};
  const physics = game.world.enablePhysics({});
  const volume = new VoxelVolume(8, 4, 4, {chunk: 4, cell: 1, materials: [{color: [.3,.4,.5], rough: .8, metal: 0}]});
  volume.brush([0,0,0], [7,3,3], () => 1);
  volume.mount(game, [0,0,0], physics);
  await volume.flush();
  assert.equal(physics.bodies.length, 2);
  const ray = [[-1,1.5,1.5], [1,0,0], 20];
  assert.equal(volume.raycast(...ray).distance, 1);
  assert.equal(physics.raycast(...ray).distance, 1);
  assert.equal(volume.brush([0,1,1], [7,1,1], () => 0), 8);
  await volume.flush();
  assert.equal(volume.raycast(...ray), null);
  assert.equal(physics.raycast(...ray), null);
  volume.dispose();
  assert.equal(physics.bodies.length, 0);
  for (const [name, width] of [['mobile',1280], ['aa',1920], ['ultra',3840]]) {
    Game.prototype.setProfile.call(game, name);
    assert.equal(game.widthLimit, width);
  }
  assert.throws(() => Game.prototype.setProfile.call(game, 'unknown'));
  const file = new Blob([fs.readFileSync(path.join(__dirname, '../assets/Jacksboro.skdem'))]);
  const atlas = await ElevationAtlas.open(file);
  const [a,b] = await Promise.all([atlas.tile(1,0,0), atlas.tile(1,1,0)]);
  for (let row = 0; row <= 32; row++) assert.equal(a[row*33+32], b[row*33]);
  await assert.rejects(ElevationAtlas.open(file.slice(0,-1)));
  const pixels = new Uint8ClampedArray(256*256*4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([128,73,128,255],i);
  const remote = new TerrariumAtlas(0,179.99,{read: async (z,x) => {
    assert(x >= 0 && x < 2**z);
    return pixels;
  }});
  assert((await remote.tile(0,0,0)).every(h => h === 73.5));
  console.log('OK: quality profiles, voxel surface and collision cut, collider cleanup, DEM seams, truncation, Terrarium decode and longitude wrap.');
}
verify().catch(e => { console.error(e); process.exitCode = 1; });
