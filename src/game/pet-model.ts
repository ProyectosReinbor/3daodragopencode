import {
  Shape,
  ShapeGeometry,
  DoubleSide,
  Group,
  Mesh,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  SphereGeometry,
  BoxGeometry,
  ConeGeometry,
  CapsuleGeometry,
  TubeGeometry,
  CatmullRomCurve3,
  TorusGeometry,
  MeshStandardMaterial,
  type BufferGeometry,
} from 'three';
import type { NftTraits } from './nft';
import { DEFAULT_APPEARANCE, type SculptStroke } from '../../shared/pet-appearance.js';

export function sculptGeometry(geometry: BufferGeometry, strokes: SculptStroke[]): void {
  const positions = geometry.getAttribute('position');
  const point = new Vector3(),
    normal = new Vector3();
  const brushes = strokes.map((stroke) => ({
    stroke,
    center: new Vector3(stroke.x, stroke.y, stroke.z),
  }));
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    for (const { stroke, center } of brushes) {
      const distance = point.distanceTo(center);
      if (distance < stroke.radius) {
        const falloff = Math.pow(1 - distance / stroke.radius, 2);
        point.addScaledVector(normal.copy(point).normalize(), stroke.strength * falloff);
      }
    }
    point.clampScalar(-1.6, 1.6);
    positions.setXYZ(i, point.x, point.y, point.z);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

/** All avatars use the same persisted anatomy in the studio, collection and world. */
export function buildDesignedPet(traits: NftTraits): Group {
  const a = traits.appearance ?? DEFAULT_APPEARANCE;
  const root = new Group();
  root.name = 'designed-pet';
  const primary = new MeshStandardMaterial({
    color: traits.primaryColor,
    roughness: 0.65 + a.roughness * 0.3,
  });
  const secondary = new MeshStandardMaterial({ color: traits.secondaryColor, roughness: 0.8 });
  const accent = new MeshStandardMaterial({ color: traits.accentColor, roughness: 0.65 });
  const dark = new MeshStandardMaterial({ color: 0x263b36, roughness: 0.4 });
  const white = new MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.35 });
  const pink = new MeshStandardMaterial({ color: 0xe58a8f, roughness: 0.8 });
  const count = traits.limbCount ?? 4,
    length = traits.limbLength ?? 1;
  const bodyY = (count ? 0.45 * length : 0.15) + 0.5 * a.bodyHeight;
  const bodyRadius = new Vector3(0.46 * a.bodyWidth, 0.5 * a.bodyHeight, 0.39 * a.bodyWidth);
  const bodyGeometry =
    traits.bodyType === 'golem'
      ? new BoxGeometry(2, 2, 2, 20, 20, 20)
      : new SphereGeometry(1, 40, 28);
  sculptGeometry(
    bodyGeometry,
    a.sculpt.filter((s) => s.part === 'body')
  );
  const body = new Mesh(bodyGeometry, primary);
  body.name = 'sculpt-body';
  body.userData.part = 'body';
  body.position.y = bodyY;
  body.scale.copy(bodyRadius);
  root.add(body);
  const bellyGeometry = new SphereGeometry(1, 32, 24);
  sculptGeometry(
    bellyGeometry,
    a.sculpt.filter((stroke) => stroke.part === 'body')
  );
  const belly = new Mesh(bellyGeometry, secondary);
  belly.userData.part = 'body';
  belly.scale.set(bodyRadius.x * 0.7, bodyRadius.y * 0.75, 0.06);
  belly.position.set(0, bodyY, bodyRadius.z * 0.95);
  root.add(belly);
  const headY = bodyY + bodyRadius.y + 0.27 + a.headY;
  const headRadius = new Vector3(0.48 * a.headSize, 0.41 * a.headSize, 0.38 * a.headSize);
  const headGeometry =
    traits.headShape === 'cube'
      ? new BoxGeometry(2, 2, 2, 22, 22, 22)
      : new SphereGeometry(
          1,
          traits.headShape === 'diamond' ? 8 : 44,
          traits.headShape === 'diamond' ? 6 : 30
        );
  sculptGeometry(
    headGeometry,
    a.sculpt.filter((s) => s.part === 'head')
  );
  const head = new Mesh(headGeometry, primary);
  head.name = 'sculpt-head';
  head.userData.part = 'head';
  head.position.set(a.headX, headY, 0.05);
  head.scale.copy(headRadius);
  root.add(head);
  const sphere = (
    parent: Group,
    name: string,
    material = primary,
    size = 0.1,
    x = 0,
    y = 0,
    z = 0
  ) => {
    const mesh = new Mesh(new SphereGeometry(size, 16, 12), material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const curve = (points: Vector3[], radius: number, material = primary) =>
    new Mesh(new TubeGeometry(new CatmullRomCurve3(points), 18, radius, 7, false), material);
  for (const [side, key] of [
    [-1, 'eyeLeft'],
    [1, 'eyeRight'],
  ] as const) {
    const offset = a[key];
    const eye = new Group();
    eye.name = key;
    eye.userData.editableEye = key;
    eye.position.set(
      a.headX + side * 0.19 * a.headSize * a.eyeSpacing + offset.x,
      headY + 0.035 + a.eyeHeight + offset.y,
      0.05 + headRadius.z * 0.88 + offset.z
    );
    eye.rotation.z = side * a.eyeTilt;
    const sclera = sphere(
      eye,
      'eye-white',
      a.eyes === 'slit' || a.eyes === 'bug' ? dark : white,
      0.14 * a.eyeSize
    );
    sclera.scale.set(
      a.eyes === 'slit' ? 0.8 : 1,
      a.eyes === 'sleepy' ? 0.4 : a.eyes === 'slit' ? 1.35 : 1.1,
      0.65
    );
    if (a.eyes === 'round' || a.eyes === 'sleepy')
      sphere(eye, 'pupil', dark, 0.072 * a.eyeSize, side * -0.012, 0, 0.085 * a.eyeSize);
    sphere(eye, 'eye-glint', white, 0.029 * a.eyeSize, -0.035, 0.045, 0.095 * a.eyeSize);
    if (a.mood === 'fierce' || a.mood === 'grumpy') {
      const brow = new Mesh(new CapsuleGeometry(0.025, 0.19, 4, 6), dark);
      brow.position.set(0, 0.12 * a.eyeSize, 0.09);
      brow.rotation.z = side * (a.mood === 'fierce' ? 1 : 1.8);
      eye.add(brow);
    }
    if (a.mood === 'odd' && side === 1) eye.scale.setScalar(0.78);
    root.add(eye);
    const cheek = sphere(
      root,
      'blush',
      pink,
      0.08,
      a.headX + side * 0.3 * a.headSize,
      headY - 0.1,
      headRadius.z * 0.88
    );
    cheek.scale.set(1, 0.5, 0.2);
    cheek.visible = a.mood === 'cute';
  }
  if (a.mood === 'odd') {
    const extra = sphere(
      root,
      'third-eye',
      white,
      0.1,
      a.headX + 0.04,
      headY + headRadius.y * 0.65,
      headRadius.z * 0.7
    );
    sphere(
      root,
      'third-pupil',
      dark,
      0.045,
      extra.position.x,
      extra.position.y,
      extra.position.z + 0.08
    );
  }
  if (a.mood === 'fierce')
    for (const side of [-1, 1]) {
      const shoulder = sphere(
        root,
        'strong-shoulder',
        primary,
        0.17,
        side * bodyRadius.x * 0.8,
        bodyY + bodyRadius.y * 0.5,
        0
      );
      shoulder.scale.set(1.1, 1.25, 1);
    }
  const mouthY = headY - 0.19 * a.headSize,
    mouthZ = headRadius.z + 0.045;
  const smile = a.mood === 'grumpy' ? -1 : 1;
  const mouth = curve(
    [
      new Vector3(a.headX - 0.1, mouthY, mouthZ),
      new Vector3(a.headX, mouthY - smile * 0.04, mouthZ + 0.01),
      new Vector3(a.headX + 0.1, mouthY, mouthZ),
    ],
    0.013,
    dark
  );
  root.add(mouth);
  if (a.species === 'cat') {
    for (const side of [-1, 1]) {
      const muzzle = sphere(
        root,
        'muzzle',
        secondary,
        0.09,
        a.headX + side * 0.075,
        mouthY + 0.015,
        mouthZ - 0.01
      );
      muzzle.scale.set(1, 0.65, 0.5);
      for (let row = 0; row < 2; row++)
        root.add(
          curve(
            [
              new Vector3(a.headX + side * 0.16, mouthY + 0.01, mouthZ),
              new Vector3(a.headX + side * 0.39, mouthY + (row ? -0.025 : 0.06), mouthZ - 0.015),
            ],
            0.008,
            dark
          )
        );
    }
    const nose = sphere(root, 'nose', pink, 0.045, a.headX, mouthY + 0.065, mouthZ + 0.035);
    nose.scale.set(1.1, 0.75, 0.7);
  }
  if (a.mood === 'fierce' || a.species === 'monster') {
    for (const side of [-1, 1]) {
      const tooth = new Mesh(new ConeGeometry(0.04, 0.11, 8), white);
      tooth.rotation.z = Math.PI;
      tooth.position.set(a.headX + side * 0.08, mouthY - 0.025, mouthZ + 0.025);
      root.add(tooth);
    }
  }
  if (a.ears !== 'none')
    for (const side of [-1, 1]) {
      const ear = new Group();
      ear.name = 'ear';
      ear.position.set(a.headX + side * headRadius.x * 0.75, headY + headRadius.y * 0.78, 0);
      const shape =
        a.ears === 'cat' ? new ConeGeometry(0.18, 0.38, 3) : new SphereGeometry(0.15, 14, 10);
      const outer = new Mesh(shape, primary);
      outer.scale.set(1, a.ears === 'long' ? 2.8 * a.earSize : a.earSize, 0.7);
      outer.rotation.z = -side * 0.2;
      ear.add(outer);
      const inner = new Mesh(shape.clone(), accent);
      inner.scale.copy(outer.scale).multiplyScalar(0.65);
      inner.position.z = 0.055;
      inner.rotation.z = outer.rotation.z;
      ear.add(inner);
      root.add(ear);
    }
  if (a.antennaLength > 0)
    for (const side of [-1, 1]) {
      const start = new Vector3(a.headX + side * 0.2, headY + headRadius.y * 0.75, -0.02);
      const end = start.clone().add(new Vector3(side * 0.16, 0.4 * a.antennaLength, -0.08));
      root.add(
        curve(
          [
            start,
            start
              .clone()
              .lerp(end, 0.5)
              .add(new Vector3(0, 0.05, 0)),
            end,
          ],
          0.025,
          dark
        )
      );
      sphere(root, 'antenna-tip', accent, 0.065, end.x, end.y, end.z);
    }
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1,
      pair = Math.floor(i / 2);
    const limb = new Group();
    limb.name = 'custom-limb';
    root.add(limb);
    const hands = a.limbKind === 'hands' && (count <= 2 || pair > 0);
    const x = side * bodyRadius.x * (hands ? 0.98 : 0.7),
      y = hands ? bodyY + 0.1 - (pair - 1) * 0.18 : bodyY - bodyRadius.y * 0.7;
    const start = new Vector3(x, y, pair * -0.13);
    const end = start
      .clone()
      .add(new Vector3(side * (hands ? 0.3 * length : 0.13), -0.4 * length, 0.14));
    if (a.species === 'insect') {
      start.set(side * bodyRadius.x * 0.8, bodyY - 0.12 + pair * 0.06, (pair - 1) * 0.21);
      end.set(
        side * (bodyRadius.x + (0.3 + pair * 0.08) * length),
        0.13 + pair * 0.07,
        (pair - 1) * 0.29 + 0.08
      );
    }
    if (a.limbKind === 'tentacles') {
      limb.add(
        curve(
          [
            start,
            start
              .clone()
              .lerp(end, 0.5)
              .add(new Vector3(side * 0.13, 0, 0.1)),
            end.clone().add(new Vector3(side * 0.15, 0, 0.12)),
          ],
          0.055,
          primary
        )
      );
    } else {
      limb.add(
        curve(
          [
            start,
            start
              .clone()
              .lerp(end, 0.5)
              .add(a.species === 'insect' ? new Vector3(side * 0.06, 0.14, 0) : new Vector3()),
            end,
          ],
          a.species === 'insect' ? 0.04 : hands ? 0.07 : 0.1,
          primary
        )
      );
      const foot = sphere(
        limb,
        hands ? 'hand' : 'paw',
        secondary,
        hands ? 0.095 : 0.12,
        end.x,
        end.y,
        end.z
      );
      foot.scale.set(1.15, 0.65, 1.15);
      if (hands)
        for (let finger = 0; finger < 3; finger++) {
          const digit = new Mesh(new CapsuleGeometry(0.022, 0.08, 3, 5), primary);
          digit.position.set(end.x + (finger - 1) * 0.045, end.y - 0.075, end.z + 0.025);
          limb.add(digit);
        }
      if (a.limbKind === 'claws')
        for (let claw = 0; claw < 3; claw++) {
          const nail = new Mesh(new ConeGeometry(0.025, 0.14, 7), accent);
          nail.rotation.x = Math.PI / 2;
          nail.position.set(end.x + (claw - 1) * 0.055, end.y, end.z + 0.14);
          limb.add(nail);
        }
    }
  }
  if (a.tail !== 'none') {
    const end =
      a.tail === 'curled'
        ? new Vector3(0.35, bodyY + 0.55, -0.3)
        : new Vector3(0.35, bodyY + 0.2, -1.05);
    root.add(
      curve(
        [
          new Vector3(0, bodyY - 0.25, -bodyRadius.z),
          new Vector3(0.35, bodyY, -0.85),
          new Vector3(0.55, bodyY + 0.4, -0.7),
          end,
        ],
        0.09,
        primary
      )
    );
    if (a.tail === 'spiked') {
      const tip = new Mesh(new ConeGeometry(0.17, 0.3, 5), accent);
      tip.position.copy(end);
      root.add(tip);
    }
  }
  if (a.wings !== 'none')
    for (const side of [-1, 1]) {
      const wing = new Group();
      wing.name = 'wing';
      wing.position.set(side * bodyRadius.x * 0.7, bodyY + 0.22, -0.15);
      const membrane = new MeshStandardMaterial({
        color: traits.accentColor,
        transparent: a.wings === 'insect',
        opacity: a.wings === 'insect' ? 0.62 : 1,
        roughness: 0.5,
        depthWrite: a.wings !== 'insect',
        side: DoubleSide,
      });
      if (a.wings === 'bat') {
        const outline = new Shape();
        outline.moveTo(0, 0);
        outline.lineTo(0.95, 0.85);
        outline.quadraticCurveTo(0.8, 0.35, 0.67, 0.26);
        outline.quadraticCurveTo(0.5, 0.3, 0.45, 0.06);
        outline.quadraticCurveTo(0.25, 0.2, 0, 0);
        const web = new Mesh(new ShapeGeometry(outline, 16), membrane);
        web.scale.set(side * a.wingSize, a.wingSize, 1);
        wing.add(web);
        for (const tip of [
          new Vector3(side * 0.95, 0.85, 0.01),
          new Vector3(side * 0.67, 0.26, 0.01),
          new Vector3(side * 0.45, 0.06, 0.01),
        ]) {
          tip.multiplyScalar(a.wingSize);
          wing.add(curve([new Vector3(), tip.clone().multiplyScalar(0.5), tip], 0.02, primary));
        }
      } else
        for (let feather = 0; feather < (a.wings === 'feather' ? 4 : 2); feather++) {
          const piece = new Mesh(new SphereGeometry(1, 20, 14), membrane);
          piece.scale.set(
            0.36 * a.wingSize,
            (a.wings === 'feather' ? 0.4 : 0.56) * a.wingSize,
            0.045
          );
          piece.position.set(
            side * (0.24 + feather * 0.12) * a.wingSize,
            0.15 - feather * 0.1,
            -0.12 - feather * 0.025
          );
          piece.rotation.z = side * (-0.7 - feather * 0.15);
          wing.add(piece);
        }
      root.add(wing);
    }
  for (let i = 0; i < a.spikes; i++) {
    const angle = (i / Math.max(1, a.spikes)) * Math.PI * 1.6 + 0.7;
    const horn = new Mesh(new ConeGeometry(0.09, 0.27, 7), accent);
    horn.name = 'spike';
    horn.position.set(
      a.headX + Math.cos(angle) * headRadius.x * 0.9,
      headY + Math.sin(angle) * headRadius.y * 0.9,
      -0.12
    );
    horn.rotation.z = angle - Math.PI / 2;
    root.add(horn);
  }
  if (a.coat === 'fluffy') {
    const geometry = new CapsuleGeometry(0.012, a.furLength * 1.6, 3, 5);
    const fur = new InstancedMesh(geometry, primary, 190);
    fur.name = 'fur';
    const matrix = new Matrix4(),
      up = new Vector3(0, 1, 0);
    for (let i = 0; i < 190; i++) {
      const onHead = i < 105,
        index = onHead ? i : i - 105,
        amount = onHead ? 105 : 85;
      const y = 1 - (2 * (index + 0.5)) / amount,
        angle = index * 2.399963;
      const direction = new Vector3(
        Math.sqrt(1 - y * y) * Math.cos(angle),
        y,
        Math.sqrt(1 - y * y) * Math.sin(angle)
      );
      if (onHead && direction.z > 0.6) direction.z *= -1;
      const radius = onHead ? headRadius : bodyRadius;
      const position = direction
        .clone()
        .multiply(radius)
        .add(new Vector3(onHead ? a.headX : 0, onHead ? headY : bodyY, onHead ? 0.05 : 0));
      matrix.compose(
        position,
        new Quaternion().setFromUnitVectors(up, direction),
        new Vector3(1, 1, 1)
      );
      fur.setMatrixAt(i, matrix);
    }
    root.add(fur);
  } else if (a.coat !== 'smooth') {
    const material =
      a.coat === 'dirty' ? new MeshStandardMaterial({ color: 0x716447, roughness: 1 }) : secondary;
    const amount = a.coat === 'striped' ? 10 : a.coat === 'scales' ? 32 : 20;
    for (let i = 0; i < amount; i++) {
      const angle = i * 2.399963,
        y = -0.75 + (1.5 * (i + 0.5)) / amount;
      const direction = new Vector3(
        Math.cos(angle) * Math.sqrt(1 - y * y),
        y,
        Math.sin(angle) * Math.sqrt(1 - y * y)
      );
      const mark = sphere(
        root,
        'coat-mark',
        material,
        a.coat === 'dirty' ? 0.05 + a.roughness * 0.05 : 0.065
      );
      mark.position
        .copy(direction.clone().multiply(bodyRadius).multiplyScalar(1.025))
        .add(new Vector3(0, bodyY, 0));
      mark.scale.set(a.coat === 'striped' ? 2.3 : 1, a.coat === 'scales' ? 0.65 : 1, 0.4);
      mark.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), direction);
    }
  }
  if (a.species === 'insect') {
    const seam = new Mesh(new TorusGeometry(0.34, 0.016, 8, 30), dark);
    seam.scale.y = a.bodyHeight * 1.1;
    seam.position.set(0, bodyY, -0.19);
    root.add(seam);
  }
  if (['epico', 'legendario', 'especial'].includes(traits.rarity)) {
    const halo = new Mesh(new TorusGeometry(0.45, 0.025, 8, 32), accent);
    halo.position.set(a.headX, headY + headRadius.y + 0.38, 0);
    halo.rotation.x = Math.PI / 2;
    root.add(halo);
  }
  return root;
}
