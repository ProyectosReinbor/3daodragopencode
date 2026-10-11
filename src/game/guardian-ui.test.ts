import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GuardianResponse, GuardianState } from '../../shared/guardian-types';
import { createStarterCharacter, type Character } from './characters';
import { createProfile, type PlayerProfile } from './profile';
import { mountGuardian } from './guardian-ui';

const preview = vi.hoisted(() => ({
  dispose: vi.fn(),
  loseContext: vi.fn(),
  mounted: [] as string[],
  react: vi.fn(),
  setCare: vi.fn(),
}));
const auth = vi.hoisted(() => ({ token: 'guardian-session' as string | null }));
vi.mock('./api', () => ({ getToken: () => auth.token }));
vi.mock('./pet-preview', () => ({
  mountPetPreview: (container: HTMLElement, pet: Character) => {
    preview.mounted.push(pet.id);
    const canvas = document.createElement('canvas');
    canvas.getContext = vi.fn().mockReturnValue({
      getExtension: () => ({ loseContext: preview.loseContext }),
    });
    container.appendChild(canvas);
    const stop = () => {
      preview.dispose();
      container.replaceChildren();
    };
    return Object.assign(stop, { react: preview.react, setCare: preview.setCare });
  },
}));

function snapshot(profile: PlayerProfile): GuardianResponse<PlayerProfile> {
  const guardian: GuardianState = {
    version: 1,
    serverNow: Date.now(),
    food: 8,
    eggs: [],
    care: {},
    genetics: {},
    discoveries: { species: ['cat'], genes: ['coat:fluffy'], zones: ['aldea'] },
    missions: [
      {
        id: 'firstcare',
        title: 'Un primer vínculo',
        description: 'Cuida a tu compañero.',
        progress: 0,
        target: 1,
        claimed: false,
        reward: { food: 5, coins: 10, xp: 10 },
      },
    ],
  };
  for (const pet of profile.characters!.characters) {
    guardian.care[pet.id] = {
      satiety: 75,
      energy: 80,
      mood: 80,
      hygiene: 80,
      affection: 35,
      health: 100,
      curiosity: 70,
      updatedAt: Date.now(),
      stage: 'baby',
      personality: 'curioso',
      activity: 'Conociendo su hogar',
    };
    guardian.genetics[pet.id] = {
      genomeId: `GEN-${pet.id}`,
      fingerprint: `fingerprint-${pet.id}`,
      generation: 0,
      parents: [],
      origin: 'founder',
      species: 'cat',
      affinity: 'tierra',
      knownGenes: ['coat:fluffy'],
      hiddenGenes: 5,
    };
  }
  return { profile, guardian };
}
function response(data: GuardianResponse<PlayerProfile>, status = 200): Response {
  return { ok: status < 400, status, json: async () => data } as Response;
}
async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}

