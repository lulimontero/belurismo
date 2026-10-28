import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { SimplexNoise } from "three/addons/math/SimplexNoise.js";
import type { GlobeTrip } from "@/lib/travel/globe-trips";

type Point = [number, number];
type GeoFeature = { properties: { name: string; code: string }; geometry: { type: "Polygon"; coordinates: Point[][] } | { type: "MultiPolygon"; coordinates: Point[][][] } };
export type LatinAmerica = { features: GeoFeature[] };
export type GlobeEngine = ReturnType<typeof createGlobe>;

// Fit the familiar cartographic silhouette to the front of the sphere. Unlike
// stretching spherical longitude/latitude, this keeps Brazil, the isthmus and
// Patagonia in proportion while letting Latin America fill the visible planet.
function position(lng: number, lat: number, radius = 1) {
  let x = (lng + 66) * 0.0205 * Math.cos(THREE.MathUtils.degToRad(10));
  let y = (lat + 8) * 0.0205;
  const distance = Math.hypot(x, y);
  if (distance > 0.85) {
    const fitted = 0.85 + 0.11 * (1 - Math.exp(-(distance - 0.85) / 0.11));
    x *= fitted / distance; y *= fitted / distance;
  }
  return new THREE.Vector3(x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y))).multiplyScalar(radius);
}

const terrainNoise = new SimplexNoise({ random: (() => { let seed = 1181; return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; })() });
const ANDES: Point[] = [[-73, 9], [-75, 4], [-78, -1], [-77, -7], [-74, -12], [-69, -18], [-68.5, -25], [-70, -32], [-72, -40], [-73, -48], [-70, -53]];
const SIERRA: Point[] = [[-109, 29], [-106, 25], [-103, 22], [-99, 19], [-95, 17], [-91, 15], [-87, 13], [-84, 10], [-81, 8]];
function ridgeDistance(lng: number, lat: number, path: Point[]) {
  let distance = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i], [bx, by] = path[i + 1];
    const t = THREE.MathUtils.clamp(((lng - ax) * (bx - ax) + (lat - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2), 0, 1);
    distance = Math.min(distance, Math.hypot(lng - ax - t * (bx - ax), lat - ay - t * (by - ay)));
  }
  return distance;
}
function elevation(lng: number, lat: number) {
  const andes = Math.exp(-Math.pow(ridgeDistance(lng, lat, ANDES) / 2.4, 2));
  const sierra = Math.exp(-Math.pow(ridgeDistance(lng, lat, SIERRA) / 2.1, 2));
  const plateau = Math.exp(-((lng + 48) ** 2 / 110 + (lat + 16) ** 2 / 150));
  const broad = terrainNoise.noise(lng * 0.22, lat * 0.22) * 0.5 + 0.5;
  const ridge = 1 - Math.abs(terrainNoise.noise(lng * 0.55, lat * 0.55));
  return 0.009 + andes * (0.008 + ridge * 0.014) + sierra * (0.005 + ridge * 0.008) + plateau * 0.003 + broad * 0.0006;
}
function terrainPosition(lng: number, lat: number) { return position(lng, lat, 1 + elevation(lng, lat)); }

