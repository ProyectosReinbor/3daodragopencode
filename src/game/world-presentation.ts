import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BufferGeometry,
  CircleGeometry,
  Color,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RGBAFormat,
  RingGeometry,
  SRGBColorSpace,
  Vector3,
  type Material,
  type Scene,
  type WebGLRenderer,
} from 'three';
import type { ZoneId } from './profile';
import { zoneConfig } from './zones';

export interface WorldPresentation {
  /** Both time arguments use seconds. The optional position anchors the ground shadow. */
  update(delta: number, time: number, playerPosition?: Vector3): void;
  /** Call before disposing or clearing the owning scene. Safe to call more than once. */
  dispose(): void;
}

interface Palette {
  sky: number;
  bounce: number;
  sun: number;
  sunIntensity: number;
  fill: number;
  stone: number;
  patches: number[];
  grass: number[];
  mote: number;
  moteOpacity: number;
  exposure: number;
}

const PALETTES: Record<ZoneId, Palette> = {
  aldea: {
    sky: 0xc9e2ee,
    bounce: 0x5a6943,
    sun: 0xffe2b4,
    sunIntensity: 2.2,
    fill: 0x94b9d6,
    stone: 0x7c8275,
    patches: [0x527448, 0x3c603d, 0x647d49],
    grass: [0x648644, 0x7c9b51, 0x4d753e],
    mote: 0xffedb3,
    moteOpacity: 0.25,
    exposure: 1.05,
  },
  bosque: {
    sky: 0xb2d8c8,
    bounce: 0x324b34,
    sun: 0xf6ddb0,
    sunIntensity: 1.65,
    fill: 0x8cbbbf,
    stone: 0x677363,
    patches: [0x304e30, 0x45613b, 0x4d6940],
    grass: [0x4c713f, 0x719352, 0x3e6839],
    mote: 0xd8f89f,
    moteOpacity: 0.7,
    exposure: 1.08,
  },
  ruinas: {
    sky: 0xc4badb,
    bounce: 0x4b414c,
    sun: 0xffd2ab,
    sunIntensity: 1.7,
    fill: 0xb2a4e0,
    stone: 0x8a7d83,
    patches: [0x514650, 0x403947, 0x60515b],
    grass: [0x757559, 0x666b50, 0x8c835e],
    mote: 0xd4b7ff,
    moteOpacity: 0.5,
    exposure: 1.12,
  },
  desierto: {
    sky: 0xffedce,
    bounce: 0x9d713e,
    sun: 0xffecd0,
    sunIntensity: 2.45,
    fill: 0xa6c5d5,
    stone: 0xb39970,
    patches: [0xc7ac58, 0xbca04e, 0xd1b96b],
    grass: [0x9d924a, 0xb7aa60, 0x8d8a44],
    mote: 0xf8e5b8,
    moteOpacity: 0.2,
    exposure: 1,
  },
  cueva: {
    sky: 0x9caacf,
    bounce: 0x343044,
    sun: 0xbec8ef,
    sunIntensity: 1.1,
    fill: 0x998bda,
    stone: 0x555467,
    patches: [0x31313e, 0x252632, 0x3c374a],
    grass: [],
    mote: 0xb9cfff,
    moteOpacity: 0.62,
    exposure: 1.15,
  },
};

