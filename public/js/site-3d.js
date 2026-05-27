(function(){
  // Site-wide 3D background: lightweight particle field + slow parallax
  if(typeof window === 'undefined') return;
  // minimal feature detection
  if(!('WebGLRenderingContext' in window)) return;

  // performance heuristics
  const hardwareConcurrency = navigator.hardwareConcurrency || 2;
  const lowPower = navigator.connection && /2g|slow-2g/.test(navigator.connection.effectiveType || '');
  const memory = navigator.deviceMemory || 4;
  const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // degrade on low devices
  if(hardwareConcurrency <= 2 || memory <= 1 || lowPower) {
    // do nothing expensive; keep existing particles canvas only
    return;
  }

  // load only if container present
  const container = document.getElementById('site-3d');
  if(!container) return;

  // lazy load three if not present
  function loadThree(cb){
    if(window.THREE) return cb();
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/three@0.152.2/build/three.min.js';
    s.onload = cb; s.async = true; s.defer = true;
    document.head.appendChild(s);
  }

  loadThree(()=>{
    if(!window.THREE) return;
    const THREE = window.THREE;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0,0,80);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.zIndex = '0';
    renderer.domElement.style.pointerEvents = 'none';
    container.appendChild(renderer.domElement);

    const resize = ()=>{
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      renderer.setSize(w,h);
      camera.aspect = w/h; camera.updateProjectionMatrix();

      // hide if very small
      if(w < 520) renderer.domElement.style.opacity = 0;
      else renderer.domElement.style.opacity = 1;
    };
    window.addEventListener('resize', resize); resize();

    // soft ambient
    const amb = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(amb);

    // a couple of colored points for subtle tint
    const p1 = new THREE.PointLight(0x22d3ee, 0.35, 300);
    p1.position.set(80,40,80); scene.add(p1);
    const p2 = new THREE.PointLight(0x818cf8, 0.18, 300);
    p2.position.set(-60,-30,60); scene.add(p2);

    // particle cloud
    const particleCount = 140;
    const positions = new Float32Array(particleCount*3);
    for(let i=0;i<particleCount;i++){
      positions[i*3+0] = (Math.random()-0.5)*220;
      positions[i*3+1] = (Math.random()-0.5)*120;
      positions[i*3+2] = (Math.random()-0.5)*180;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
    const mat = new THREE.PointsMaterial({ size: 0.8, color: 0x22d3ee, transparent:true, opacity:0.22 });
    const points = new THREE.Points(geo, mat); scene.add(points);

    // slow-moving planes for volume (two soft sprites)
    const spriteTex = new THREE.TextureLoader().load('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><defs><radialGradient id="g"><stop offset="0" stop-color="white" stop-opacity="1"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(%23g)"/></svg>');
    const spriteMat = new THREE.SpriteMaterial({ map: spriteTex, color: 0x67e8f9, opacity: 0.07, transparent: true });
    const spr1 = new THREE.Sprite(spriteMat); spr1.scale.set(220,120,1); spr1.position.set(0,10,-40); scene.add(spr1);
    const spr2 = new THREE.Sprite(spriteMat); spr2.scale.set(160,80,1); spr2.position.set(-30,-20,-60); scene.add(spr2);

    // mouse parallax
    let mx=0,my=0,tx=0,ty=0;
    window.addEventListener('mousemove', (e)=>{
      const r = container.getBoundingClientRect();
      mx = (e.clientX - r.left)/r.width - 0.5;
      my = (e.clientY - r.top)/r.height - 0.5;
    });

    let last = performance.now();
    function tick(now){
      const dt = Math.min(0.06, (now-last)/1000); last = now;
      tx += (mx - tx) * 0.45; ty += (my - ty) * 0.45;
      camera.position.x = tx * 18; camera.position.y = ty * -10;
      camera.lookAt(0,0,0);

      if(!prefersReduce){
        points.rotation.y += 0.02 * dt;
        spr1.position.x += Math.sin(now*0.0002)*0.02;
        spr2.position.x += Math.cos(now*0.00014)*0.03;
      }

      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // expose a toggle via localStorage
    window.Site3D = {
      disable: ()=>{ renderer.domElement.style.display='none'; },
      enable: ()=>{ renderer.domElement.style.display='block'; }
    };
  });
})();
