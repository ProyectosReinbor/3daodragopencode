import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  type Object3D,
  type Euler,
  type Vector3,
} from 'three';

export type PetCareAction = 'feed' | 'play' | 'rest' | 'bathe' | 'pet' | 'train';
export type PetReactionPhase = 'intent' | 'success' | 'cancel';
export interface PetCareState {
  satiety?: number;
  energy?: number;
  mood?: number;
  hygiene?: number;
  affection?: number;
  health?: number;
  curiosity?: number;
  activity?: string;
  stage?: string;
}
export const PET_REACTION_SECONDS: Record<PetCareAction, number> = {
  feed: 3.2,
  play: 3.2,
  rest: 4,
  bathe: 3.6,
  pet: 3,
  train: 3.5,
};
interface RestPose {
  node: Object3D;
  position: Vector3;
  rotation: Euler;
  scale: Vector3;
  visible: boolean;
}
interface Reaction {
  action: PetCareAction;
  phase: 'intent' | 'success';
  elapsed: number;
  duration: number;
}

function heartShape(): Shape {
  const shape = new Shape();
  shape.moveTo(0, -0.12);
  shape.bezierCurveTo(-0.36, 0.05, -0.23, 0.35, 0, 0.17);
  shape.bezierCurveTo(0.23, 0.35, 0.36, 0.05, 0, -0.12);
  return shape;
}
function starShape(): Shape {
  const shape = new Shape();
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 + Math.PI / 2;
    const radius = i % 2 ? 0.09 : 0.2;
    if (!i) shape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    else shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  shape.closePath();
  return shape;
}