/** A repeatable scatter keeps revisiting a zone visually stable without saved art state. */
function seededRandom(zone: ZoneId, training: boolean) {
  let seed = [...zone].reduce((value, letter) => value * 31 + letter.charCodeAt(0), 17);
  if (training) seed += 4099;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function radialTexture(size: number) {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const radius = Math.hypot(((x + 0.5) / size) * 2 - 1, ((y + 0.5) / size) * 2 - 1);
      const alpha = Math.pow(Math.max(0, 1 - radius), 2);
      const offset = (y * size + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 255;
      pixels[offset + 3] = Math.round(alpha * 255);
    }
  }
  const texture = new DataTexture(pixels, size, size, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Three intersecting tapered blades make a readable tuft in a single instanced draw. */
function grassGeometry() {
  const positions: number[] = [];
  for (let blade = 0; blade < 3; blade++) {
    const angle = (blade / 3) * Math.PI;
    const dx = Math.cos(angle) * 0.09;
    const dz = Math.sin(angle) * 0.09;
    const height = 0.28 + blade * 0.075;
    positions.push(-dx, 0, -dz, dx, 0, dz, dx * 0.45 + 0.045, height, dz * 0.45);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Adds a self-contained presentation layer to an already-created world. Existing fog, world
 * meshes, collisions and pet materials stay under their original owners. No shadow maps,
 * external textures or postprocessing targets are allocated.
 */
export function createWorldPresentation(
  scene: Scene,
  renderer: WebGLRenderer,
  zone: ZoneId,
  training: boolean
): WorldPresentation {
  const palette = PALETTES[zone];
  const cfg = zoneConfig(zone);
  const random = seededRandom(zone, training);
  const layer = new Group();
  layer.name = 'world-presentation';
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<DataTexture>();
  const uniformTime = { value: 0 };
  let disposed = false;

  const media = (query: string) =>
    typeof window !== 'undefined' && !!window.matchMedia?.(query).matches;
  const reduceMotion = media('(prefers-reduced-motion: reduce)');
  const pixelRatio = renderer.getPixelRatio?.() || 1;
  const width =
    renderer.domElement?.clientWidth || (typeof innerWidth === 'number' ? innerWidth : 0);
  const height =
    renderer.domElement?.clientHeight || (typeof innerHeight === 'number' ? innerHeight : 0);
  const compact = media('(pointer: coarse)') || (width > 0 && Math.min(width, height) < 600);
  // A large drawing buffer also limits decorative work on high-density desktop screens.
  const lowDetail = compact || width * height * pixelRatio * pixelRatio > 3_500_000;
  const counts = training
    ? { patches: 16, stones: 8, grass: 18, motes: 8 }
    : lowDetail
      ? { patches: 20, stones: 12, grass: 24, motes: 16 }
      : { patches: 38, stones: 24, grass: 60, motes: 32 };
  layer.userData.quality = lowDetail ? 'compact' : 'standard';

  const previousRenderer = {
    toneMapping: renderer.toneMapping,
    toneMappingExposure: renderer.toneMappingExposure,
    outputColorSpace: renderer.outputColorSpace,
  };
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = palette.exposure;
  renderer.outputColorSpace = SRGBColorSpace;

  // Replace the legacy flat world light while preserving its state for the owning scene.
  const legacyLights: { light: HemisphereLight | DirectionalLight; intensity: number }[] = [];
  for (const child of scene.children) {
    if (child instanceof HemisphereLight || child instanceof DirectionalLight) {
      legacyLights.push({ light: child, intensity: child.intensity });
      child.intensity = 0;
    }
  }
  const sky = new HemisphereLight(palette.sky, palette.bounce, training ? 1.5 : 1.25);
  const sun = new DirectionalLight(palette.sun, palette.sunIntensity);
  sun.position.set(-8, 14, 7);
  const fill = new DirectionalLight(palette.fill, zone === 'cueva' ? 0.45 : 0.3);
  fill.position.set(7, 5, -9);
  layer.add(sky, sun, fill);

  const ownGeometry = <T extends BufferGeometry>(geometry: T): T => {
    geometries.add(geometry);
    return geometry;
  };
  const ownMaterial = <T extends Material>(material: T): T => {
    materials.add(material);
    return material;
  };
  const softDisc = radialTexture(32);
  textures.add(softDisc);
  const dummy = new Object3D();
  const tint = new Color();
  const radius = training ? 15 : Math.min(32, cfg.groundSize * 0.42);
  const scatter = (clearPath: boolean) => {
    let x = 0;
    let z = 0;
    for (let attempt = 0; attempt < 12; attempt++) {
      x = (random() * 2 - 1) * radius;
      z = (random() * 2 - 1) * radius;
      if (!clearPath || (Math.abs(x) > 2.2 && Math.hypot(x, z - cfg.playerStart.z) > 3.2)) break;
    }
    return { x, z };
  };

  const patches = new InstancedMesh(
    ownGeometry(new CircleGeometry(1, 9)),
    ownMaterial(new MeshStandardMaterial({ roughness: 1, metalness: 0 })),
    counts.patches
  );
  patches.name = 'terrain-patches';
  for (let i = 0; i < patches.count; i++) {
    const { x, z } = scatter(false);
    dummy.position.set(x, 0.012 + (i % 3) * 0.002, z);
    dummy.rotation.set(-Math.PI / 2, 0, random() * Math.PI * 2);
    dummy.scale.set(0.65 + random() * 2.7, 0.4 + random() * 1.7, 1);
    dummy.updateMatrix();
    patches.setMatrixAt(i, dummy.matrix);
    patches.setColorAt(i, tint.setHex(palette.patches[i % palette.patches.length]));
  }
  layer.add(patches);

  const stones = new InstancedMesh(
    ownGeometry(new IcosahedronGeometry(0.2, 0)),
    ownMaterial(new MeshStandardMaterial({ roughness: 0.92, metalness: 0, flatShading: true })),
    counts.stones
  );
  stones.name = 'terrain-stones';
  for (let i = 0; i < stones.count; i++) {
    const { x, z } = scatter(true);
    const scale = 0.6 + random() * 1.1;
    dummy.position.set(x, 0.07 * scale, z);
    dummy.rotation.set(random() * 0.4, random() * Math.PI * 2, random() * 0.3);
    dummy.scale.set(scale, scale * 0.55, scale * (0.7 + random() * 0.6));
    dummy.updateMatrix();
    stones.setMatrixAt(i, dummy.matrix);
    stones.setColorAt(i, tint.setHex(palette.stone).multiplyScalar(0.83 + random() * 0.25));
  }
  layer.add(stones);

  if (palette.grass.length) {
    const grassMaterial = ownMaterial(
      new MeshStandardMaterial({ roughness: 1, metalness: 0, side: DoubleSide })
    );
    grassMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.worldTime = uniformTime;
      shader.vertexShader = `uniform float worldTime;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         transformed.x += sin(worldTime * 1.25 + instanceMatrix[3].x * 0.7 +
           instanceMatrix[3].z * 0.4) * transformed.y * transformed.y * 0.14;`
      );
    };
    grassMaterial.customProgramCacheKey = () => 'world-grass-sway-v1';
    const grass = new InstancedMesh(ownGeometry(grassGeometry()), grassMaterial, counts.grass);
    grass.name = 'terrain-grass';
    for (let i = 0; i < grass.count; i++) {
      const { x, z } = scatter(true);
      const scale = 0.7 + random() * 0.7;
      dummy.position.set(x, 0.015, z);
      dummy.rotation.set(0, random() * Math.PI * 2, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
      grass.setColorAt(i, tint.setHex(palette.grass[i % palette.grass.length]));
    }
    layer.add(grass);
  }

  // The contact shadow is an inexpensive translucent disc, never a GPU shadow pass.
  const shadowMaterial = ownMaterial(
    new MeshBasicMaterial({
      color: 0x142018,
      map: softDisc,
      transparent: true,
      opacity: zone === 'cueva' ? 0.65 : 0.58,
      depthWrite: false,
      toneMapped: false,
    })
  );
  const shadow = new Mesh(ownGeometry(new PlaneGeometry(2.6, 2.15)), shadowMaterial);
  shadow.name = 'player-contact-shadow';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(cfg.playerStart.x, 0.03, cfg.playerStart.z);
  shadow.visible = false;
  layer.add(shadow);

  const motePositions: number[] = [];
  for (let i = 0; i < counts.motes; i++) {
    motePositions.push((random() * 2 - 1) * 14, 0.3 + random() * 2.4, (random() * 2 - 1) * 14);
  }
  const moteGeometry = ownGeometry(new BufferGeometry());
  moteGeometry.setAttribute('position', new Float32BufferAttribute(motePositions, 3));
  const glowing = zone === 'bosque' || zone === 'ruinas' || zone === 'cueva';
  const moteMaterial = ownMaterial(
    new PointsMaterial({
      color: palette.mote,
      map: softDisc,
      size: glowing ? 0.11 : 0.075,
      transparent: true,
      opacity: training ? 0.22 : palette.moteOpacity,
      depthWrite: false,
      blending: glowing ? AdditiveBlending : NormalBlending,
      toneMapped: false,
      fog: true,
    })
  );
  moteMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.worldTime = uniformTime;
    shader.vertexShader = `uniform float worldTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       transformed.x += sin(worldTime * 0.32 + position.z * 1.7) * 0.35;
       transformed.y += sin(worldTime * 0.45 + position.x * 2.1) * 0.18;
       transformed.z += cos(worldTime * 0.25 + position.x * 1.3) * 0.3;`
    );
  };
  moteMaterial.customProgramCacheKey = () => 'world-ambient-motes-v1';
  const motes = new Points(moteGeometry, moteMaterial);
  motes.name = 'ambient-motes';
  // Vertex motion stays inside this expanded bound, so edge particles do not pop out.
  moteGeometry.computeBoundingSphere();
  if (moteGeometry.boundingSphere) moteGeometry.boundingSphere.radius += 0.6;
  layer.add(motes);

  if (training) {
    const arena = new Mesh(
      ownGeometry(new RingGeometry(5.15, 5.24, 48)),
      ownMaterial(
        new MeshBasicMaterial({
          color: 0xebdba5,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        })
      )
    );
    arena.name = 'practice-arena-marker';
    arena.rotation.x = -Math.PI / 2;
    arena.position.set(0, 0.025, -1.5);
    layer.add(arena);
  }
  scene.add(layer);

  return {
    update(_delta, time, playerPosition) {
      if (disposed) return;
      uniformTime.value = reduceMotion || !Number.isFinite(time) ? 0 : time;
      if (playerPosition) {
        shadow.visible = true;
        shadow.position.set(playerPosition.x, 0.03, playerPosition.z);
        const height = Math.max(0, playerPosition.y);
        shadow.scale.setScalar(1 + Math.min(height, 2) * 0.2);
        shadowMaterial.opacity = (zone === 'cueva' ? 0.65 : 0.58) / (1 + height * 1.5);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      layer.removeFromParent();
      layer.traverse((object) => {
        if (object instanceof InstancedMesh) object.dispose();
      });
      sun.dispose();
      fill.dispose();
      layer.clear();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      for (const { light, intensity } of legacyLights) {
        if (light.intensity === 0) light.intensity = intensity;
      }
      // Do not overwrite a setting changed by a later owner while this layer was active.
      if (renderer.toneMapping === ACESFilmicToneMapping)
        renderer.toneMapping = previousRenderer.toneMapping;
      if (renderer.toneMappingExposure === palette.exposure)
        renderer.toneMappingExposure = previousRenderer.toneMappingExposure;
      if (renderer.outputColorSpace === SRGBColorSpace)
        renderer.outputColorSpace = previousRenderer.outputColorSpace;
    },
  };
}
