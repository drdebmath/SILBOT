(function (SILBOT) {
  const { BLOCK, COLORS } = SILBOT.Config;
  const { gridToWorld, key, cavityProfile } = SILBOT.Lattice;

  function collectSolidNodes(cavityMap) {
    const nodes = [];
    for (let z = 0; z < BLOCK.depth; z++) {
      const profile = cavityProfile(z);
      for (let y = 0; y < BLOCK.height; y++) {
        for (let x = 0; x < BLOCK.width; x++) {
          if (cavityMap.has(key(x, y, z))) continue;
          const dx = Math.abs(x - profile.centerX);
          if (y > profile.centerY && dx < profile.radius + 0.5) continue;
          const isCutEdge = y > profile.centerY && dx >= profile.radius + 0.5 && dx <= profile.radius + 1.5;
          nodes.push({ x, y, z, isCutEdge });
        }
      }
    }
    return nodes;
  }

  function isAdjacentToCavity(node, cavityMap) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (cavityMap.has(key(node.x + dx, node.y + dy, node.z + dz))) return true;
        }
      }
    }
    return false;
  }

  function colorFor(node, cavityMap) {
    const color = new THREE.Color(COLORS.structure);
    if (isAdjacentToCavity(node, cavityMap)) color.setHex(COLORS.wall);
    if (node.y >= BLOCK.height - 2) color.setHex(COLORS.top);
    if (node.isCutEdge) color.setHex(COLORS.cutEdge);
    return color;
  }

  function buildStructure(scene, cavityMap, sphereGeo) {
    const nodes = collectSolidNodes(cavityMap);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.1 });
    const mesh = new THREE.InstancedMesh(sphereGeo, material, nodes.length);
    const dummy = new THREE.Object3D();
    
    nodes.forEach((node, i) => {
      dummy.position.copy(gridToWorld(node.x, node.y, node.z));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, colorFor(node, cavityMap));
    });

    mesh.userData.nodes = nodes; // Required for Raycaster mapping
    scene.add(mesh);
    return mesh;
  }

  SILBOT.Structure = { buildStructure };
})(window.SILBOT);