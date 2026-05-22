(function (SILBOT) {
  const { buildCavityMap } = SILBOT.Lattice;
  const { createScene } = SILBOT.SceneSetup;
  const { buildStructure } = SILBOT.Structure;

  function init() {
    const container = document.getElementById('canvas-container');
    const { scene, camera, renderer, controls } = createScene(container);

    const { cavityMap, entryNodes } = buildCavityMap();

    // Pass entryNodes to simulator for funnel placement
    const simulator = new SILBOT.Simulator({ scene, cavityMap, entryNodes });
    
    // Store reference to structure mesh for Raycasting
    simulator.structureMesh = buildStructure(scene, cavityMap, simulator.sphereGeo);

    // Pass camera to UI for Raycasting
    const ui = SILBOT.UI.setup(simulator, camera, {
      stepEl: document.getElementById('sim-step'),
      countEl: document.getElementById('agent-count'),
    });

    const clock = new THREE.Clock();
    function frame() {
      requestAnimationFrame(frame);
      simulator.update(clock.getDelta());
      ui.refresh();
      controls.update();
      renderer.render(scene, camera);
    }
    frame();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.SILBOT);