function countryGeometry(rings: Point[][]) {
  const contour = rings[0].slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y));
  const holes = rings.slice(1).map((ring) => ring.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y)));
  const triangles = THREE.ShapeUtils.triangulateShape(contour, holes);
  const points = [...contour, ...holes.flat()];
  const vertices: number[] = [], normals: number[] = [], colors: number[] = [];
  const low = new THREE.Color(0xb197d4), high = new THREE.Color(0xd0bce8), color = new THREE.Color();
  const samples = new Map<string, { point: THREE.Vector3; normal: THREE.Vector3; color: THREE.Color }>();
  function triangle(a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2, depth = 0) {
    const ab = a.distanceToSquared(b), bc = b.distanceToSquared(c), ca = c.distanceToSquared(a);
    // Subdivide the geographic triangles before projecting onto a sphere. Without
    // this, large countries become flat chords that disappear inside the ocean.
    if (Math.max(ab, bc, ca) > 0.5 && depth < 17) {
      if (ab >= bc && ab >= ca) {
        const mid = a.clone().lerp(b, 0.5);
        triangle(a, mid, c, depth + 1); triangle(mid, b, c, depth + 1);
      } else if (bc >= ca) {
        const mid = b.clone().lerp(c, 0.5);
        triangle(a, b, mid, depth + 1); triangle(a, mid, c, depth + 1);
      } else {
        const mid = c.clone().lerp(a, 0.5);
        triangle(a, b, mid, depth + 1); triangle(mid, b, c, depth + 1);
      }
      return;
    }
    for (const p of [a, b, c]) {
      const key = `${p.x.toFixed(6)},${p.y.toFixed(6)}`;
      let sample = samples.get(key);
      if (!sample) {
        const point = terrainPosition(p.x, p.y);
        const tangentX = terrainPosition(p.x + 0.2, p.y).sub(terrainPosition(p.x - 0.2, p.y));
        const tangentY = terrainPosition(p.x, p.y + 0.2).sub(terrainPosition(p.x, p.y - 0.2));
        color.copy(low).lerp(high, THREE.MathUtils.clamp((point.length() - 1.009) * 18, 0, 0.55));
        sample = { point, normal: tangentX.cross(tangentY).normalize().lerp(point.clone().normalize(), 0.3).normalize(), color: color.clone() };
        samples.set(key, sample);
      }
      vertices.push(...sample.point.toArray());
      normals.push(...sample.normal.toArray());
      colors.push(sample.color.r, sample.color.g, sample.color.b);
    }
  }
  for (const [a, b, c] of triangles) triangle(points[a], points[b], points[c]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function countrySides(rings: Point[][]) {
  const vertices: number[] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = terrainPosition(...ring[i]), b = terrainPosition(...ring[i + 1]);
      const c = position(...ring[i], 0.999), d = position(...ring[i + 1], 0.999);
      for (const p of [a, b, c, b, d, c]) vertices.push(...p.toArray());
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function disposeGroup(group: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  group.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

export function createGlobe(host: HTMLElement, labels: HTMLElement, geography: LatinAmerica, onContextLost: () => void) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, 1, 0.1, 20);
  camera.position.set(0, 0, 4);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.enableZoom = false; // Buttons zoom without capturing the page's wheel scroll.
  controls.rotateSpeed = 0.65;
  controls.minAzimuthAngle = -0.65;
  controls.maxAzimuthAngle = 0.65;
  controls.minPolarAngle = 1.12;
  controls.maxPolarAngle = 1.95;
  renderer.domElement.style.touchAction = "pan-y";
  controls.saveState();

  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.6;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xf9f7ff, 0x76579b, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(-3, 4, 4); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -1.5; key.shadow.camera.right = 1.5;
  key.shadow.camera.top = 1.5; key.shadow.camera.bottom = -1.5;
  key.shadow.normalBias = 0.002; key.shadow.bias = -0.00005;
  key.shadow.radius = 4;
  key.shadow.camera.near = 0.1; key.shadow.camera.far = 12;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xd4c1ff, 0.8);
  rim.position.set(3, 1, -2); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xf1eaff, 0.45);
  fill.position.set(4, -1, 3); scene.add(fill);

  const world = new THREE.Group();
  world.rotation.set(0, 0, -0.055);
  scene.add(world);
  const oceanMaterial = new THREE.MeshPhysicalMaterial({ color: 0x50268f, roughness: 0.68, metalness: 0, clearcoat: 0.06, clearcoatRoughness: 0.7 });
  const ocean = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), oceanMaterial);
  ocean.receiveShadow = true; world.add(ocean);

  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xbaa0da, transparent: true, opacity: 0.3 });
  const sideMaterial = new THREE.MeshStandardMaterial({ color: 0xb59bda, roughness: 0.85, side: THREE.DoubleSide });
  geography.features.forEach((feature) => {
    const material = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.83, metalness: 0, clearcoat: 0.04, side: THREE.DoubleSide });
    const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const rings of polygons) {
      const terrain = new THREE.Mesh(countryGeometry(rings), material);
      terrain.castShadow = true; terrain.receiveShadow = true; world.add(terrain);
      const sides = new THREE.Mesh(countrySides(rings), sideMaterial);
      world.add(sides);
      for (const ring of rings) {
        world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring.map(([lng, lat]) => position(lng, lat, 1.003 + elevation(lng, lat)))), edgeMaterial));
      }
    }
  });

  const pins = new THREE.Group(); world.add(pins);
  let trips: GlobeTrip[] = [], selected: string | null = null;
  let width = 1, height = 1, visible = true, disposed = false, dirty = true;
  let autoRotate = true, lastFrame = 0, animation = 0, settled = 0;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const projected = new THREE.Vector3(), worldPoint = new THREE.Vector3(), normal = new THREE.Vector3();
  const camDirection = new THREE.Vector3(), inverseWorldRotation = new THREE.Quaternion();
  const pinGroups = new Map<string, THREE.Group>();

  function setTrips(next: GlobeTrip[]) {
    disposeGroup(pins); pins.clear(); pinGroups.clear(); trips = next;
    const occupied = new Map<string, number>();
    for (const trip of trips) {
      if (!trip.coordinates) continue;
      const { lat, lng } = trip.coordinates;
      const locationKey = `${lat},${lng}`, count = occupied.get(locationKey) ?? 0;
      occupied.set(locationKey, count + 1);
      // Multiple visits to one place keep separate, selectable pins.
      const pinLng = lng + count * 1.1, pinLat = lat + count * 1.1;
      const p = position(pinLng, pinLat);
      const pin = new THREE.Group();
      pin.position.copy(p.clone().multiplyScalar(1 + elevation(pinLng, pinLat)));
      const color = trip.status === "active" ? 0x00cba0 : trip.status === "completed" ? 0x6935bf : 0x9e7cce;
      const material = new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, metalness: 0.02, clearcoat: 0.45 });
      const shape = new THREE.Shape();
      shape.moveTo(0, 0); shape.bezierCurveTo(-0.02, 0.023, -0.048, 0.076, 0, 0.082);
      shape.bezierCurveTo(0.048, 0.076, 0.02, 0.023, 0, 0);
      const hole = new THREE.Path(); hole.absarc(0, 0.055, 0.011, 0, Math.PI * 2, true); shape.holes.push(hole);
      const markerGeometry = new THREE.ExtrudeGeometry(shape, { depth: 0.009, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 3, steps: 1, curveSegments: 16 });
      const markerPositions = markerGeometry.getAttribute("position");
      // Lean the marker gently toward the viewer, keeping the full location icon
      // above the curved terrain even for destinations near the lower hemisphere.
      for (let i = 0; i < markerPositions.count; i++) markerPositions.setZ(i, markerPositions.getZ(i) + markerPositions.getY(i) * 0.9);
      markerGeometry.computeVertexNormals();
      const head = new THREE.Mesh(markerGeometry, material);
      head.position.z = 0.025; head.castShadow = true; pin.add(head);
      pins.add(pin); pinGroups.set(trip.id, pin);
    }
    dirty = true;
  }

  function resize() {
    width = host.clientWidth; height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height; camera.updateProjectionMatrix(); dirty = true;
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host); resize();
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; dirty = true; }, { threshold: 0.05 });
  observer.observe(host);
  const changed = () => { dirty = true; settled = 0; };
  const interacted = () => { autoRotate = false; changed(); };
  controls.addEventListener("change", changed);
  controls.addEventListener("start", interacted);
  const contextLost = (event: Event) => { event.preventDefault(); onContextLost(); };
  renderer.domElement.addEventListener("webglcontextlost", contextLost);

  function frame(time: number) {
    if (disposed) return;
    animation = requestAnimationFrame(frame);
    if (!visible || document.hidden || time - lastFrame < 32) return;
    lastFrame = time;
    controls.update();
    if (!reduced.matches && autoRotate) { world.rotation.y = Math.sin(time * 0.00012) * 0.028; dirty = true; }
    if (!dirty && settled > 3) return;
    settled++; dirty = false;
    world.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    camera.getWorldDirection(camDirection).negate();
    world.getWorldQuaternion(inverseWorldRotation).invert();
    for (const trip of trips) {
      const pin = pinGroups.get(trip.id);
      const label = labels.querySelector<HTMLElement>(`[data-trip-id="${CSS.escape(trip.id)}"]`);
      if (!pin || !label) continue;
      pin.quaternion.copy(inverseWorldRotation).multiply(camera.quaternion);
      pin.getWorldPosition(worldPoint);
      normal.copy(worldPoint).normalize();
      const facing = normal.dot(camDirection) > 0.15;
      label.style.visibility = facing ? "visible" : "hidden";
      label.tabIndex = facing ? 0 : -1;
      projected.set(0, 0.06, 0.025); pin.localToWorld(projected); projected.project(camera);
      label.dataset.align = projected.x > 0.22 ? "left" : "right";
      label.dataset.vertical = projected.y < -0.55 ? "above" : "center";
      label.style.transform = `translate3d(${(projected.x * 0.5 + 0.5) * width}px,${(-projected.y * 0.5 + 0.5) * height}px,0)`;
      label.style.zIndex = trip.id === selected ? "3" : "1";
      pin.scale.setScalar(trip.id === selected ? 1.25 : 1);
    }
    renderer.render(scene, camera);
  }
  animation = requestAnimationFrame(frame);

  return {
    setTrips,
    select(id: string | null) { selected = id; dirty = true; },
    reset() { controls.reset(); world.rotation.y = 0; changed(); },
    zoom(direction: number) {
      camera.position.multiplyScalar(direction > 0 ? 0.9 : 1.1);
      camera.position.setLength(THREE.MathUtils.clamp(camera.position.length(), 3.55, 4.6));
      changed();
    },
    rotate(direction: number) {
      const spherical = new THREE.Spherical().setFromVector3(camera.position);
      spherical.theta = THREE.MathUtils.clamp(spherical.theta + direction * 0.14, -0.65, 0.65);
      camera.position.setFromSpherical(spherical); controls.update(); interacted();
    },
    pause(paused: boolean) { autoRotate = !paused; changed(); },
    dispose() {
      disposed = true; cancelAnimationFrame(animation); resizeObserver.disconnect(); observer.disconnect();
      controls.removeEventListener("change", changed); controls.removeEventListener("start", interacted); controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      disposeGroup(scene); environment.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
