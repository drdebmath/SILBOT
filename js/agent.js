(function (SILBOT) {
  const { AGENT_SPEED, COLORS } = SILBOT.Config;
  const { gridToWorld, key, easeInOutCubic } = SILBOT.Lattice;

  const State = Object.freeze({
    CONTRACTED: 'CONTRACTED', EXPANDING: 'EXPANDING', CONTRACTING: 'CONTRACTING', SOLIDIFIED: 'SOLIDIFIED'
  });

  class Agent {
    constructor({ x, y, z, color, sphereGeo, scene, simulator }) {
      this.x = x; this.y = y; this.z = z;
      this.targetX = x; this.targetY = y; this.targetZ = z;
      this.state = State.CONTRACTED;
      this.progress = 0;
      this.speedMultiplier = 1.0;
      this.prefDirZ = Math.random() > 0.5 ? 1 : -1;
      this.prefDirX = Math.random() > 0.5 ? 1 : -1;
      this.lastKey = null;
      this.simulator = simulator;
      this.scene = scene;

      this.material = new THREE.MeshStandardMaterial({ color: color, roughness: 0.2, metalness: 0.3 });
      this.mesh = new THREE.Mesh(sphereGeo, this.material);
      this.group = new THREE.Group();
      this.group.add(this.mesh);
      this.group.position.copy(gridToWorld(x, y, z));
      scene.add(this.group);
    }

    isIdle() { return this.state === State.CONTRACTED; }

    beginExpansion(targetX, targetY, targetZ, isFalling = false, allowVacatingTarget = false) {
      if (this.state !== State.CONTRACTED) return false;

      const targetKey = key(targetX, targetY, targetZ);
      if (this.simulator.isNodeBlocked(targetKey, this, allowVacatingTarget)) return false;

      this.state = State.EXPANDING;
      this.lastKey = isFalling ? null : key(this.x, this.y, this.z);
      this.targetX = targetX; this.targetY = targetY; this.targetZ = targetZ;
      this.progress = 0;
      this.speedMultiplier = isFalling ? 5.0 : 1.2;
      this.simulator.occupancyMap.set(targetKey, this);
      return true;
    }

    solidify() {
      this.state = State.SOLIDIFIED;
      // Adopts the exact internal wall color when filling the cavity
      this.material.color.setHex(COLORS.wall);
      this.material.roughness = 0.9;
      this.material.metalness = 0.1;
      this.mesh.scale.set(1, 1, 1);
      this.group.position.copy(gridToWorld(this.x, this.y, this.z));
    }

    update(deltaTime) {
      if (this.state === State.SOLIDIFIED) return;
      this.advancePhase(deltaTime);
      this.renderPose();
    }

    advancePhase(deltaTime) {
      if (this.state === State.CONTRACTED) return;
      this.progress += deltaTime * AGENT_SPEED * this.speedMultiplier;
      if (this.progress < 1.0) return;

      this.progress = 0;
      if (this.state === State.EXPANDING) {
        this.state = State.CONTRACTING;
        const oldKey = key(this.x, this.y, this.z);
        if (this.simulator.occupancyMap.get(oldKey) === this) {
          this.simulator.occupancyMap.delete(oldKey);
        }
        this.x = this.targetX; this.y = this.targetY; this.z = this.targetZ;
        this.simulator.occupancyMap.set(key(this.x, this.y, this.z), this);
      } else {
        this.state = State.CONTRACTED;
      }
    }

    renderPose() {
      const start = gridToWorld(this.x, this.y, this.z);
      const end = gridToWorld(this.targetX, this.targetY, this.targetZ);
      const distance = start.distanceTo(end);
      const eased = easeInOutCubic(this.progress);

      if (this.state === State.EXPANDING) {
        this.stretch(start, end, eased * 0.5, eased, distance);
      } else if (this.state === State.CONTRACTING) {
        this.stretch(start, end, 0.5 + eased * 0.5, 1 - eased, distance);
      } else {
        this.group.position.copy(start);
        this.mesh.scale.set(1, 1, 1);
        this.group.rotation.set(0, 0, 0);
      }
    }

    stretch(start, end, lerpT, stretchT, distance) {
      const pos = new THREE.Vector3().lerpVectors(start, end, lerpT);
      this.group.position.copy(pos);
      if (distance > 0.01) this.group.lookAt(end);
      const stretchZ = 1 + distance * stretchT;
      const squeezeXY = 1 - stretchT * 0.15;
      this.mesh.scale.set(squeezeXY, squeezeXY, stretchZ);
    }
  }

  SILBOT.Agent = Agent;
  SILBOT.AgentState = State;
})(window.SILBOT);
