(function (SILBOT) {
  const { LATTICE, BLOCK } = SILBOT.Config;

  function gridToWorld(x, y, z) {
    let worldX = x * LATTICE.DX;
    let worldY = y * LATTICE.DY;
    const worldZ = z * LATTICE.DZ;
    if (y % 2 !== 0) worldX += LATTICE.OFFSET_Y;
    if (z % 2 !== 0) {
      worldX += LATTICE.OFFSET_Z_X;
      worldY += LATTICE.OFFSET_Z_Y;
    }
    return new THREE.Vector3(worldX, worldY, worldZ);
  }

  function key(x, y, z) {
    return `${x},${y},${z}`;
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function cavityProfile(z) {
    return {
      centerX: BLOCK.width / 2 + Math.sin(z * 0.25) * 1.5,
      centerY: BLOCK.height / 2 + Math.cos(z * 0.2) * 1.0,
      radius: 2.2 + Math.sin(z * 0.4) * 0.6,
    };
  }

  function isCavity(x, y, z) {
    if (x <= 1 || x >= BLOCK.width - 2 || y <= 1) return false; 
    const { centerX, centerY, radius } = cavityProfile(z);
    const dx = Math.abs(x - centerX);
    const dy = y - centerY;
    const inSphere = Math.sqrt(dx * dx + dy * dy) < radius;
    const inShaft = y > centerY && dx < radius + 0.5 && y < BLOCK.height;
    return inSphere || inShaft;
  }

  function buildCavityMap() {
    const cavityMap = new Set();
    const entryNodes = [];
    for (let z = 0; z < BLOCK.depth; z++) {
      for (let y = 0; y < BLOCK.height; y++) {
        for (let x = 0; x < BLOCK.width; x++) {
          if (!isCavity(x, y, z)) continue;
          cavityMap.add(key(x, y, z));
          if (z === 0) entryNodes.push({ x, y, z });
        }
      }
    }
    entryNodes.sort((a, b) => a.x - b.x);
    return { cavityMap, entryNodes };
  }

  SILBOT.Lattice = { gridToWorld, key, easeInOutCubic, cavityProfile, isCavity, buildCavityMap };
})(window.SILBOT);