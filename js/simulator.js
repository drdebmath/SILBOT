(function (SILBOT) {
  const { SPHERE_RADIUS, CHANNEL_COLORS } = SILBOT.Config;
  const { key, gridToWorld } = SILBOT.Lattice;

  // Directions a particle prefers to move (downwards into the cavity +z)
  const FALL_SHIFTS = [[0, 0, 1], [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1]];

  class Simulator {
    constructor({ scene, cavityMap, entryNodes }) {
      this.scene = scene;
      this.cavityMap = cavityMap;
      this.entryNodes = entryNodes;
      this.agents = [];
      this.occupancyMap = new Map();
      this.funnels = [];
      this.isAutoFilling = false;
      this.spawnTimer = 0;
      this.solidifiedCount = 0;
      this.structureMesh = null; // Set from main.js
      this.sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 16, 16);
      
      this.funnelGeo = new THREE.ConeGeometry(0.8, 1.5, 16);
      this.funnelGeo.rotateX(Math.PI); // Point downwards
      this.funnelMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });
    }

    placeFunnel(worldPoint) {
      // Find closest entry node to the clicked point
      let closestNode = null;
      let minDist = Infinity;
      
      this.entryNodes.forEach(node => {
        const nodeWorld = gridToWorld(node.x, node.y, node.z);
        const dist = nodeWorld.distanceTo(worldPoint);
        if (dist < minDist) {
          minDist = dist;
          closestNode = node;
        }
      });

      if (closestNode && !this.funnels.some(f => f.x === closestNode.x && f.y === closestNode.y)) {
        this.funnels.push(closestNode);
        
        // Add visual funnel object
        const funnelMesh = new THREE.Mesh(this.funnelGeo, this.funnelMat);
        const funnelPos = gridToWorld(closestNode.x, closestNode.y, closestNode.z);
        funnelMesh.position.set(funnelPos.x, funnelPos.y + 1, funnelPos.z);
        this.scene.add(funnelMesh);
      }
    }

    toggleAutoFill(state) {
      this.isAutoFilling = state;
    }

    injectParticle(node) {
      const spawnKey = key(node.x, node.y, node.z);
      
      // If the funnel mouth is blocked, push the blocking particle to make room
      if (this.occupancyMap.has(spawnKey)) {
         const blocker = this.occupancyMap.get(spawnKey);
         if (blocker.isIdle()) {
            this.triggerPush(blocker);
         }
         return; // Wait for it to clear before spawning a new one
      }

      // Pick a random vibrant color for the new particle
      const color = CHANNEL_COLORS[Math.floor(Math.random() * CHANNEL_COLORS.length)];

      const agent = new SILBOT.Agent({
        x: node.x, y: node.y, z: node.z,
        color: color,
        sphereGeo: this.sphereGeo,
        scene: this.scene,
        simulator: this
      });
      
      this.occupancyMap.set(spawnKey, agent);
      this.agents.push(agent);
      
      // Immediately tell it to start moving down
      this.triggerPush(agent);
    }

    triggerPush(agent) {
      if (!agent.isIdle()) return;

      // Find the next viable node deeper into the cavity
      for (const [dx, dy, dz] of FALL_SHIFTS) {
        const nx = agent.x + dx;
        const ny = agent.y + dy;
        const nz = agent.z + dz;
        
        if (this.cavityMap.has(key(nx, ny, nz))) {
            agent.beginExpansion(nx, ny, nz);
            return;
        }
      }
    }

    canMoveFurther(x, y, z) {
      // Check if there are any available cavity nodes deeper down
      for (const [dx, dy, dz] of FALL_SHIFTS) {
        if (this.cavityMap.has(key(x + dx, y + dy, z + dz))) return true;
      }
      return false;
    }

    makeSolid(agent) {
      agent.solidify();
      
      // Remove from cavity map so it acts as a wall boundary for others
      const agentKey = key(agent.x, agent.y, agent.z);
      this.cavityMap.delete(agentKey);
      this.occupancyMap.delete(agentKey);
      
      // Remove from active update loop
      this.agents = this.agents.filter(a => a !== agent);
      this.solidifiedCount++;
    }

    update(deltaTime) {
      // Auto-fill logic: Spawn a particle every 0.8 seconds per funnel
      if (this.isAutoFilling && this.funnels.length > 0) {
        this.spawnTimer += deltaTime;
        if (this.spawnTimer >= 0.8) {
          this.spawnTimer = 0;
          this.funnels.forEach(f => this.injectParticle(f));
        }
      }

      this.agents.forEach((a) => a.update(deltaTime));
    }
  }

  SILBOT.Simulator = Simulator;
})(window.SILBOT);