/** Small deterministic poses, driven only by visible elapsed time. No timers or account mutations. */
export function createPetAnimator(model: Group, reducedMotion = false) {
  const poses: RestPose[] = [];
  const parts = new Map<string, RestPose[]>();
  model.traverse((node) => {
    let part = node.userData.petPart as string | undefined;
    if (!part)
      part = (
        {
          'sculpt-head': 'head',
          'sculpt-body': 'body',
          eyeLeft: 'eye-left',
          eyeRight: 'eye-right',
          ear: 'ear',
          tail: 'tail',
          mouth: 'mouth',
          'custom-limb': 'leg',
          eyebrow: 'brow',
          iris: 'iris',
          pupil: 'pupil',
          blush: 'blush',
          smile: 'smile',
          'muzzle-smile': 'smile',
        } as Record<string, string>
      )[node.name];
    // Prefer the articulated group when its children retain editor-compatible mesh names.
    if (part && node.parent?.userData.petPart === part) return;
    if (node === model || part) {
      const pose = {
        node,
        position: node.position.clone(),
        rotation: node.rotation.clone(),
        scale: node.scale.clone(),
        visible: node.visible,
      };
      poses.push(pose);
      if (part) parts.set(part, [...(parts.get(part) || []), pose]);
    }
  });
  const effects = new Group();
  effects.name = 'pet-care-effects';
  const effectGroups = new Map<PetCareAction, Group>();
  const addEffect = (action: PetCareAction): Group => {
    const group = new Group();
    group.name = `care-${action}-prop`;
    group.visible = false;
    effectGroups.set(action, group);
    effects.add(group);
    return group;
  };
  const material = (color: number, opacity = 1) =>
    new MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1 });
  const food = addEffect('feed');
  const bowl = new Mesh(new TorusGeometry(0.24, 0.065, 8, 24), material(0xe4a175));
  bowl.rotation.x = Math.PI / 2;
  bowl.position.set(0, 0.12, 0.76);
  food.add(bowl);
  for (let i = 0; i < 5; i++) {
    const bite = new Mesh(new SphereGeometry(0.055, 8, 6), material(i % 2 ? 0x91b877 : 0xf4cf75));
    bite.position.set(Math.cos(i * 2) * 0.13, 0.16, 0.76 + Math.sin(i * 2) * 0.1);
    food.add(bite);
  }
  const play = addEffect('play');
  const ball = new Mesh(new SphereGeometry(0.17, 16, 12), material(0xe59f89));
  const ballBand = new Mesh(new TorusGeometry(0.171, 0.012, 6, 20), material(0xffedbd));
  ball.add(ballBand);
  play.add(ball);
  const sleep = addEffect('rest');
  for (let i = 0; i < 3; i++) {
    const letter = new Group();
    const blue = material(0x8ba7b2);
    for (const [y, diagonal] of [
      [0.085, false],
      [0, true],
      [-0.085, false],
    ] as const) {
      const line = new Mesh(new BoxGeometry(0.17, 0.023, 0.025), blue);
      line.position.y = y;
      if (diagonal) line.rotation.z = Math.PI / 4;
      letter.add(line);
    }
    letter.scale.setScalar(0.7 + i * 0.18);
    sleep.add(letter);
  }
  const bath = addEffect('bathe');
  for (let i = 0; i < 12; i++)
    bath.add(
      new Mesh(new SphereGeometry(0.055 + (i % 3) * 0.025, 12, 10), material(0xa8dfe4, 0.55))
    );
  const love = addEffect('pet');
  for (let i = 0; i < 4; i++)
    love.add(new Mesh(new ShapeGeometry(heartShape()), material(0xe697aa)));
  const train = addEffect('train');
  for (let i = 0; i < 5; i++)
    train.add(new Mesh(new ShapeGeometry(starShape()), material(0xe7c86e)));
  model.add(effects);
  let time = 0;
  let care: PetCareState = {};
  let reaction: Reaction | undefined;
  let disposed = false;
  const apply = (part: string, update: (pose: RestPose, index: number) => void) =>
    (parts.get(part) || []).forEach(update);
  function resetPoses(): void {
    for (const pose of poses) {
      pose.node.position.copy(pose.position);
      pose.node.rotation.copy(pose.rotation);
      pose.node.scale.copy(pose.scale);
      pose.node.visible = pose.visible;
    }
    effectGroups.forEach((group) => {
      group.visible = false;
    });
  }
  function step(deltaSeconds: number): void {
    if (disposed) return;
    const delta = Math.max(0, Math.min(5, Number.isFinite(deltaSeconds) ? deltaSeconds : 0));
    time += delta;
    resetPoses();
    if (reaction) {
      reaction.elapsed += delta;
      if (reaction.elapsed >= reaction.duration) reaction = undefined;
    }
    const tired = (care.energy ?? 80) < 25;
    const hungry = (care.satiety ?? 75) < 25;
    const sad = (care.mood ?? 80) < 35;
    if (!reducedMotion) {
      const breath = Math.sin(time * 2.1);
      model.position.y += breath * 0.009;
      model.rotation.y += Math.sin(time * 0.45) * 0.07;
      apply('body', ({ node }) => {
        node.scale.y *= 1 + breath * 0.012;
        node.scale.x *= 1 - breath * 0.004;
      });
      apply('head', ({ node }) => {
        node.rotation.z += Math.sin(time * 0.75) * 0.025;
        node.rotation.x += tired ? 0.13 : hungry ? 0.08 : Math.sin(time * 0.4) * 0.025;
      });
      const blinkPhase = time % 4.8;
      const blink = blinkPhase > 4.58 ? Math.max(0.08, Math.abs(blinkPhase - 4.69) / 0.11) : 1;
      for (const eye of ['eye-left', 'eye-right'])
        apply(eye, ({ node }) => {
          node.scale.y *= Math.min(1, blink);
        });
      for (const ear of ['ear-left', 'ear-right', 'ear'])
        apply(ear, ({ node }, i) => {
          node.rotation.z += Math.sin(time * 1.8 + i * 2) * 0.045;
        });
      apply('tail', ({ node }) => {
        node.rotation.y += Math.sin(time * 2.4) * (sad ? 0.05 : 0.15);
      });
    } else {
      apply('head', ({ node }) => {
        node.rotation.x += tired ? 0.1 : hungry ? 0.06 : 0;
      });
    }
    // Genes determine the resting design; authoritative needs and confirmed care
    // determine the live expression. Failed requests never produce a happy reaction.
    const confirmed = reaction?.phase === 'success' ? reaction.action : undefined;
    const hasCare = Object.keys(care).length > 0;
    if (hasCare || confirmed) {
      const expression =
        confirmed === 'rest'
          ? 'sleeping'
          : confirmed === 'pet'
            ? 'loved'
            : confirmed === 'train'
              ? 'focused'
              : confirmed
                ? 'happy'
                : tired
                  ? 'tired'
                  : sad || hungry || (care.health ?? 80) < 30
                    ? 'sad'
                    : (care.mood ?? 80) >= 75
                      ? 'happy'
                      : 'calm';
      model.userData.expression = expression;
      const opening = {
        sleeping: 0.15,
        loved: 0.45,
        focused: 0.85,
        happy: 1.15,
        tired: 0.55,
        sad: 0.75,
        calm: 1.05,
      }[expression];
      for (const eye of ['eye-left', 'eye-right'])
        apply(eye, ({ node }) => {
          node.scale.y *= opening / (node.userData.baseOpenness || 1);
          const side = eye === 'eye-left' ? -1 : 1;
          const brow = node.getObjectByName('eyebrow');
          if (brow) {
            brow.visible = ['sad', 'tired', 'focused'].includes(expression);
            brow.rotation.z =
              side * (expression === 'focused' ? 1.05 : expression === 'sad' ? 2.05 : 1.6);
          }
          node.rotation.z +=
            side * (expression === 'sad' ? -0.09 : expression === 'happy' ? 0.04 : 0);
        });
      apply('iris', ({ node, position }) => {
        node.position.y =
          position.y +
          (expression === 'sad' || expression === 'tired'
            ? -0.025
            : expression === 'happy'
              ? 0.008
              : 0);
      });
      apply('pupil', ({ node, position }) => {
        node.position.y =
          position.y +
          (expression === 'sad' || expression === 'tired'
            ? -0.025
            : expression === 'happy'
              ? 0.008
              : 0);
      });
      apply('smile', ({ node }) => {
        const sadFace = expression === 'sad' || expression === 'tired';
        node.scale.y *= (sadFace ? -1 : 1) / (node.userData.baseSmile || 1);
        if (expression === 'sleeping' || expression === 'focused') node.scale.y *= 0.35;
      });
      apply('blush', ({ node }) => {
        node.visible = expression === 'happy' || expression === 'loved';
      });
    }
    if (!reaction) return;
    const { action, phase, elapsed, duration } = reaction;
    const envelope = Math.sin(Math.min(1, elapsed / duration) * Math.PI);
    if (phase === 'intent') {
      if (!reducedMotion)
        apply('head', ({ node }) => {
          node.rotation.z += 0.08 * envelope;
        });
      return;
    }
    effectGroups.get(action)!.visible = true;
    const t = reducedMotion ? 0.8 : elapsed;
    const strength = reducedMotion ? 0 : envelope;
    if (action === 'feed') {
      apply('head', ({ node }) => {
        node.rotation.x += Math.max(0, Math.sin(t * 5)) * 0.13 * strength;
      });
      apply('mouth', ({ node }) => {
        node.scale.y *= 1 + Math.abs(Math.sin(t * 9)) * 0.8 * strength;
      });
      food.children.slice(1).forEach((bite, i) => {
        const biteTime = (t * 0.8 + i * 0.2) % 1;
        bite.position.y = 0.16 + biteTime * 0.7 * strength;
        bite.scale.setScalar(1 - biteTime * 0.65 * strength);
      });
    } else if (action === 'play') {
      model.position.y += Math.abs(Math.sin(t * 5)) * 0.22 * strength;
      model.rotation.z += Math.sin(t * 5) * 0.055 * strength;
      ball.position.set(
        Math.cos(t * 3) * 0.72,
        0.18 + Math.abs(Math.sin(t * 5)) * 0.33 * (reducedMotion ? 0 : 1),
        0.65
      );
      ball.rotation.z = reducedMotion ? 0 : -t * 4;
    } else if (action === 'rest') {
      model.position.y -= 0.09 * strength;
      apply('head', ({ node }) => {
        node.rotation.x += 0.14 * (reducedMotion ? 1 : strength);
      });

      sleep.children.forEach((letter, i) => {
        letter.position.set(
          0.48 + i * 0.18,
          1.65 + i * 0.24 + (reducedMotion ? 0 : (t * 0.17) % 0.3),
          0.3
        );
      });
    } else if (action === 'bathe') {
      model.rotation.z += Math.sin(t * 6) * 0.035 * strength;
      bath.children.forEach((bubble, i) => {
        const rise = (t * 0.35 + i / 12) % 1;
        bubble.position.set(
          Math.cos(i * 2.4 + t * 0.4) * 0.65,
          0.15 + rise * 2.15,
          0.3 + Math.sin(i * 2.4) * 0.4
        );
      });
    } else if (action === 'pet') {
      apply('head', ({ node }) => {
        node.rotation.z += Math.sin(t * 3) * 0.1 * strength;
      });

      love.children.forEach((heart, i) => {
        heart.position.set(
          (i % 2 ? 1 : -1) * (0.45 + i * 0.13),
          1.4 + ((t * 0.35 + i * 0.23) % 1) * 0.7,
          0.35
        );
        heart.scale.setScalar(0.38 + i * 0.12);
      });
    } else {
      model.position.y -= Math.abs(Math.sin(t * 5.5)) * 0.12 * strength;
      apply('leg', ({ node }, i) => {
        node.rotation.x += Math.sin(t * 5.5 + i * Math.PI) * 0.24 * strength;
      });
      train.children.forEach((star, i) => {
        const angle = (i * Math.PI * 2) / 5 + t * 0.5;
        star.position.set(Math.cos(angle) * 0.76, 1.3 + Math.sin(angle) * 0.6, 0.4);
        star.rotation.z = reducedMotion ? 0 : t;
        star.scale.setScalar(0.45);
      });
    }
  }
  return {
    step,
    react(action: PetCareAction, phase: PetReactionPhase = 'success'): void {
      if (disposed) return;
      reaction =
        phase === 'cancel'
          ? undefined
          : {
              action,
              phase,
              elapsed: 0,
              duration: phase === 'intent' ? 1.2 : PET_REACTION_SECONDS[action],
            };
      step(0);
    },
    setCare(value: PetCareState): void {
      care = { ...value };
      step(0);
    },
    setReducedMotion(value: boolean): void {
      reducedMotion = value;
      step(0);
    },
    get active(): boolean {
      return !!reaction;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      reaction = undefined;
      resetPoses();
      effects.removeFromParent();
      const geometries = new Set<Mesh['geometry']>();
      const materials = new Set<MeshBasicMaterial>();
      effects.traverse((node) => {
        if (node instanceof Mesh) {
          geometries.add(node.geometry);
          (Array.isArray(node.material) ? node.material : [node.material]).forEach((item) =>
            materials.add(item as MeshBasicMaterial)
          );
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((item) => item.dispose());
    },
  };
}
