(function (SILBOT) {
  const { SPHERE_RADIUS, CHANNEL_COLORS, BLOCK } = SILBOT.Config;
  const { key, gridToWorld } = SILBOT.Lattice;

  class Simulator {
    constructor({ scene, cavityMap }) {
      this.scene = scene;
      this.cavityMap = cavityMap;
      this.agents = [];
      this.occupancyMap = new Map();
      this.wallMap = new Set();
      this.funnels = [];
      this.isAutoFilling = false;
      this.spawnTimer = 0;
      this.solidifiedCount = 0;
      this.structureMesh = null;
      this.logger = () => {}; // Default empty logger
      this.sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 16, 16);

      this.funnelGeo = new THREE.ConeGeometry(0.8, 1.5, 16);
      this.funnelGeo.rotateX(Math.PI);
      this.funnelMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });
    }

    setLogger(loggerFunc) {
      this.logger = loggerFunc;
    }

    placeFunnelAtNode(node) {
      if (this.funnels.some(f => f.x === node.x && f.z === node.z)) return;
      this.funnels.push(node);
      const funnelMesh = new THREE.Mesh(this.funnelGeo, this.funnelMat);
      const funnelPos = gridToWorld(node.x, node.y, node.z);
      funnelMesh.position.set(funnelPos.x, funnelPos.y + 1.5, funnelPos.z);
      this.scene.add(funnelMesh);

      this.logger(`Funnel placed at Grid(${node.x}, ${node.y}, ${node.z})`);
    }

    toggleAutoFill(state) {
      this.isAutoFilling = state;
    }

    isNodeBlocked(nodeKey, movingAgent = null, allowVacatingTarget = false) {
      if (this.wallMap.has(nodeKey)) return true;

      const occupant = this.occupancyMap.get(nodeKey);
      if (!occupant || occupant === movingAgent) return false;
      const occupantTargetKey = key(occupant.targetX, occupant.targetY, occupant.targetZ);
      if (allowVacatingTarget && !occupant.isIdle() && occupantTargetKey !== nodeKey) return false;

      return true;
    }

    createAgentAt(x, y, z) {
      const agentKey = key(x, y, z);
      if (this.isNodeBlocked(agentKey)) return null;

      const color = CHANNEL_COLORS[Math.floor(Math.random() * CHANNEL_COLORS.length)];
      const agent = new SILBOT.Agent({
        x, y, z, color,
        sphereGeo: this.sphereGeo, scene: this.scene, simulator: this
      });
      this.occupancyMap.set(agentKey, agent);
      this.agents.push(agent);
      return agent;
    }

    injectParticle(funnelNode) {
      const spawnY = funnelNode.y + 1;
      const spawnKey = key(funnelNode.x, spawnY, funnelNode.z);
      if (this.wallMap.has(spawnKey)) return;

      const blockingAgent = this.occupancyMap.get(spawnKey);
      if (!blockingAgent) {
        this.createAgentAt(funnelNode.x, spawnY, funnelNode.z);
        return;
      }

      const feedY = spawnY + 1;
      if (this.isNodeBlocked(key(funnelNode.x, feedY, funnelNode.z))) return;
      if (!this.triggerPush(blockingAgent)) return;

      const agent = this.createAgentAt(funnelNode.x, feedY, funnelNode.z);
      if (!agent) return;
      agent.beginExpansion(funnelNode.x, spawnY, funnelNode.z, false, true);
    }

    triggerPush(agent, visited = new Set()) {
      if (!agent || !agent.isIdle()) return false;

      const agentKey = key(agent.x, agent.y, agent.z);
      if (visited.has(agentKey)) return false;
      visited.add(agentKey);

      const target = this.findMoveTarget(agent);
      if (!target) {
        if (!this.canMoveFurther(agent)) {
          this.makeSolid(agent);
        }
        return false;
      }

      const targetKey = key(target.x, target.y, target.z);
      if (this.wallMap.has(targetKey)) return false;

      const blockingAgent = this.occupancyMap.get(targetKey);
      if (blockingAgent && blockingAgent !== agent) {
        this.triggerPush(blockingAgent, visited);
        if (this.occupancyMap.has(targetKey)) return false;
      }

      return agent.beginExpansion(target.x, target.y, target.z, target.isFalling);
    }

    findMoveTarget(agent) {
      const straightDownKey = key(agent.x, agent.y - 1, agent.z);
      if (this.cavityMap.has(straightDownKey)) {
          return { x: agent.x, y: agent.y - 1, z: agent.z, isFalling: true };
      }

      const DIAG_FALLS = [[0, -1, 1], [0, -1, -1], [1, -1, 0], [-1, -1, 0]];
      for (const [dx, dy, dz] of DIAG_FALLS) {
        const targetKey = key(agent.x + dx, agent.y + dy, agent.z + dz);
        if (this.cavityMap.has(targetKey)) {
            return { x: agent.x + dx, y: agent.y + dy, z: agent.z + dz, isFalling: true };
        }
      }

      if (agent.y >= BLOCK.height - 2) {
         const trenchX = Math.floor(BLOCK.width / 2);
         if (Math.abs(agent.x - trenchX) > 0.5) {
             const dirX = Math.sign(trenchX - agent.x);
             const targetKey = key(agent.x + dirX, agent.y, agent.z);
             if (!this.wallMap.has(targetKey)) {
                 return { x: agent.x + dirX, y: agent.y, z: agent.z, isFalling: false };
             }
         } else {
             const targetKey = key(agent.x, agent.y, agent.z + 1);
             if (agent.z + 1 < BLOCK.depth && !this.wallMap.has(targetKey)) {
                 return { x: agent.x, y: agent.y, z: agent.z + 1, isFalling: false };
             }
         }
         return null;
      }

      let isMidAir = false;
      if (this.cavityMap.has(straightDownKey)) isMidAir = true;
      for (const [dx, dy, dz] of DIAG_FALLS) {
         if (this.cavityMap.has(key(agent.x + dx, agent.y + dy, agent.z + dz))) isMidAir = true;
      }
      if (isMidAir) return null;

      const HORIZ_MOVES = [
          [0, 0, agent.prefDirZ], [0, 0, -agent.prefDirZ],
          [agent.prefDirX, 0, 0], [-agent.prefDirX, 0, 0]
      ];
      for (const [dx, dy, dz] of HORIZ_MOVES) {
        const targetKey = key(agent.x + dx, agent.y + dy, agent.z + dz);
        if (targetKey !== agent.lastKey && this.cavityMap.has(targetKey)) {
            return { x: agent.x + dx, y: agent.y + dy, z: agent.z + dz, isFalling: false };
        }
      }

      return null;
    }

    canMoveFurther(agent) {
      if (agent.y >= BLOCK.height - 2) return true;

      const DOWN_MOVES = [[0, -1, 0], [0, -1, 1], [0, -1, -1], [1, -1, 0], [-1, -1, 0]];
      const HORIZ_MOVES = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0]];

      for (const [dx, dy, dz] of DOWN_MOVES) {
         if (this.cavityMap.has(key(agent.x + dx, agent.y + dy, agent.z + dz))) return true;
      }

      for (const [dx, dy, dz] of HORIZ_MOVES) {
          const targetKey = key(agent.x + dx, agent.y + dy, agent.z + dz);
          if (targetKey !== agent.lastKey && this.cavityMap.has(targetKey)) return true;
      }
      return false;
    }

    makeSolid(agent) {
      agent.solidify();
      const agentKey = key(agent.x, agent.y, agent.z);
      this.cavityMap.delete(agentKey);
      this.wallMap.add(agentKey);
      for (const [nodeKey, occupant] of this.occupancyMap) {
        if (occupant === agent) this.occupancyMap.delete(nodeKey);
      }
      this.agents = this.agents.filter(a => a !== agent);
      this.solidifiedCount++;

      // Log milestone to avoid spamming the log every single time
      if (this.solidifiedCount % 10 === 0) {
          this.logger(`Milestone: ${this.solidifiedCount} particles solidified.`);
      }
    }

    update(deltaTime) {
      if (this.isAutoFilling && this.funnels.length > 0) {
        this.spawnTimer += deltaTime;
        if (this.spawnTimer >= 0.3) {
          this.spawnTimer = 0;
          this.funnels.forEach(f => this.injectParticle(f));
        }
      }

      [...this.agents].forEach((a) => {
         a.update(deltaTime);
         if (a.isIdle() && !this.canMoveFurther(a)) {
             this.makeSolid(a);
         }
      });
    }
  }

  SILBOT.Simulator = Simulator;
})(window.SILBOT);
