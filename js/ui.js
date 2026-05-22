(function (SILBOT) {
  function setup(simulator, camera, stats) {
    const btnAutoFill = document.getElementById('btn-autofill');
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isAutoFilling = false;

    // Handle clicking on the canvas to place a funnel
    window.addEventListener('pointerdown', (event) => {
      if (isAutoFilling || event.target.tagName !== 'CANVAS') return;

      // Calculate mouse position in normalized device coordinates
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      
      // Check intersections with the structure mesh
      const intersects = raycaster.intersectObject(simulator.structureMesh);
      if (intersects.length > 0) {
        // Get instance ID to find the approximate location
        const instanceId = intersects[0].instanceId;
        if (instanceId !== undefined) {
          const point = intersects[0].point;
          simulator.placeFunnel(point);
          btnAutoFill.disabled = false;
          btnAutoFill.style.backgroundColor = "#10b981"; // Green when ready
        }
      }
    });

    btnAutoFill.addEventListener('click', () => {
      isAutoFilling = !isAutoFilling;
      simulator.toggleAutoFill(isAutoFilling);
      btnAutoFill.innerText = isAutoFilling ? "Stop Auto-Fill" : "Start Auto-Fill";
      btnAutoFill.style.backgroundColor = isAutoFilling ? "#ef4444" : "#10b981";
    });

    function refresh() {
      stats.stepEl.innerText = simulator.solidifiedCount;
      stats.countEl.innerText = simulator.agents.length;
    }

    return { refresh };
  }

  SILBOT.UI = { setup };
})(window.SILBOT);