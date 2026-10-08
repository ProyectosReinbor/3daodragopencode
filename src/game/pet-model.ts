import {
  BackSide,
  BoxGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  Quaternion,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Texture,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import type { NftTraits } from './nft';
import {
  APPEARANCE_ENUMS,
  DEFAULT_APPEARANCE,
  normalizeAppearance,
  type PetAppearance,
  type SculptStroke,
} from '../../shared/pet-appearance.js';

export const PET_IRIS_COLORS: Record<PetAppearance['eyeColor'], number> = {
  mint: 0x82cfbb,
  sky: 0x8ebbe8,
  amber: 0xe5b769,
  violet: 0xb3a0df,
  rose: 0xe8a4c1,
  lime: 0xb8cf77,
};

function sculptPoint(point: Vector3, strokes: SculptStroke[]): Vector3 {
  for (const stroke of strokes) {
    const distance = Math.hypot(point.x - stroke.x, point.y - stroke.y, point.z - stroke.z);
    const radialLength = point.length();
    if (distance < stroke.radius && radialLength > 0)
      point.multiplyScalar(
        1 + (stroke.strength * (1 - distance / stroke.radius) ** 2) / radialLength
      );
  }
  return point.clampScalar(-1.6, 1.6);
}

export function sculptGeometry(geometry: BufferGeometry, strokes: SculptStroke[]): void {
  const positions = geometry.getAttribute('position');
  const point = new Vector3();
  for (let i = 0; i < positions.count; i++) {
    sculptPoint(point.fromBufferAttribute(positions, i), strokes);
    positions.setXYZ(i, point.x, point.y, point.z);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

function roundedBox(): BufferGeometry {
  const geometry = new BoxGeometry(2, 2, 2, 10, 10, 10);
  const positions = geometry.getAttribute('position');
  const point = new Vector3(),
    inside = new Vector3();
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    inside.copy(point).clampScalar(-0.76, 0.76);
    point.sub(inside).normalize().multiplyScalar(0.24).add(inside);
    positions.setXYZ(i, point.x, point.y, point.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Original analytic color patterns travel with the sculpted skin; no raster assets are used. */
function surfaceMaterial(traits: NftTraits, a: PetAppearance, part: 'head' | 'body' | 'belly') {
  const material = new MeshToonMaterial({
    color: part === 'belly' ? traits.secondaryColor : traits.primaryColor,
  });
  material.userData.patterns = { coat: a.coat, markings: a.markings, part };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      petSecondary: { value: new Color(traits.secondaryColor) },
      petAccent: { value: new Color(traits.accentColor) },
      petCoat: { value: part === 'belly' ? 0 : APPEARANCE_ENUMS.coat.indexOf(a.coat) },
      petMarkings: { value: part === 'belly' ? 0 : APPEARANCE_ENUMS.markings.indexOf(a.markings) },
      petHead: { value: part === 'head' ? 1 : 0 },
      petBelly: { value: part === 'belly' ? 1 : 0 },
      petRoughness: { value: a.roughness },
    });
    shader.vertexShader = `varying vec3 petLocal;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\npetLocal = transformed;'
    );
    shader.fragmentShader = `varying vec3 petLocal;
      uniform vec3 petSecondary; uniform vec3 petAccent;
      uniform float petCoat; uniform float petMarkings; uniform float petHead;
      uniform float petBelly; uniform float petRoughness;
      ${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      vec3 p = petLocal;
      if (petBelly > 0.5 && (p.z < 0.0 || dot(p.xy / vec2(0.72, 0.78), p.xy / vec2(0.72, 0.78)) > 1.0)) discard;
      float wave = sin(p.x * 11.0 + p.y * 3.0 + sin(p.z * 5.0));
      vec3 fleck = fract(p * 4.1 + vec3(0.12, 0.36, 0.22)) - 0.5;
      float dots = 1.0 - smoothstep(0.14, 0.24, length(fleck));
      if (petCoat > 1.5 && petCoat < 2.5) diffuseColor.rgb = mix(diffuseColor.rgb, petSecondary, smoothstep(0.42, 0.72, wave) * 0.7);
      if (petCoat > 2.5 && petCoat < 3.5) diffuseColor.rgb = mix(diffuseColor.rgb, petAccent, dots * 0.68);
      if (petCoat > 3.5 && petCoat < 4.5) diffuseColor.rgb = mix(diffuseColor.rgb, petAccent * 0.67, dots * (0.25 + petRoughness * 0.5));
      if (petCoat > 4.5 && petCoat < 5.5) {
        float scales = smoothstep(0.74, 0.96, sin(p.y * 18.0 + sin(p.x * 14.0 + p.z * 8.0) * 1.6));
        diffuseColor.rgb = mix(diffuseColor.rgb, petSecondary, scales * 0.38);
      }
      if (petCoat > 5.5 && petCoat < 6.5) {
        float marble = sin(p.x * 7.0 + p.y * 5.0 + sin(p.z * 6.0 + p.y * 3.0) * 2.4);
        diffuseColor.rgb = mix(diffuseColor.rgb, petSecondary, smoothstep(-0.18, 0.8, marble) * 0.78);
      }
      if (petCoat > 6.5 && petCoat < 7.5) {
        float coatPatch = sin(p.x * 4.8 + p.y * 2.2) + cos(p.z * 5.2 - p.y * 4.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, petSecondary, smoothstep(-1.0, -0.35, coatPatch));
        diffuseColor.rgb = mix(diffuseColor.rgb, petAccent, smoothstep(0.4, 1.15, coatPatch) * 0.86);
      }
      if (petCoat > 7.5) {
        float bib = (1.0 - smoothstep(0.24, 0.52, abs(p.x))) * (1.0 - smoothstep(-0.02, 0.6, p.y)) * smoothstep(0.15, 0.5, p.z);
        diffuseColor.rgb = mix(diffuseColor.rgb, petSecondary, bib);
      }
      float front = smoothstep(0.2, 0.55, p.z);
      if (petMarkings > 0.5 && petMarkings < 1.5 && petHead > 0.5) {
        float mask = smoothstep(0.08, 0.28, abs(p.x)) * (1.0 - smoothstep(0.28, 0.52, abs(p.y - 0.09))) * front;
        diffuseColor.rgb = mix(diffuseColor.rgb, petAccent, mask * 0.85);
      }
      if (petMarkings > 2.5 && petMarkings < 3.5 && petHead > 0.5) {
        float blaze = (1.0 - smoothstep(0.1, 0.21, abs(p.x + p.y * 0.04))) * smoothstep(-0.65, -0.22, p.y) * front;
        diffuseColor.rgb = mix(diffuseColor.rgb, petSecondary, blaze);
      }
      if (petMarkings > 3.5 && petMarkings < 4.5) {
        vec2 freckles = fract(p.xy * 9.0 + vec2(p.z * 1.1, 0.2)) - 0.5;
        float speckle = (1.0 - smoothstep(0.12, 0.19, length(freckles))) * front * (1.0 - smoothstep(-0.03, 0.22, p.y));
        diffuseColor.rgb = mix(diffuseColor.rgb, petAccent * 0.82, speckle * 0.72);
      }
      if (petMarkings > 4.5) {
        float bands = smoothstep(0.58, 0.84, sin(p.y * 15.0 + p.z * 0.7));
        diffuseColor.rgb = mix(diffuseColor.rgb, petSecondary, bands * 0.67);
      }`
    );
  };
  material.customProgramCacheKey = () => 'aodase-pastel-skin-v3';
  return material;
}

/** Stable named groups provide a small rig while retaining editable skin and eye IDs. */
export function buildDesignedPet(traits: NftTraits): Group {
  const a = normalizeAppearance(traits.appearance) ?? structuredClone(DEFAULT_APPEARANCE);
  const root = new Group();
  root.name = 'designed-pet';
  root.userData.designVersion = 3;
  root.userData.species = a.species;
  const primary = new MeshToonMaterial({ color: traits.primaryColor });
  const secondary = new MeshToonMaterial({ color: traits.secondaryColor });
  const accent = new MeshToonMaterial({ color: traits.accentColor });
  const dark = new MeshToonMaterial({ color: 0x393442 });
  const white = new MeshToonMaterial({ color: 0xfffaf2 });
  const pink = new MeshToonMaterial({ color: 0xeaa8b9 });
  const iris = new MeshToonMaterial({ color: PET_IRIS_COLORS[a.eyeColor] });
  const outline = new MeshBasicMaterial({ color: 0x423a49, side: BackSide });
  const sphereGeometry = new SphereGeometry(1, 14, 10);
  const count = Math.max(0, Math.min(8, Math.round(traits.limbCount ?? 4)));
  const length = Math.max(0.5, Math.min(1.8, traits.limbLength ?? 1));
  const quadruped =
    ['cat', 'dog', 'fox', 'bear', 'turtle', 'axolotl'].includes(a.species) && count >= 4;
  const bodyRadius = new Vector3(
    0.46 * a.bodyWidth,
    (quadruped ? 0.34 : 0.5) * a.bodyHeight,
    (quadruped ? 0.58 : 0.4) * a.bodyWidth
  );
  const bodyY = (count ? (quadruped ? 0.18 : 0.34) * length : 0.18) + bodyRadius.y;
  const reptile = a.species === 'dragon' || a.species === 'turtle';
  const headRadius = new Vector3(
    (reptile ? 0.52 : 0.48) * a.headSize,
    (reptile ? 0.34 : 0.41) * a.headSize,
    (reptile ? 0.43 : 0.38) * a.headSize
  );
  const headY = Math.min(
    bodyY + bodyRadius.y + (quadruped ? 0.03 : 0.2) + a.headY,
    bodyY + bodyRadius.y + headRadius.y * 0.7
  );
  const headStrokes = a.sculpt.filter((stroke) => stroke.part === 'head');
  const bodyStrokes = a.sculpt.filter((stroke) => stroke.part === 'body');
  const bodyGroup = new Group();
  bodyGroup.name = 'body';
  bodyGroup.userData.petPart = 'body';
  bodyGroup.position.y = bodyY;
  root.add(bodyGroup);
  const headGroup = new Group();
  headGroup.name = 'head';
  headGroup.userData.petPart = 'head';
  headGroup.position.set(a.headX, headY, quadruped ? bodyRadius.z * 0.52 : 0.05);
  root.add(headGroup);

  const ellipsoid = (
    parent: Group,
    name: string,
    material: Material,
    scale: Vector3,
    position = new Vector3()
  ) => {
    const mesh = new Mesh(sphereGeometry, material);
    mesh.name = name;
    mesh.scale.copy(scale);
    mesh.position.copy(position);
    parent.add(mesh);
    return mesh;
  };
  const ball = (
    parent: Group,
    name: string,
    material: Material,
    radius: number,
    position = new Vector3()
  ) => ellipsoid(parent, name, material, new Vector3(radius, radius, radius), position);
  const tube = (
    parent: Group,
    name: string,
    points: Vector3[],
    radius: number,
    material: Material = primary
  ) => {
    const mesh = new Mesh(
      new TubeGeometry(new CatmullRomCurve3(points), 12, radius, 6, false),
      material
    );
    mesh.name = name;
    parent.add(mesh);
    return mesh;
  };
  const silhouette = (mesh: Mesh) => {
    const border = new Mesh(mesh.geometry, outline);
    border.name = 'soft-outline';
    border.scale.setScalar(1.023);
    border.renderOrder = -1;
    mesh.add(border);
  };
  const attachToBody = (point: Vector3) => {
    const local = point
      .clone()
      .sub(new Vector3(0, bodyY, 0))
      .divide(bodyRadius);
    if (local.length() > 0.8) local.setLength(0.8);
    return local.multiply(bodyRadius).add(new Vector3(0, bodyY, 0));
  };
  const bodyGeometry = traits.bodyType === 'golem' ? roundedBox() : new SphereGeometry(1, 28, 20);
  sculptGeometry(bodyGeometry, bodyStrokes);
  const body = new Mesh(bodyGeometry, surfaceMaterial(traits, a, 'body'));
  body.name = 'sculpt-body';
  body.userData.part = 'body';
  body.scale.copy(bodyRadius);
  bodyGroup.add(body);
  silhouette(body);
  const belly = new Mesh(bodyGeometry, surfaceMaterial(traits, a, 'belly'));
  belly.name = 'belly';
  belly.userData.part = 'body';
  belly.scale.copy(bodyRadius).multiplyScalar(1.012);
  bodyGroup.add(belly);
  const headGeometry =
    traits.headShape === 'cube'
      ? roundedBox()
      : new SphereGeometry(
          1,
          traits.headShape === 'diamond' ? 12 : 32,
          traits.headShape === 'diamond' ? 8 : 24
        );
  sculptGeometry(headGeometry, headStrokes);
  const head = new Mesh(headGeometry, surfaceMaterial(traits, a, 'head'));
  head.name = 'sculpt-head';
  head.userData.part = 'head';
  head.scale.copy(headRadius);
  headGroup.add(head);
  silhouette(head);

  const eyes = new Group();
  eyes.name = 'eyes';
  eyes.userData.petPart = 'eyes';
  headGroup.add(eyes);
  for (const [side, key] of [
    [-1, 'eyeLeft'],
    [1, 'eyeRight'],
  ] as const) {
    const offset = a[key];
    const eye = new Group();
    eye.name = key;
    eye.userData.editableEye = key;
    eye.userData.petPart = side < 0 ? 'eye-left' : 'eye-right';
    const anchor = new Vector3(
      side * 0.19 * a.headSize * a.eyeSpacing + offset.x,
      0.035 + a.eyeHeight + offset.y,
      0
    );
    const normalized = new Vector3(anchor.x / headRadius.x, anchor.y / headRadius.y, 0);
    if (normalized.length() > 0.83) normalized.setLength(0.83);
    normalized.z =
      traits.headShape === 'cube'
        ? 1
        : Math.sqrt(Math.max(0.2, 1 - normalized.x ** 2 - normalized.y ** 2));
    const radius = Math.min(0.125 * a.eyeSize, headRadius.x * 0.35);
    eye.position.copy(sculptPoint(normalized, headStrokes).multiply(headRadius));
    eye.position.z += Math.max(-radius * 0.06, Math.min(radius * 0.06, offset.z)) - radius * 0.02;
    eye.rotation.z = side * a.eyeTilt;
    const eyeY = a.eyes === 'sleepy' ? 0.66 : a.eyes === 'slit' ? 1.2 : 1.1;
    ellipsoid(
      eye,
      'eye-rim',
      dark,
      new Vector3(radius * 1.07, radius * (eyeY + 0.055), radius * 0.2),
      new Vector3(0, 0, -0.007)
    );
    ellipsoid(eye, 'eye-white', white, new Vector3(radius, radius * eyeY, radius * 0.21));
    ellipsoid(
      eye,
      'iris',
      iris,
      new Vector3(radius * 0.78, radius * 0.87, radius * 0.2),
      new Vector3(-side * radius * 0.04, 0, radius * 0.2)
    );
    ellipsoid(
      eye,
      'pupil',
      dark,
      new Vector3(
        radius * (a.eyes === 'slit' ? 0.15 : 0.4),
        radius * (a.eyes === 'slit' ? 0.63 : 0.52),
        radius * 0.14
      ),
      new Vector3(-side * radius * 0.04, 0, radius * 0.34)
    );
    ball(
      eye,
      'eye-glint',
      white,
      radius * 0.17,
      new Vector3(-radius * 0.28, radius * 0.34, radius * 0.46)
    );
    ball(
      eye,
      'eye-glint-small',
      white,
      radius * 0.075,
      new Vector3(radius * 0.24, -radius * 0.17, radius * 0.49)
    );
    if (a.eyes === 'sparkling') {
      const sparkle = new Shape();
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4,
          r = radius * (i % 2 ? 0.075 : 0.21);
        if (!i) sparkle.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else sparkle.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      sparkle.closePath();
      const star = new Mesh(new ShapeGeometry(sparkle), white);
      star.name = 'eye-sparkle';
      star.position.set(radius * 0.23, radius * 0.18, radius * 0.79);
      eye.add(star);
    }
    if (a.eyes === 'bug') {
      for (let facet = 0; facet < 3; facet++)
        ball(
          eye,
          'compound-eye-facet',
          accent,
          radius * 0.06,
          new Vector3((facet - 1) * radius * 0.24, -radius * 0.3, radius * 0.59)
        );
    }
    eye.userData.baseOpenness = eyeY;
    {
      const brow = new Mesh(new CapsuleGeometry(0.022, radius * 1.1, 3, 6), dark);
      brow.name = 'eyebrow';
      brow.position.set(0, radius * 0.92, radius * 0.39);
      brow.rotation.z = side * (a.mood === 'fierce' ? 1.05 : 1.85);
      brow.visible = a.mood === 'fierce' || a.mood === 'grumpy';
      eye.add(brow);
    }
    if (a.mood === 'odd' && side === 1) eye.scale.setScalar(0.82);
    eyes.add(eye);
    const blush = ellipsoid(
      headGroup,
      'blush',
      pink,
      new Vector3(0.065 * a.headSize, 0.027 * a.headSize, 0.014),
      new Vector3(side * headRadius.x * 0.59, -headRadius.y * 0.23, headRadius.z * 0.83)
    );
    blush.visible = a.mood === 'cute';
  }
  if (a.mood === 'odd') {
    const third = new Group();
    third.name = 'third-eye';
    third.position.set(0.04, headRadius.y * 0.62, headRadius.z * 0.74);
    headGroup.add(third);
    ball(third, 'third-eye-white', white, 0.08);
    ball(third, 'third-pupil', iris, 0.041, new Vector3(0, 0, 0.055));
    ball(third, 'third-glint', white, 0.013, new Vector3(-0.014, 0.019, 0.082));
  }

  const mouth = new Group();
  mouth.name = 'mouth';
  mouth.userData.petPart = 'mouth';
  mouth.position.set(0, -0.19 * a.headSize, headRadius.z * 0.91);
  headGroup.add(mouth);
  const smile = a.mood === 'grumpy' ? -1 : 1;
  const smileCurve = tube(
    mouth,
    'smile',
    [
      new Vector3(-0.095, -0.014, 0.025),
      new Vector3(0, -smile * 0.048, 0.041),
      new Vector3(0.095, -0.014, 0.025),
    ],
    0.013,
    dark
  );
  smileCurve.userData.baseSmile = smile;
  if (['cat', 'rabbit'].includes(a.species)) {
    for (const side of [-1, 1]) {
      ellipsoid(
        mouth,
        'muzzle',
        secondary,
        new Vector3(0.085, 0.057, 0.044),
        new Vector3(side * 0.068, 0.02, 0.016)
      );
      for (let row = 0; row < 2; row++)
        tube(
          mouth,
          'whisker',
          [
            new Vector3(side * 0.12, 0.024, 0.035),
            new Vector3(side * 0.25, 0.032 + row * -0.045, 0.027),
            new Vector3(side * 0.35, 0.066 + row * -0.1, 0.018),
          ],
          0.006,
          dark
        );
    }
    ellipsoid(mouth, 'nose', pink, new Vector3(0.045, 0.031, 0.028), new Vector3(0, 0.067, 0.05));
    if (a.species === 'rabbit') {
      const tooth = new Mesh(new BoxGeometry(0.065, 0.085, 0.035), white);
      tooth.name = 'rabbit-teeth';
      tooth.position.set(0, -0.044, 0.069);
      mouth.add(tooth);
      tube(
        mouth,
        'tooth-line',
        [new Vector3(0, -0.015, 0.09), new Vector3(0, -0.079, 0.09)],
        0.004,
        dark
      );
    }
  } else if (['dog', 'bear', 'dragon', 'turtle'].includes(a.species)) {
    const long = a.species === 'dog' || a.species === 'dragon';
    ellipsoid(
      mouth,
      `${a.species}-muzzle`,
      secondary,
      new Vector3(long ? 0.165 : 0.145, 0.086, long ? 0.13 : 0.07),
      new Vector3(0, 0.022, 0.025)
    );
    if (a.species !== 'turtle' && a.species !== 'dragon')
      ellipsoid(
        mouth,
        'nose',
        dark,
        new Vector3(a.species === 'bear' ? 0.068 : 0.058, 0.039, 0.037),
        new Vector3(0, 0.087, long ? 0.138 : 0.09)
      );
    for (const side of [-1, 1])
      if (a.species === 'dragon' || a.species === 'turtle')
        ball(mouth, 'nostril', dark, 0.012, new Vector3(side * 0.043, 0.045, long ? 0.151 : 0.083));
    tube(
      mouth,
      'muzzle-smile',
      [
        new Vector3(-0.074, -0.004, long ? 0.134 : 0.09),
        new Vector3(0, -0.035, long ? 0.159 : 0.102),
        new Vector3(0.074, -0.004, long ? 0.134 : 0.09),
      ],
      0.011,
      dark
    );
  } else if (a.species === 'fox') {
    const snout = new Mesh(new ConeGeometry(0.15, 0.25, 16), secondary);
    snout.name = 'fox-muzzle';
    snout.rotation.x = Math.PI / 2;
    snout.scale.y = 0.85;
    snout.position.set(0, 0.022, 0.052);
    mouth.add(snout);
    ball(mouth, 'nose', dark, 0.041, new Vector3(0, 0.02, 0.164));
  } else if (a.species === 'bird') {
    const beak = new Mesh(new ConeGeometry(0.105, 0.19, 4), accent);
    beak.name = 'beak';
    beak.rotation.x = Math.PI / 2;
    beak.scale.y = 0.8;
    beak.position.set(0, 0.023, 0.04);
    mouth.add(beak);
    tube(
      mouth,
      'beak-line',
      [
        new Vector3(-0.065, 0.0, 0.07),
        new Vector3(0, -0.008, 0.128),
        new Vector3(0.065, 0.0, 0.07),
      ],
      0.008,
      dark
    );
  } else if (a.species === 'fish') {
    const lips = new Mesh(new TorusGeometry(0.059, 0.018, 6, 20), accent);
    lips.name = 'fish-lips';
    lips.position.set(0, -0.005, 0.066);
    mouth.add(lips);
  } else if (a.species === 'axolotl') {
    tube(
      mouth,
      'axolotl-smile',
      [
        new Vector3(-0.14, 0.001, 0.012),
        new Vector3(0, -0.05, 0.047),
        new Vector3(0.14, 0.001, 0.012),
      ],
      0.014,
      dark
    );
  }
  if (a.mood === 'fierce' || a.species === 'monster')
    for (const side of [-1, 1]) {
      const tooth = new Mesh(new ConeGeometry(0.035, 0.09, 7), white);
      tooth.name = 'fang';
      tooth.rotation.z = Math.PI;
      tooth.position.set(side * 0.078, -0.033, 0.07);
      mouth.add(tooth);
    }

  // Distinct original emblems make these fantasy creatures rather than ordinary pets.
  if (['cat', 'fox', 'rabbit'].includes(a.species)) {
    for (const side of [-1, 0, 1]) {
      const leaf = ellipsoid(
        headGroup,
        'leaf-crest',
        accent,
        new Vector3(0.07, 0.17, 0.045),
        new Vector3(side * 0.095, headRadius.y * 0.91, -0.015)
      );
      leaf.rotation.z = -side * 0.55;
    }
  }
  if (['bear', 'monster', 'dragon'].includes(a.species)) {
    for (let plate = 0; plate < 3; plate++) {
      const crystal = new Mesh(new ConeGeometry(0.13, 0.3, 4), accent);
      crystal.name = 'mineral-ridge';
      crystal.position.set(
        0,
        bodyRadius.y * (0.9 - plate * 0.18),
        -bodyRadius.z * (0.2 + plate * 0.3)
      );
      crystal.rotation.x = -plate * 0.3;
      bodyGroup.add(crystal);
    }
  }
  const ears = new Group();
  ears.name = 'ears';
  headGroup.add(ears);
  if (a.ears !== 'none')
    for (const side of [-1, 1]) {
      const ear = new Group();
      ear.name = side < 0 ? 'earLeft' : 'earRight';
      ear.userData.petPart = side < 0 ? 'ear-left' : 'ear-right';
      const lateral = a.ears === 'dog' || a.ears === 'fins';
      ear.position.set(
        side * headRadius.x * (lateral ? 0.82 : 0.7),
        headRadius.y * (lateral ? 0.38 : 0.74),
        -0.025
      );
      if (a.species === 'dragon' && a.ears === 'long') {
        const horn = new Mesh(new ConeGeometry(0.12, 0.32, 5), accent);
        horn.name = 'ear-outer';
        horn.scale.setScalar(a.earSize);
        horn.position.y = 0.08 * a.earSize;
        horn.rotation.z = -side * 0.4;
        ear.add(horn);
      } else if (a.ears === 'cat') {
        const geometry = new ConeGeometry(0.16, 0.34, 3);
        const outer = new Mesh(geometry, primary);
        outer.name = 'ear-outer';
        outer.scale.set(a.earSize, a.earSize, a.earSize * 0.62);
        outer.position.y = 0.075 * a.earSize;
        outer.rotation.z = -side * 0.17;
        ear.add(outer);
        const inner = new Mesh(geometry, accent);
        inner.name = 'ear-inner';
        inner.scale.copy(outer.scale).multiplyScalar(0.64);
        inner.position.set(0, outer.position.y + 0.025, 0.065 * a.earSize);
        inner.rotation.z = outer.rotation.z;
        ear.add(inner);
      } else if (a.ears === 'fins') {
        const shape = new Shape();
        shape.moveTo(-0.02, -0.07);
        shape.quadraticCurveTo(side * 0.22, -0.15, side * 0.32, 0.15);
        shape.quadraticCurveTo(side * 0.11, 0.26, -0.02, 0.05);
        shape.closePath();
        const finMaterial = accent.clone();
        finMaterial.side = DoubleSide;
        const fin = new Mesh(new ShapeGeometry(shape, 10), finMaterial);
        fin.name = 'ear-fin';
        fin.scale.setScalar(a.earSize);
        ear.add(fin);
        tube(
          ear,
          'fin-ray',
          [
            new Vector3(),
            new Vector3(side * 0.14 * a.earSize, 0.07 * a.earSize, 0.005),
            new Vector3(side * 0.25 * a.earSize, 0.13 * a.earSize, 0.005),
          ],
          0.008,
          secondary
        );
      } else {
        const tall = a.ears === 'rabbit' || a.ears === 'long';
        const rx = (a.ears === 'dog' ? 0.145 : tall ? 0.105 : 0.145) * a.earSize;
        const ry = (a.ears === 'dog' ? 0.26 : tall ? 0.31 : 0.145) * a.earSize;
        const center = new Vector3(
          side * (a.ears === 'dog' ? 0.035 : 0.02),
          (a.ears === 'dog' ? -0.11 : tall ? 0.18 : 0.045) * a.earSize,
          0
        );
        ellipsoid(ear, 'ear-outer', primary, new Vector3(rx, ry, rx * 0.53), center);
        ellipsoid(
          ear,
          'ear-inner',
          accent,
          new Vector3(rx * 0.6, ry * 0.65, rx * 0.15),
          center.clone().add(new Vector3(0, 0, rx * 0.45))
        );
        ear.rotation.z = side * (a.ears === 'dog' ? 0.15 : -0.14);
      }
      ears.add(ear);
    }
  if (a.antennaLength > 0)
    for (const side of [-1, 1]) {
      const antenna = new Group();
      antenna.name = side < 0 ? 'antennaLeft' : 'antennaRight';
      antenna.position.set(side * headRadius.x * 0.35, headRadius.y * 0.75, -0.05);
      headGroup.add(antenna);
      const end = new Vector3(side * 0.16, 0.38 * a.antennaLength, -0.07);
      tube(
        antenna,
        'antenna',
        [
          new Vector3(),
          end
            .clone()
            .multiplyScalar(0.5)
            .add(new Vector3(0, 0.05, 0)),
          end,
        ],
        0.023,
        dark
      );
      ball(antenna, 'antenna-tip', accent, 0.055, end);
    }
  if (a.species === 'axolotl') {
    const gills = new Group();
    gills.name = 'axolotl-gills';
    headGroup.add(gills);
    for (const side of [-1, 1])
      for (let branch = 0; branch < 3; branch++) {
        const start = new Vector3(
          side * headRadius.x * 0.78,
          (branch - 1) * headRadius.y * 0.3,
          -0.05
        );
        const tip = start
          .clone()
          .add(new Vector3(side * (0.22 + (branch === 1 ? 0.07 : 0)), (branch - 1) * 0.11, -0.025));
        tube(gills, 'gill-frond', [start, start.clone().lerp(tip, 0.55), tip], 0.036, accent);
        for (const direction of [-1, 1]) {
          const fork = tip.clone().add(new Vector3(side * 0.025, direction * 0.055, 0.01));
          tube(gills, 'gill-branch', [tip.clone().lerp(start, 0.23), fork], 0.018, accent);
          ball(gills, 'gill-tip', pink, 0.025, fork);
        }
      }
  }
  if (a.species === 'fish') {
    for (const side of [-1, 1])
      for (let line = 0; line < 2; line++)
        tube(
          headGroup,
          'fish-gill',
          [
            new Vector3(side * headRadius.x * 0.8, -0.07 + line * 0.06, headRadius.z * 0.35),
            new Vector3(side * headRadius.x * 0.84, -0.09 + line * 0.06, headRadius.z * 0.48),
            new Vector3(side * headRadius.x * 0.75, -0.12 + line * 0.06, headRadius.z * 0.56),
          ],
          0.012,
          accent
        );
    for (const side of [-1, 1]) {
      const fin = ellipsoid(
        bodyGroup,
        'pectoral-fin',
        accent,
        new Vector3(0.21, 0.1, 0.055),
        new Vector3(side * bodyRadius.x * 0.92, -0.05, 0.06)
      );
      fin.rotation.z = side * 0.35;
    }
    ellipsoid(
      bodyGroup,
      'dorsal-fin',
      accent,
      new Vector3(0.055, 0.22, 0.21),
      new Vector3(0, bodyRadius.y * 0.73, -bodyRadius.z * 0.43)
    );
  }
  if (a.species === 'turtle') {
    const shell = ellipsoid(
      bodyGroup,
      'turtle-shell',
      accent,
      new Vector3(bodyRadius.x * 1.08, bodyRadius.y * 1.35, bodyRadius.z * 1.17),
      new Vector3(0, bodyRadius.y * 0.35, -bodyRadius.z * 0.2)
    );
    silhouette(shell);
    for (let plate = 0; plate < 5; plate++) {
      const angle = (plate * Math.PI * 2) / 5;
      const direction = new Vector3(
        Math.cos(angle) * 0.55,
        Math.sin(angle) * 0.55,
        -Math.sqrt(1 - 0.55 ** 2)
      );
      const panel = ellipsoid(
        bodyGroup,
        'shell-plate',
        secondary,
        new Vector3(bodyRadius.x * 0.16, bodyRadius.y * 0.13, 0.023),
        direction.clone().multiply(shell.scale).multiplyScalar(1.01).add(shell.position)
      );
      panel.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), direction);
    }
  }
  if (a.species === 'insect') {
    const seam = new Mesh(new TorusGeometry(0.31, 0.013, 6, 24), dark);
    seam.name = 'insect-shell-seam';
    seam.scale.set(a.bodyWidth, a.bodyHeight * 1.05, 1);
    seam.position.z = -bodyRadius.z * 0.65;
    bodyGroup.add(seam);
  }
  if (a.species === 'spirit')
    for (const side of [-1, 0, 1])
      ellipsoid(
        bodyGroup,
        'spirit-wisp',
        secondary,
        new Vector3(0.12, 0.19, 0.13),
        new Vector3(side * bodyRadius.x * 0.51, -bodyRadius.y * 0.72, -0.03)
      );

  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1,
      pair = Math.floor(i / 2);
    const hands =
      (!quadruped && a.species !== 'insect' && count >= 4 && pair > 0) ||
      (a.limbKind === 'hands' && count <= 2);
    let start = new Vector3(
      side * bodyRadius.x * (hands ? 0.93 : 0.69),
      hands ? bodyY + 0.1 - Math.max(0, pair - 1) * 0.15 : bodyY - bodyRadius.y * 0.68,
      quadruped ? (0.42 - (0.84 * pair) / (Math.ceil(count / 2) - 1)) * bodyRadius.z : -pair * 0.13
    );
    let end = start
      .clone()
      .add(new Vector3(side * (hands ? 0.26 * length : 0.12), -0.38 * length, 0.15));
    if (a.species === 'insect') {
      start.set(side * bodyRadius.x * 0.8, bodyY - 0.1 + pair * 0.05, (pair - 1) * 0.19);
      end.set(
        side * (bodyRadius.x + (0.26 + pair * 0.06) * length),
        0.14 + pair * 0.06,
        (pair - 1) * 0.25 + 0.08
      );
    }
    if (a.species === 'turtle')
      end = start.clone().add(new Vector3(side * 0.16, -0.25 * length, 0.13));
    if (!hands) end.y = 0.095;
    start = attachToBody(start);
    const limb = new Group();
    limb.name = 'custom-limb';
    limb.userData.petPart = 'leg';
    limb.userData.limbIndex = i;
    limb.userData.side = side;
    limb.userData.attachment = start.clone();
    limb.position.copy(start);
    root.add(limb);
    const localEnd = end.sub(start);
    localEnd.y = Math.max(localEnd.y, 0.08 - start.y);
    const mid = localEnd
      .clone()
      .multiplyScalar(0.5)
      .add(
        new Vector3(
          side * (a.species === 'insect' ? 0.08 : 0.015),
          a.species === 'insect' ? 0.12 : 0,
          0
        )
      );
    const radius =
      a.species === 'insect' ? 0.045 : a.species === 'bird' ? 0.055 : hands ? 0.115 : 0.15;
    tube(
      limb,
      a.limbKind === 'tentacles' ? 'tentacle' : 'limb',
      [new Vector3(), mid, localEnd],
      radius,
      primary
    );
    if (a.markings === 'socks')
      tube(
        limb,
        'sock',
        [mid.clone().lerp(localEnd, 0.1), mid.clone().lerp(localEnd, 0.6), localEnd],
        radius * 1.03,
        secondary
      );
    const foot = ellipsoid(
      limb,
      hands ? 'hand' : 'paw',
      primary,
      new Vector3(hands ? 0.13 : 0.18, hands ? 0.1 : 0.12, 0.19),
      localEnd
    );
    if (a.limbKind === 'tentacles') foot.scale.multiplyScalar(0.62);
    if (hands)
      for (let finger = 0; finger < 3; finger++)
        ellipsoid(
          limb,
          'finger',
          secondary,
          new Vector3(0.023, 0.067, 0.03),
          localEnd.clone().add(new Vector3((finger - 1) * 0.045, -0.04, 0.034))
        );
    if (a.limbKind === 'claws' || a.species === 'bird')
      for (let claw = 0; claw < 3; claw++) {
        if (a.species === 'bird')
          tube(
            limb,
            'bird-toe',
            [
              localEnd,
              localEnd.clone().add(new Vector3((claw - 1) * 0.055, -0.015, 0.11)),
              localEnd.clone().add(new Vector3((claw - 1) * 0.075, -0.015, 0.17)),
            ],
            0.019,
            accent
          );
        else {
          const nail = new Mesh(new ConeGeometry(0.025, 0.12, 6), accent);
          nail.name = 'claw';
          nail.rotation.x = Math.PI / 2;
          nail.position.copy(localEnd).add(new Vector3((claw - 1) * 0.05, 0, 0.12));
          limb.add(nail);
        }
      }
  }

  if (a.tail !== 'none') {
    const tail = new Group();
    tail.name = 'tail';
    tail.userData.petPart = 'tail';
    tail.position.copy(attachToBody(new Vector3(0, bodyY - bodyRadius.y * 0.34, -bodyRadius.z)));
    root.add(tail);
    if (a.tail === 'short') {
      ellipsoid(
        tail,
        'short-tail',
        primary,
        new Vector3(0.12, 0.13, 0.19),
        new Vector3(0, 0.035, -0.09)
      );
    } else {
      const end =
        a.tail === 'curled' ? new Vector3(0.29, 0.52, -0.04) : new Vector3(0.26, 0.19, -0.71);
      tube(
        tail,
        'tail-stem',
        [new Vector3(), new Vector3(0.25, 0.1, -0.37), new Vector3(0.39, 0.33, -0.51), end],
        a.tail === 'fluffy' ? 0.12 : 0.076,
        primary
      );
      if (a.tail === 'fluffy') {
        const fluff = ellipsoid(
          tail,
          'fluffy-tail',
          primary,
          new Vector3(0.18, 0.19, 0.35),
          new Vector3(0.25, 0.22, -0.46)
        );
        fluff.rotation.x = -0.42;
        ellipsoid(
          tail,
          'tail-tip',
          secondary,
          new Vector3(0.135, 0.14, 0.18),
          end.clone().add(new Vector3(0, 0.018, -0.07))
        );
      }
      if (a.tail === 'spiked') {
        const tip = new Mesh(new ConeGeometry(0.13, 0.24, 5), accent);
        tip.name = 'tail-spike';
        tip.position.copy(end);
        tail.add(tip);
      }
      if (a.tail === 'fin') {
        const finShape = new Shape();
        finShape.moveTo(0, 0);
        finShape.quadraticCurveTo(-0.14, 0.06, -0.22, 0.28);
        finShape.quadraticCurveTo(0, 0.21, 0.22, 0.28);
        finShape.quadraticCurveTo(0.14, 0.03, 0, 0);
        finShape.closePath();
        const finMaterial = accent.clone();
        finMaterial.side = DoubleSide;
        const fin = new Mesh(new ShapeGeometry(finShape, 12), finMaterial);
        fin.name = 'tail-fin';
        fin.position.copy(end);
        fin.rotation.z = -0.5;
        tail.add(fin);
        tube(
          tail,
          'tail-fin-ray',
          [
            end,
            end.clone().add(new Vector3(0, 0.13, 0.005)),
            end.clone().add(new Vector3(0, 0.23, 0.005)),
          ],
          0.009,
          secondary
        );
      }
    }
  }
  if (a.wings !== 'none')
    for (const side of [-1, 1]) {
      const wing = new Group();
      wing.name = 'wing';
      wing.userData.petPart = 'wing';
      wing.userData.side = side;
      wing.position.copy(attachToBody(new Vector3(side * bodyRadius.x * 0.7, bodyY + 0.17, -0.16)));
      root.add(wing);
      const membrane = new MeshToonMaterial({
        color: traits.accentColor,
        transparent: a.wings === 'insect',
        opacity: a.wings === 'insect' ? 0.68 : 1,
        depthWrite: a.wings !== 'insect',
        side: DoubleSide,
      });
      if (a.wings === 'bat') {
        const shape = new Shape();
        shape.moveTo(0, 0);
        shape.lineTo(0.78, 0.69);
        shape.quadraticCurveTo(0.64, 0.25, 0.52, 0.21);
        shape.quadraticCurveTo(0.35, 0.24, 0.31, 0.03);
        shape.quadraticCurveTo(0.18, 0.12, 0, 0);
        const web = new Mesh(new ShapeGeometry(shape, 10), membrane);
        web.name = 'wing-membrane';
        web.scale.set(side * a.wingSize, a.wingSize, 1);
        wing.add(web);
        for (const tip of [
          new Vector3(side * 0.78, 0.69, 0.012),
          new Vector3(side * 0.52, 0.21, 0.012),
        ])
          tube(
            wing,
            'wing-finger',
            [
              new Vector3(),
              tip.clone().multiplyScalar(a.wingSize * 0.5),
              tip.multiplyScalar(a.wingSize),
            ],
            0.019,
            primary
          );
      } else
        for (let piece = 0; piece < (a.wings === 'feather' ? 4 : 2); piece++) {
          const feather = ellipsoid(
            wing,
            a.wings === 'feather' ? 'feather' : 'insect-wing',
            membrane,
            new Vector3(
              0.23 * a.wingSize,
              (a.wings === 'feather' ? 0.34 : 0.44) * a.wingSize,
              0.039
            ),
            new Vector3(
              side * (0.18 + piece * 0.1) * a.wingSize,
              0.13 - piece * 0.085,
              -0.07 - piece * 0.02
            )
          );
          feather.rotation.z = side * (-0.65 - piece * 0.14);
        }
    }
  for (let i = 0; i < a.spikes; i++) {
    const angle = (i / Math.max(1, a.spikes)) * Math.PI * 1.6 + 0.7;
    const horn = new Mesh(new ConeGeometry(0.08, 0.22, 7), accent);
    horn.name = 'spike';
    horn.position.set(
      Math.cos(angle) * headRadius.x * 0.88,
      Math.sin(angle) * headRadius.y * 0.88,
      -0.09
    );
    horn.rotation.z = angle - Math.PI / 2;
    headGroup.add(horn);
  }
  if (a.coat === 'fluffy') {
    const furGeometry = new ConeGeometry(0.035, a.furLength * 0.85, 5);
    for (const [parent, radius, strokes, amount, name] of [
      [headGroup, headRadius, headStrokes, 72, 'fur'],
      [bodyGroup, bodyRadius, bodyStrokes, 56, 'body-fur'],
    ] as const) {
      const fur = new InstancedMesh(furGeometry, primary, amount);
      fur.name = name;
      const matrix = new Matrix4(),
        up = new Vector3(0, 1, 0);
      for (let index = 0; index < amount; index++) {
        const y = 1 - (2 * (index + 0.5)) / amount,
          angle = index * 2.399963;
        const direction = new Vector3(
          Math.sqrt(1 - y * y) * Math.cos(angle),
          y,
          Math.sqrt(1 - y * y) * Math.sin(angle)
        );
        if (direction.z > 0.5) direction.z *= -1;
        const position = sculptPoint(direction.clone(), strokes).multiply(radius);
        matrix.compose(
          position,
          new Quaternion().setFromUnitVectors(up, direction),
          new Vector3(1, direction.y < -0.25 ? 0.35 : 1, 1)
        );
        fur.setMatrixAt(index, matrix);
      }
      parent.add(fur);
    }
  }
  if (['epico', 'legendario', 'especial'].includes(traits.rarity)) {
    const halo = new Mesh(new TorusGeometry(0.35, 0.022, 6, 28), accent);
    halo.name = 'rarity-halo';
    halo.position.set(0, headRadius.y + 0.3, 0);
    halo.rotation.x = Math.PI / 2;
    headGroup.add(halo);
  }
  return root;
}

/** Shared geometry/materials and instancing buffers are released exactly once per model. */
export function disposePetModel(model: Group): void {
  const geometries = new Set<BufferGeometry>(),
    materials = new Set<Material>(),
    textures = new Set<Texture>();
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    if (object instanceof InstancedMesh) object.dispose();
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof Texture) textures.add(value);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  model.removeFromParent();
  model.clear();
}
