/* 3D gold F4NTASTIC emblem + particle field (Three.js).
   The emblem is a stack of alpha-tested layers built from assets/logo-emblem.webp, which reads as a thick
   machined-metal badge when it rotates. Placement/scale/rotation are driven by the hero scroll progress. */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

export async function createLogo3D({ canvas, texture = "assets/logo-emblem.webp", emblem: showEmblem = true }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  const mobile = matchMedia("(max-width: 720px)").matches;
  const lowEnd = mobile || (navigator.hardwareConcurrency || 8) <= 4;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, lowEnd ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 6);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  /* ---------- Lights: warm key, cool fill, orbiting gold rim ---------- */
  const key = new THREE.DirectionalLight(0xfff1cf, 2.2);
  key.position.set(2.5, 3, 4);
  const fill = new THREE.DirectionalLight(0x9fb4ff, 0.5);
  fill.position.set(-3, -1, 2);
  const rim = new THREE.PointLight(0xf6dd93, 30, 12, 2);
  scene.add(key, fill, rim);

  /* ---------- Emblem ---------- */
  const map = await new THREE.TextureLoader().loadAsync(texture);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const emblem = new THREE.Group();
  const geo = new THREE.PlaneGeometry(2, 2);
  const faceMat = new THREE.MeshStandardMaterial({
    map, alphaTest: 0.5, metalness: 0.78, roughness: 0.26, envMapIntensity: 1.35,
  });
  const edgeMat = new THREE.MeshStandardMaterial({
    map, alphaTest: 0.5, color: 0x6b5120, metalness: 1, roughness: 0.38, envMapIntensity: 1.1, side: THREE.DoubleSide,
  });
  const depth = 0.12;
  const layers = lowEnd ? 16 : 26;
  for (let i = 1; i < layers - 1; i++) {
    const layer = new THREE.Mesh(geo, edgeMat);
    layer.position.z = -depth / 2 + (depth * i) / (layers - 1);
    emblem.add(layer);
  }
  const front = new THREE.Mesh(geo, faceMat);
  front.position.z = depth / 2 + 0.001;
  const back = new THREE.Mesh(geo, faceMat);
  back.position.z = -depth / 2 - 0.001;
  back.rotation.y = Math.PI; // front-face of a flipped plane reads correctly (unmirrored) from behind
  emblem.add(front, back);

  // Soft gold halo behind the badge.
  const haloTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, "rgba(246,221,147,.55)");
    grd.addColorStop(0.35, "rgba(217,180,91,.18)");
    grd.addColorStop(1, "rgba(217,180,91,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 4.2),
    new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  halo.position.z = -0.5;

  const rig = new THREE.Group();
  rig.add(halo, emblem);
  rig.visible = showEmblem; // intro footage already ends on the logo → particles only
  scene.add(rig);

  /* ---------- Particle field ---------- */
  const count = lowEnd ? 650 : 1500;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = 2 + Math.random() * 6;
    const a = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 9;
    positions[i * 3 + 2] = Math.sin(a) * r - 3;
    seeds[i] = Math.random();
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uPixel: { value: renderer.getPixelRatio() },
    },
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float uTime, uProgress, uPixel;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float t = uTime * (0.15 + seed * 0.25);
        p.y = mod(p.y + t + uProgress * 6.0 + 4.5, 9.0) - 4.5;
        float ang = uTime * 0.04 + uProgress * 1.6;
        p.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p.xz;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (6.0 + seed * 10.0) * uPixel / -mv.z;
        vAlpha = (0.35 + 0.65 * (sin(uTime * 2.0 + seed * 40.0) * 0.5 + 0.5)) * smoothstep(9.0, 3.0, -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.55) * a, a * vAlpha * 0.9);
      }`,
  });
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  /* ---------- Interaction & layout ---------- */
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener("pointermove", (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  let viewW = 1, viewH = 1;
  const resize = () => {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    viewH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    viewW = viewH * camera.aspect;
  };
  resize();
  addEventListener("resize", resize);

  // Keyframes in normalised screen space (x: -1..1 left→right, y: -1..1 bottom→top).
  const portrait = () => camera.aspect < 0.9;
  const poses = () =>
    portrait()
      ? { a: { x: 0, y: 0.6, s: Math.min(0.5, viewW * 0.26) }, b: { x: 0.4, y: 0.66, s: Math.min(0.36, viewW * 0.17) }, c: { x: 0, y: 0.22, s: Math.min(0.95, viewW * 0.4) } }
      : { a: { x: 0.36, y: 0.5, s: 0.62 }, b: { x: 0.18, y: 0.6, s: 0.42 }, c: { x: 0, y: 0.16, s: 1.25 } };

  let progress = 0;
  let running = false;
  const born = performance.now();

  const frame = () => {
    if (!running) return;
    requestAnimationFrame(frame);
    const t = performance.now() / 1000;
    mouse.sx += (mouse.x - mouse.sx) * 0.06;
    mouse.sy += (mouse.y - mouse.sy) * 0.06;

    const P = poses();
    const toB = smooth(0.08, 0.3, progress);
    const toC = smooth(0.6, 0.86, progress);
    const x = mix(mix(P.a.x, P.b.x, toB), P.c.x, toC);
    const y = mix(mix(P.a.y, P.b.y, toB), P.c.y, toC);
    const intro = smooth(0, 1, (performance.now() - born) / 1600);
    const s = mix(mix(P.a.s, P.b.s, toB), P.c.s, toC) * (0.4 + 0.6 * intro);

    rig.position.set((x * viewW) / 2, (y * viewH) / 2, 0);
    rig.scale.setScalar(s);
    // One full spin while travelling to centre stage, then settle facing forward.
    const spin = toC * Math.PI * 2 + (1 - intro) * -Math.PI * 1.5;
    emblem.rotation.y = spin + Math.sin(t * 0.6) * 0.22 * (1 - toC * 0.6) + mouse.sx * 0.35;
    emblem.rotation.x = Math.sin(t * 0.45) * 0.08 + mouse.sy * 0.22;
    emblem.position.y = Math.sin(t * 1.1) * 0.05;
    halo.material.opacity = 0.55 + toC * 0.45 + Math.sin(t * 1.4) * 0.08;

    rim.position.set(rig.position.x + Math.cos(t * 0.9) * 2.4, rig.position.y + Math.sin(t * 0.7) * 1.6, 2.2);
    points.rotation.y = mouse.sx * 0.08;
    points.rotation.x = mouse.sy * 0.05;
    pMat.uniforms.uTime.value = t;
    pMat.uniforms.uProgress.value = progress;
    renderer.render(scene, camera);
  };

  return {
    setProgress(p) { progress = p; },
    start() {
      if (running) return;
      running = true;
      frame();
    },
    stop() { running = false; },
    resize,
  };
}
