(function (SILBOT) {
  function setup(simulator, camera, stats) {
    const btnAutoFill = document.getElementById('btn-autofill');
    const eventLog = document.getElementById('event-log');
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isAutoFilling = false;

    // The Logger Function
    function logMessage(message) {
      const time = new Date().toLocaleTimeString('en-US', { hour12: false });
      const div = document.createElement('div');
      div.className = 'log-entry';
      div.innerHTML = `<span class="log-time">[${time}]</span> ${message}`;
      eventLog.appendChild(div);
      // Auto-scroll to bottom
      eventLog.scrollTop = eventLog.scrollHeight;
    }

    // Attach logger to simulator
    simulator.setLogger(logMessage);
    logMessage("System initialized. Awaiting input...");

    window.addEventListener('pointerdown', (event) => {
      if (isAutoFilling || event.target.tagName !== 'CANVAS') return;

      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      
      const intersects = raycaster.intersectObject(simulator.structureMesh);
      if (intersects.length > 0) {
        const instanceId = intersects[0].instanceId;
        if (instanceId !== undefined) {
          const clickedNode = simulator.structureMesh.userData.nodes[instanceId];
          if (clickedNode && clickedNode.y >= SILBOT.Config.BLOCK.height - 2) {
             simulator.placeFunnelAtNode(clickedNode);
             btnAutoFill.disabled = false;
             btnAutoFill.style.backgroundColor = "#10b981"; // Green
          }
        }
      }
    });

    btnAutoFill.addEventListener('click', () => {
      isAutoFilling = !isAutoFilling;
      simulator.toggleAutoFill(isAutoFilling);
      
      if (isAutoFilling) {
        logMessage("Auto-fill started. Injecting particles...");
        btnAutoFill.innerText = "Stop Auto-Fill";
        btnAutoFill.style.backgroundColor = "#ef4444";
      } else {
        logMessage("Auto-fill stopped.");
        btnAutoFill.innerText = "Start Auto-Fill";
        btnAutoFill.style.backgroundColor = "#10b981";
      }
    });

    function refresh() {
      stats.stepEl.innerText = simulator.solidifiedCount;
      stats.countEl.innerText = simulator.agents.length;
    }

    return { refresh };
  }

  SILBOT.UI = { setup };
})(window.SILBOT);