describe('guardian habitat lifecycle and authoritative actions', () => {
  let container: HTMLElement;
  let profile: PlayerProfile;
  let fetchMock: ReturnType<typeof vi.fn>;
  let stop: () => void;
  let frames: FrameRequestCallback[];
  let callbacks: {
    onBack: ReturnType<typeof vi.fn>;
    onExplore: ReturnType<typeof vi.fn>;
    onProfile: ReturnType<typeof vi.fn>;
  };
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T12:00:00Z'));
    document.body.innerHTML = '<section id="guardian-screen"></section>';
    container = document.getElementById('guardian-screen')!;
    const pet = createStarterCharacter();
    pet.id = 'founder';
    pet.name = 'Nube';
    profile = createProfile(pet);
    profile.currency = 999;
    profile.world = { coins: 40, potions: 0, mana: 100, items: [], equipped: {}, kills: 0 };
    callbacks = { onBack: vi.fn(), onExplore: vi.fn(), onProfile: vi.fn() };
    preview.dispose.mockClear();
    preview.loseContext.mockClear();
    preview.mounted = [];
    preview.react.mockClear();
    preview.setCare.mockClear();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    auth.token = 'guardian-session';
    frames = [];
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => {
      frames.push(frame);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    fetchMock = vi.fn().mockResolvedValue(response(snapshot(profile)));
    vi.stubGlobal('fetch', fetchMock);
    stop = () => {};
  });
  afterEach(() => {
    stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  function click(selector: string): void {
    container.querySelector<HTMLButtonElement>(selector)!.click();
  }
  function paint(): void {
    const frame = frames.pop();
    frames = [];
    frame?.(performance.now());
  }
  function editName(value: string): void {
    const field = container.querySelector<HTMLInputElement>('[data-guardian-name-input]')!;
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function submitName(): void {
    container
      .querySelector<HTMLFormElement>('[data-guardian-name-form]')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  it('starts an empty account in the incubator and blocks exploration until a Pet is born', async () => {
    profile.characters!.characters = [];
    profile.characters!.selectedId = '';
    profile.selectedCharacter = '';
    const empty = snapshot(profile);
    empty.guardian.discoveries = { species: [], genes: [], zones: [] };
    fetchMock.mockResolvedValueOnce(response(empty));
    stop = mountGuardian(container, profile, callbacks);
    await settle();
    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain('Incubadora');
    expect(container.querySelectorAll('.guardian-egg-option')).toHaveLength(4);
    expect(container.querySelector('.guardian-wordmark')?.textContent).toBe('AODASE PETS');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('[data-guardian-name-form]')).toBeNull();
    expect(container.querySelector<HTMLButtonElement>('.guardian-explore')!.disabled).toBe(true);
    expect(container.querySelector('#guardian-explore-hint')?.textContent).toContain(
      'cuando nazca'
    );
    click('[data-guardian-nav="explore"]');
    expect(callbacks.onExplore).not.toHaveBeenCalled();
    const chosen = structuredClone(empty);
    chosen.guardian.eggs = [
      {
        id: 'first-egg',
        theme: 'forest',
        label: 'Huevo del bosque',
        status: 'incubating',
        care: 0,
        requiredCare: 3,
        readyAt: Date.now() + 30000,
      },
    ];
    fetchMock.mockResolvedValueOnce(response(chosen));
    click('[data-guardian-action="choose_egg"]');
    await settle();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      action: 'choose_egg',
      theme: 'forest',
    });
    expect(container.querySelector('.guardian-incubation-card')).not.toBeNull();
    expect(container.querySelector<HTMLButtonElement>('.guardian-explore')!.disabled).toBe(true);
    click('[aria-label="Volver a tu cuenta"]');
    expect(callbacks.onBack.mock.lastCall![0].characters.characters).toEqual([]);
  });

  it('shows the naming form after the first hatch and accepts the server-selected newborn', async () => {
    const baby = structuredClone(profile.characters!.characters[0]);
    baby.id = 'newborn';
    baby.name = 'Musgo';
    profile.characters!.characters = [];
    profile.characters!.selectedId = '';
    profile.selectedCharacter = '';
    const empty = snapshot(profile);
    const egg = {
      id: 'first-egg',
      theme: 'forest' as const,
      label: 'Huevo del bosque',
      status: 'ready' as const,
      care: 2,
      requiredCare: 3,
      readyAt: Date.now() + 1000,
    };
    empty.guardian.eggs = [egg];
    fetchMock.mockResolvedValueOnce(response(empty));
    stop = mountGuardian(container, profile, callbacks);
    await settle();
    const hatched = structuredClone(profile);
    hatched.characters!.characters = [baby];
    hatched.characters!.selectedId = baby.id;
    hatched.selectedCharacter = baby.id;
    const result = snapshot(hatched);
    result.guardian.eggs = [{ ...egg, status: 'hatched', petId: baby.id }];
    fetchMock.mockResolvedValueOnce(response(result));
    vi.advanceTimersByTime(1000);
    await settle();
    expect(callbacks.onProfile.mock.lastCall![0].selectedCharacter).toBe('newborn');
    expect(profile.characters!.characters).toEqual([]);
    expect(container.querySelector('label[for="guardian-name-input"]')?.textContent).toBe(
      'Nombre de tu Pet'
    );
    expect(container.querySelector<HTMLInputElement>('[data-guardian-name-input]')!.value).toBe(
      'Musgo'
    );
    expect(container.querySelector<HTMLButtonElement>('.guardian-explore')!.disabled).toBe(false);
    expect(container.querySelector('.guardian-explore')?.textContent).toContain('Musgo');
  });

  it('renames the local companion only after the server response while preserving selection and appearance', async () => {
    const second = structuredClone(profile.characters!.characters[0]);
    second.id = 'second';
    second.name = 'Musgo';
    profile.characters!.characters.push(second);
    fetchMock.mockResolvedValueOnce(response(snapshot(profile)));
    stop = mountGuardian(container, profile, callbacks);
    await settle();
    const picker = container.querySelector<HTMLSelectElement>('select')!;
    picker.value = 'second';
    picker.dispatchEvent(new Event('change', { bubbles: true }));
    let completeRename!: (value: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          completeRename = resolve;
        })
    );
    editName('  Luna\u0301 🐾  ');
    submitName();
    await settle();
    const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(payload).toMatchObject({ action: 'rename_pet', petId: 'second', name: 'Luná 🐾' });
    expect(payload.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(container.querySelector('#guardian-pet-name')?.textContent).toBe('Musgo');
    expect(profile.characters!.characters[1]).toEqual(second);
    const updated = structuredClone(profile);
    updated.characters!.characters[1].name = 'Luná 🐾';
    updated.revision = 12;
    completeRename(response(snapshot(updated)));
    await settle();
    expect(container.querySelector('#guardian-pet-name')?.textContent).toBe('Luná 🐾');
    const saved = callbacks.onProfile.mock.lastCall![0] as PlayerProfile;
    expect(saved.selectedCharacter).toBe('founder');
    expect(saved.characters!.selectedId).toBe('founder');
    expect(saved.characters!.characters[0]).toEqual(profile.characters!.characters[0]);
    expect(saved.characters!.characters[1]).toEqual({ ...second, name: 'Luná 🐾' });
    expect(saved.revision).toBe(12);
    expect(container.querySelector<HTMLInputElement>('[data-guardian-name-input]')!.value).toBe(
      'Luná 🐾'
    );
  });

  it('keeps invalid names inline and never submits blank, overlong or HTML input', async () => {
    stop = mountGuardian(container, profile, callbacks);
    await settle();
    for (const name of ['   ', 'a'.repeat(25), '<script>alert(1)</script>']) {
      editName(name);
      submitName();
      await settle();
      expect(
        container
          .querySelector<HTMLInputElement>('[data-guardian-name-input]')!
          .getAttribute('aria-invalid')
      ).toBe('true');
      expect(container.querySelector<HTMLElement>('.guardian-name-error')!.hidden).toBe(false);
      expect(container.querySelector('#guardian-pet-name')?.textContent).toBe('Nube');
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector('script')).toBeNull();
  });

  it('requires real authentication and shows an inline error without invented care data', async () => {
    auth.token = null;
    stop = mountGuardian(container, profile, callbacks);
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Necesitas iniciar sesión'
    );
    expect(container.querySelector('.guardian-needs')).toBeNull();
    expect(container.querySelector('.guardian-loading')).toBeNull();
  });

  it('aborts a disposed load and ignores its late response after another habitat mounts', async () => {
    let resolveOld!: (value: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveOld = resolve;
        })
    );
    const oldCallbacks = { ...callbacks, onProfile: vi.fn() };
    stop = mountGuardian(container, profile, oldCallbacks);
    const oldSignal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    stop();
    expect(oldSignal.aborted).toBe(true);
    const fresh = structuredClone(profile);
    fresh.characters!.characters[0].name = 'Nuevo hogar';
    fetchMock.mockResolvedValueOnce(response(snapshot(fresh)));
    stop = mountGuardian(container, fresh, callbacks);
    await settle();
    resolveOld(response(snapshot(profile)));
    await settle();
    expect(oldCallbacks.onProfile).not.toHaveBeenCalled();
    expect(container.querySelector('#guardian-pet-name')?.textContent).toBe('Nuevo hogar');
  });

  it('disposes the model and its WebGL context on tab change and unmount', async () => {
    stop = mountGuardian(container, profile, callbacks);
    await settle();
    paint();
    expect(preview.mounted).toEqual(['founder']);
    click('[data-guardian-tab="catalog"]');
    expect(preview.dispose).toHaveBeenCalledTimes(1);
    expect(preview.loseContext).toHaveBeenCalledTimes(1);
    click('[data-guardian-tab="habitat"]');
    paint();
    stop();
    stop();
    expect(preview.dispose).toHaveBeenCalledTimes(2);
    expect(preview.loseContext).toHaveBeenCalledTimes(2);
    expect(container.children.length).toBe(0);
  });

  it('cares for the locally selected pet without switching the active adventure pet', async () => {
    const second = structuredClone(profile.characters!.characters[0]);
    second.id = 'second';
    second.name = 'Musgo';
    profile.characters!.characters.push(second);
    fetchMock.mockResolvedValue(response(snapshot(profile)));
    stop = mountGuardian(container, profile, callbacks);
    await settle();
    const picker = container.querySelector<HTMLSelectElement>('select')!;
    picker.value = 'second';
    picker.dispatchEvent(new Event('change', { bubbles: true }));
    expect(profile.selectedCharacter).toBe('founder');
    expect(container.querySelector('.guardian-explore')?.textContent).toContain('Nube');
    expect(container.querySelector('.guardian-wallet')?.textContent).toContain('40');
    expect(container.querySelector('.guardian-wallet')?.textContent).not.toContain('999');
    click('[data-guardian-action="feed"]');
    await settle();
    const [path, options] = fetchMock.mock.calls[1];
    const payload = JSON.parse(options.body);
    expect(path).toBe('/api/guardian/action');
    expect(options.headers.Authorization).toBe('Bearer guardian-session');
    expect(payload).toMatchObject({ action: 'feed', petId: 'second' });
    expect(payload.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(payload.profile).toBeUndefined();
    expect(container.querySelector('#guardian-pet-name')?.textContent).toBe('Musgo');
    expect(callbacks.onProfile.mock.lastCall![0].selectedCharacter).toBe('founder');
    expect(
      container.querySelector<HTMLButtonElement>('[data-guardian-action="feed"]')!.disabled
    ).toBe(true);
    vi.advanceTimersByTime(3000);
    expect(
      container.querySelector<HTMLButtonElement>('[data-guardian-action="feed"]')!.disabled
    ).toBe(false);
  });

  it('does not retry ambiguous writes or invent progress; refresh reconciles before another action', async () => {
    stop = mountGuardian(container, profile, callbacks);
    await settle();
    fetchMock.mockRejectedValueOnce(new Error('Conexión interrumpida'));
    click('[data-guardian-action="feed"]');
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Conexión interrumpida'
    );
    expect(container.querySelector<HTMLProgressElement>('[aria-label="Saciedad"]')!.value).toBe(75);
    expect(
      container.querySelector<HTMLButtonElement>('[data-guardian-action="feed"]')!.disabled
    ).toBe(true);
    click('[data-guardian-refresh]');
    await settle();
    expect(fetchMock.mock.calls[2][0]).toBe('/api/guardian');
    expect(fetchMock.mock.calls[2][1].method).toBe('GET');
    expect(
      container.querySelector<HTMLButtonElement>('[data-guardian-action="feed"]')!.disabled
    ).toBe(false);
  });

  it('keeps the same preview during a confirmed care action and separates intention from success', async () => {
    stop = mountGuardian(container, profile, callbacks);
    await settle();
    paint();
    const originalCanvas = container.querySelector('.guardian-preview canvas');
    click('[data-guardian-action="play"]');
    expect(preview.react).toHaveBeenCalledWith('play', 'intent');
    await settle();
    expect(preview.react).toHaveBeenCalledWith('play', 'success');
    expect(preview.mounted).toEqual(['founder']);
    expect(preview.dispose).not.toHaveBeenCalled();
    expect(container.querySelector('.guardian-preview canvas')).toBe(originalCanvas);
    expect(preview.setCare).toHaveBeenLastCalledWith(expect.objectContaining({ energy: 80 }));
  });
  it('describes new species, markings, eye colors and genetic proportions in readable Spanish', async () => {
    const loaded = snapshot(profile);
    loaded.guardian.discoveries.species = ['fox', 'axolotl', 'turtle', 'fish'];
    loaded.guardian.genetics.founder.knownGenes = [
      'markings:mask',
      'eyeColor:violet',
      'primaryColor:11639753',
      'headSize:1.4',
    ];
    fetchMock.mockResolvedValueOnce(response(loaded));
    stop = mountGuardian(container, profile, callbacks);
    await settle();
    click('[data-guardian-tab="catalog"]');
    expect(container.querySelector('.guardian-lineage')?.textContent).toContain('Marcas: antifaz');
    expect(container.querySelector('.guardian-lineage')?.textContent).toContain(
      'Color de ojos: violeta'
    );
    expect(container.querySelector('.guardian-lineage')?.textContent).toContain(
      'Tamaño de cabeza: grande'
    );
    expect(container.querySelector('.guardian-lineage')?.textContent).not.toContain('11639753');
    expect(container.querySelector('.guardian-species-grid')?.textContent).toContain('Ajolote');
    expect(container.querySelector('.guardian-species-grid')?.textContent).toContain('Zorrito');
  });

  it('cancels a rejected care reaction without celebrating success', async () => {
    stop = mountGuardian(container, profile, callbacks);
    await settle();
    paint();
    fetchMock.mockRejectedValueOnce(new Error('Servidor sin conexión'));
    click('[data-guardian-action="feed"]');
    await settle();
    expect(preview.react.mock.calls).toEqual([
      ['feed', 'intent'],
      ['feed', 'cancel'],
    ]);
    expect(container.querySelector('.guardian-reaction')?.textContent).not.toContain('¡Qué rico!');
    expect(preview.mounted).toEqual(['founder']);
  });

  it('automatically hatches after ninety seconds with zero warming and resumes after visibility returns', async () => {
    let hidden = false;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    const loaded = snapshot(profile);
    const egg = {
      id: 'automatic-egg',
      theme: 'water' as const,
      label: 'Huevo de agua',
      status: 'incubating' as const,
      care: 0,
      requiredCare: 3,
      readyAt: Date.now() + 90000,
    };
    loaded.guardian.eggs = [egg];
    fetchMock.mockResolvedValueOnce(response(loaded));
    stop = mountGuardian(container, profile, callbacks);
    await settle();
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(90000);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const born = structuredClone(profile);
    const baby = structuredClone(profile.characters!.characters[0]);
    baby.id = 'automatic-baby';
    born.characters!.characters.push(baby);
    const result = snapshot(born);
    result.guardian.eggs = [{ ...egg, status: 'hatched', petId: baby.id }];
    fetchMock.mockResolvedValue(response(result));
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      action: 'hatch',
      eggId: 'automatic-egg',
    });
    expect(container.querySelector('.guardian-hatch-half--left')).not.toBeNull();
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(10000);
    expect(container.querySelector('.guardian-hatch-reveal')).not.toBeNull();
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(2000);
    expect(container.querySelector('.guardian-hatch-reveal')).toBeNull();
    vi.advanceTimersByTime(90000);
    await settle();
    click('[data-guardian-refresh]');
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1].method).toBe('GET');
    expect(container.querySelector('.guardian-hatch-reveal')).toBeNull();
  });

  it('animates cracks every twenty seconds even when warmth already advanced the shell', async () => {
    const loaded = snapshot(profile);
    loaded.guardian.eggs = [
      {
        id: 'crack-egg',
        theme: 'forest',
        label: 'Huevo del bosque',
        care: 1,
        requiredCare: 3,
        createdAt: Date.now(),
        readyAt: Date.now() + 90000,
        status: 'incubating',
      },
    ];
    fetchMock.mockResolvedValue(response(loaded));
    stop = mountGuardian(container, profile, callbacks);
    await settle();
    click('[data-guardian-tab="incubator"]');
    const scene = container.querySelector<HTMLElement>('[data-egg-scene]')!;
    expect(scene.dataset.crackStage).toBe('1');
    vi.advanceTimersByTime(20000);
    expect(scene.classList.contains('guardian-incubation-scene--cracking')).toBe(true);
    vi.advanceTimersByTime(1400);
    expect(scene.classList.contains('guardian-incubation-scene--cracking')).toBe(false);
    vi.advanceTimersByTime(18600);
    expect(scene.dataset.crackStage).toBe('2');
    expect(scene.classList.contains('guardian-incubation-scene--cracking')).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    'shows the birth scene after third warmth, reduced motion=%s',
    async (reducedMotion) => {
      vi.stubGlobal('matchMedia', () => ({ matches: reducedMotion }));
      const loaded = snapshot(profile);
      const egg = {
        id: 'warm-birth',
        theme: 'forest' as const,
        label: 'Huevo del bosque',
        care: 2,
        requiredCare: 3,
        createdAt: Date.now(),
        readyAt: Date.now() + 90000,
        status: 'incubating' as const,
      };
      loaded.guardian.eggs = [egg];
      const warm = structuredClone(loaded);
      warm.guardian.eggs[0].care = 3;
      warm.guardian.eggs[0].status = 'ready';
      const born = snapshot(profile);
      const baby = structuredClone(profile.characters!.characters[0]);
      baby.id = 'warm-baby';
      born.profile = structuredClone(profile);
      born.profile.characters!.characters.push(baby);
      born.guardian.eggs = [{ ...egg, care: 3, status: 'hatched', petId: baby.id }];
      fetchMock
        .mockResolvedValueOnce(response(loaded))
        .mockResolvedValueOnce(response(warm))
        .mockResolvedValueOnce(response(born));
      stop = mountGuardian(container, profile, callbacks);
      await settle();
      click('[data-guardian-tab="incubator"]');
      click('[data-guardian-action="warm_egg"]');
      await settle();
      expect(fetchMock.mock.calls.slice(1).map((call) => JSON.parse(call[1].body).action)).toEqual([
        'warm_egg',
        'hatch',
      ]);
      expect(container.querySelector('.guardian-hatch-reveal')).not.toBeNull();
      expect(callbacks.onProfile.mock.lastCall![0].characters.characters).toHaveLength(2);
      expect(container.querySelector('.guardian-hatch-baby canvas')).not.toBeNull();
      expect(
        container
          .querySelector('.guardian-hatch-reveal')
          ?.classList.contains('guardian-hatch-reveal--gentle')
      ).toBe(reducedMotion);
      vi.advanceTimersByTime(1900);
      expect(container.querySelector('.guardian-hatch-reveal')).not.toBeNull();
      vi.advanceTimersByTime(100);
      expect(container.querySelector('.guardian-hatch-reveal')).toBeNull();
    }
  );

  it('makes a single automatic hatch attempt and never loops retries after an error or refresh', async () => {
    const loaded = snapshot(profile);
    loaded.guardian.eggs = [
      {
        id: 'failed-egg',
        theme: 'forest',
        label: 'Huevo del bosque',
        status: 'incubating',
        care: 0,
        requiredCare: 3,
        readyAt: Date.now() + 90000,
      },
    ];
    fetchMock.mockResolvedValueOnce(response(loaded));
    stop = mountGuardian(container, profile, callbacks);
    await settle();
    fetchMock.mockRejectedValueOnce(new Error('Servidor sin conexión'));
    vi.advanceTimersByTime(90000);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Servidor sin conexión'
    );
    expect(container.querySelector('.guardian-hatch-reveal')).toBeNull();
    vi.advanceTimersByTime(90000);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    loaded.guardian.serverNow = Date.now();
    fetchMock.mockResolvedValueOnce(response(loaded));
    click('[data-guardian-refresh]');
    await settle();
    vi.advanceTimersByTime(2000);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(callbacks.onProfile.mock.lastCall![0].characters.characters).toHaveLength(1);
  });

  it('assigns mission XP to the local care companion and preserves the active adventure pet', async () => {
    const baby = structuredClone(profile.characters!.characters[0]);
    baby.id = 'baby';
    baby.name = 'Musgo';
    profile.characters!.characters.push(baby);
    const loaded = snapshot(profile);
    loaded.guardian.missions[0].progress = 1;
    fetchMock.mockResolvedValue(response(loaded));
    stop = mountGuardian(container, profile, callbacks);
    await settle();
    const picker = container.querySelector<HTMLSelectElement>('select')!;
    picker.value = 'baby';
    picker.dispatchEvent(new Event('change', { bubbles: true }));
    const claim = container.querySelector<HTMLButtonElement>(
      '[data-guardian-action="claim_mission"]'
    )!;
    expect(claim.dataset.petId).toBe('baby');
    expect(container.querySelector('.guardian-mission-bottom')?.textContent).toContain(
      '10 XP para Musgo'
    );
    claim.click();
    await settle();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      action: 'claim_mission',
      missionId: 'firstcare',
      petId: 'baby',
    });
    expect(callbacks.onProfile.mock.lastCall![0].selectedCharacter).toBe('founder');
    expect(callbacks.onProfile.mock.lastCall![0].characters.selectedId).toBe('founder');
    expect(container.querySelector('#guardian-pet-name')?.textContent).toBe('Musgo');
  });

  it('unlocks hatch from the server clock and reveals the actual new pet without replacing the founder', async () => {
    const loaded = snapshot(profile);
    loaded.guardian.serverNow += 5000;
    loaded.guardian.eggs.push({
      id: 'egg-1',
      theme: 'forest',
      label: 'Huevo del bosque',
      care: 2,
      requiredCare: 3,
      status: 'incubating',
      readyAt: loaded.guardian.serverNow + 2000,
    });
    fetchMock.mockResolvedValueOnce(response(loaded));
    stop = mountGuardian(container, profile, callbacks);
    await settle();
    click('[data-guardian-tab="incubator"]');
    expect(
      container.querySelector<HTMLButtonElement>('[data-guardian-action="hatch"]')!.disabled
    ).toBe(true);
    const hatched = structuredClone(profile);
    const baby = structuredClone(profile.characters!.characters[0]);
    baby.id = 'baby';
    baby.name = 'Musgo';
    hatched.characters!.characters.push(baby);
    const result = snapshot(hatched);
    result.guardian.eggs = [{ ...loaded.guardian.eggs[0], status: 'hatched', petId: 'baby' }];
    fetchMock.mockResolvedValueOnce(response(result));
    vi.advanceTimersByTime(2000);
    await settle();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      action: 'hatch',
      eggId: 'egg-1',
    });
    expect(container.querySelector('#guardian-pet-name')?.textContent).toBe('Musgo');
    expect(callbacks.onProfile.mock.lastCall![0].characters.characters).toHaveLength(2);
    expect(callbacks.onProfile.mock.lastCall![0].selectedCharacter).toBe('founder');
    expect(container.querySelector('.guardian-hatch-reveal')).not.toBeNull();
    vi.advanceTimersByTime(2000);
    expect(container.querySelector('.guardian-hatch-reveal')).toBeNull();
  });
});
