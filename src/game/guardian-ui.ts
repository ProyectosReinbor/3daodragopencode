import type { PlayerProfile } from './profile';
import type { Character } from './characters';
import type {
  EggTheme,
  GuardianAction,
  GuardianEgg,
  GuardianState,
  GuardianResponse,
} from '../../shared/guardian-types';
import { getToken } from './api';
import { elementLabel } from './nft';
import { mountPetPreview, type PetPreviewController } from './pet-preview';
import { PET_REACTION_SECONDS, type PetReactionPhase } from './pet-animation';
import './guardian.css';

interface GuardianCallbacks {
  onBack: (updated: PlayerProfile) => void;
  onExplore: (updated: PlayerProfile) => void;
  onProfile: (updated: PlayerProfile) => void;
}
type GuardianTab = 'habitat' | 'incubator' | 'catalog';
type CareAction = 'feed' | 'play' | 'rest' | 'bathe' | 'pet' | 'train';

const THEMES: { id: EggTheme; name: string; hint: string; icon: string }[] = [
  { id: 'forest', name: 'Bosque', hint: 'Una pequeña vida entre hojas y tierra.', icon: '❧' },
  { id: 'fire', name: 'Brasa', hint: 'Su cáscara guarda una chispa cálida.', icon: '✹' },
  { id: 'water', name: 'Marea', hint: 'Escucha el suave rumor del agua.', icon: '≈' },
  { id: 'mystery', name: 'Misterio', hint: 'Su afinidad espera ser descubierta.', icon: '✦' },
];
const CARE_ACTIONS: { id: CareAction; name: string; hint: string; icon: string }[] = [
  { id: 'feed', name: 'Alimentar', hint: '1 alimento', icon: '◒' },
  { id: 'play', name: 'Jugar', hint: '+2 alimentos', icon: '✧' },
  { id: 'rest', name: 'Descansar', hint: 'Recupera energía', icon: '☾' },
  { id: 'bathe', name: 'Bañar', hint: 'Limpieza y bienestar', icon: '≈' },
  { id: 'pet', name: 'Acariciar', hint: 'Un momento juntos', icon: '♡' },
  { id: 'train', name: 'Entrenar', hint: 'Estimula su curiosidad', icon: '◎' },
];
const REACTIONS: Record<CareAction, string> = {
  feed: '¡Qué rico! Su pancita está más feliz.',
  play: 'Un pequeño juego, una gran amistad.',
  rest: 'Se acomoda para recuperar sus energías.',
  bathe: '¡Fresco y listo para otro día!',
  pet: 'Se acerca a ti con cariño.',
  train: 'Aprender juntos despierta su curiosidad.',
};
const STAGES = { baby: 'Bebé', juvenile: 'Joven', adult: 'Adulto' };
const WORDS: Record<string, string> = {
  curious: 'Curioso',
  playful: 'Juguetón',
  calm: 'Tranquilo',
  brave: 'Valiente',
  affectionate: 'Cariñoso',
  independent: 'Independiente',
  resting: 'Descansando',
  idle: 'Disfrutando del hábitat',
  happy: 'Feliz',
  hungry: 'Con hambre',
  forest: 'Bosque',
  fire: 'Fuego',
  water: 'Agua',
  mystery: 'Misterio',
  founder: 'Fundador',
  egg: 'Nacido de un huevo',
  exploring: 'Explorando',
  playing: 'Jugando',
  training: 'Aprendiendo',
  cat: 'Gatito',
  insect: 'Insecto',
  alien: 'Extraterrestre',
  monster: 'Monstruito',
  dragon: 'Dragoncito',
  spirit: 'Espíritu',
  dog: 'Perrito',
  rabbit: 'Conejito',
  fox: 'Zorrito',
  bear: 'Osito',
  bird: 'Pajarito',
  axolotl: 'Ajolote',
  turtle: 'Tortuguita',
  fish: 'Pececito',
  curioso: 'Curioso',
  tierra: 'Tierra',
  fuego: 'Fuego',
  agua: 'Agua',
  aire: 'Aire',
  sombra: 'Sombra',
  luz: 'Luz',
  aldea: 'Aldea',
};
function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char]!
  );
}
function label(value: string): string {
  if (value.startsWith('egg:')) return `Huevo de ${label(value.slice(4)).toLowerCase()}`;
  if (value.includes(':')) {
    const [gene, variant] = value.split(':');
    const geneNames: Record<string, string> = {
      coat: 'Pelaje',
      ears: 'Orejas',
      wings: 'Alas',
      tail: 'Cola',
      eyes: 'Ojos',
      markings: 'Marcas',
      eyeColor: 'Color de ojos',
      primaryColor: 'Color principal',
      secondaryColor: 'Color secundario',
      accentColor: 'Color de detalles',
      headShape: 'Forma de cabeza',
      headSize: 'Tamaño de cabeza',
      bodyWidth: 'Anchura de cuerpo',
      bodyHeight: 'Altura de cuerpo',
      eyeSize: 'Tamaño de ojos',
      eyeSpacing: 'Separación de ojos',
      earSize: 'Tamaño de orejas',
      wingSize: 'Tamaño de alas',
      limbLength: 'Largo de extremidades',
      limbCount: 'Extremidades',
      bodyType: 'Anatomía',
      limbKind: 'Extremidades',
      antennaLength: 'Largo de antenas',
      furLength: 'Largo de pelaje',
      roughness: 'Textura',
      spikes: 'Púas',
    };
    const variants: Record<string, string> = {
      smooth: 'liso',
      fluffy: 'esponjoso',
      striped: 'rayado',
      spotted: 'con manchas',
      dirty: 'terroso',
      scales: 'escamas',
      cat: 'felinas',
      long: 'largas',
      round: 'redondos',
      none: 'sin este rasgo',
      insect: 'de insecto',
      feather: 'de plumas',
      bat: 'de murciélago',
      curled: 'rizada',
      spiked: 'con púas',
      slit: 'rasgados',
      bug: 'de insecto',
      sleepy: 'soñolientos',
      sparkling: 'brillantes',
      marbled: 'marmolado',
      calico: 'tricolor',
      tuxedo: 'tipo esmoquin',
      dog: 'caídas',
      rabbit: 'de conejo',
      fins: 'aletas',
      fin: 'de aleta',
      short: 'corta',
      mask: 'antifaz',
      socks: 'calcetines',
      blaze: 'franja clara',
      freckles: 'pecas',
      bands: 'bandas',
      mint: 'menta',
      sky: 'celeste',
      amber: 'ámbar',
      violet: 'violeta',
      rose: 'rosa',
      lime: 'lima',
      cube: 'cuadrada',
      diamond: 'diamante',
      paws: 'patitas',
      hands: 'manos',
      tentacles: 'tentáculos',
      claws: 'garras',
      bestia: 'animal',
      humanoid: 'humanoide',
      golem: 'robusta',
      espectral: 'etérea',
    };
    if (['primaryColor', 'secondaryColor', 'accentColor'].includes(gene)) {
      const color = Number(variant.replace(/^#/, '0x'));
      if (Number.isFinite(color)) {
        const r = (color >> 16) & 255,
          g = (color >> 8) & 255,
          b = color & 255;
        const max = Math.max(r, g, b),
          min = Math.min(r, g, b),
          delta = max - min;
        const hue = delta
          ? ((max === r ? (g - b) / delta : max === g ? 2 + (b - r) / delta : 4 + (r - g) / delta) *
              60 +
              360) %
            360
          : 0;
        const tone =
          delta < 22
            ? max > 225
              ? 'marfil'
              : max > 150
                ? 'gris claro'
                : 'grafito'
            : [
                'coral',
                'melocotón',
                'dorado',
                'lima',
                'verde',
                'menta',
                'turquesa',
                'celeste',
                'azul',
                'lavanda',
                'violeta',
                'rosa',
              ][Math.floor(hue / 30)];
        return `${geneNames[gene]}: ${tone}`;
      }
    }
    if (
      [
        'headSize',
        'bodyWidth',
        'bodyHeight',
        'eyeSize',
        'eyeSpacing',
        'earSize',
        'wingSize',
        'limbLength',
        'antennaLength',
        'furLength',
        'roughness',
      ].includes(gene) &&
      Number.isFinite(Number(variant))
    ) {
      const size = Number(variant);
      if (gene === 'roughness')
        return `Textura: ${size < 0.35 ? 'suave' : size > 0.7 ? 'rugosa' : 'mate'}`;
      if (gene === 'furLength')
        return `Largo de pelaje: ${size < 0.06 ? 'corto' : size > 0.1 ? 'largo' : 'medio'}`;
      if (gene === 'antennaLength')
        return `Antenas: ${size === 0 ? 'ausentes' : size < 0.4 ? 'cortas' : size > 1 ? 'largas' : 'medias'}`;
      return `${geneNames[gene]}: ${size < 0.9 ? 'pequeño' : size > 1.2 ? 'grande' : 'medio'}`;
    }
    return `${geneNames[gene] || gene}: ${variants[variant] || variant}`;
  }
  return WORDS[value] || value;
}
function timestamp(value: number | string): number {
  return typeof value === 'number' ? value : Date.parse(value);
}
function percent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
function incubationWait(seconds: number): string {
  if (seconds <= 120) return `${seconds} s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} min`;
  if (seconds < 86400)
    return `${Math.floor(seconds / 3600)} h ${Math.ceil((seconds % 3600) / 60)} min`;
  const days = Math.ceil(seconds / 86400);
  return `${days} día${days === 1 ? '' : 's'}`;
}
function eggVisual(theme: EggTheme, cracked = false): string {
  return `<div class="guardian-egg guardian-egg--${theme}${cracked ? ' guardian-egg--cracked' : ''}" aria-hidden="true"><span class="guardian-egg-mark">${THEMES.find((item) => item.id === theme)?.icon || '✦'}</span><span class="guardian-egg-crack"></span></div>`;
}
function hatchReveal(theme: EggTheme, reduced = false): string {
  return `<div class="guardian-hatch-reveal${reduced ? ' guardian-hatch-reveal--gentle' : ''}" role="status"><div class="guardian-hatch-stage guardian-hatch-stage--${theme}" aria-hidden="true"><div class="guardian-hatch-baby" aria-label="Tu nueva mascota saliendo del huevo"></div><span class="guardian-hatch-light">✦</span><div class="guardian-hatch-whole">${eggVisual(theme, true)}</div><div class="guardian-hatch-half guardian-hatch-half--left">${eggVisual(theme, true)}</div><div class="guardian-hatch-half guardian-hatch-half--right">${eggVisual(theme, true)}</div>${Array.from({ length: 6 }, (_, i) => `<span class="guardian-shell-fragment" style="--fragment-x:${(i % 2 ? 1 : -1) * (40 + i * 14)}px;--fragment-y:${24 + i * 12}px;--fragment-turn:${(i % 2 ? 1 : -1) * (40 + i * 26)}deg"></span>`).join('')}</div><span>¡Una nueva amistad!</span></div>`;
}
function meter(name: string, value: number, tone = ''): string {
  const amount = percent(value);
  return `<div class="guardian-need ${tone}"><div><span>${name}</span><b>${amount}<small> / 100</small></b></div><progress max="100" value="${amount}" aria-label="${name}">${amount}%</progress></div>`;
}

/** A server-owned habitat; selecting a companion here does not change the active adventure pet. */
export function mountGuardian(
  container: HTMLElement,
  initialProfile: PlayerProfile,
  callbacks: GuardianCallbacks
): () => void {
  let profile = initialProfile;
  let guardian: GuardianState | undefined;
  let selectedPetId = profile.selectedCharacter || profile.characters?.selectedId || '';
  let tab: GuardianTab = profile.characters?.characters.length ? 'habitat' : 'incubator';
  let selectedTheme: EggTheme = 'forest';
  let disposed = false;
  let pending = false;
  let loading = true;
  let needsRefresh = false;
  let error = '';
  let notice = '';
  let reaction = '';
  let revealedEgg: EggTheme | undefined;
  let warmedEggId = '';
  const crackStages = new Map<string, number>();
  let serverOffset = 0;
  let requestSequence = 0;
  let previewStop: PetPreviewController | undefined;
  let birthPreviewStop: PetPreviewController | undefined;
  let previewHost: HTMLElement | undefined;
  let previewKey = '';
  let previewFrame = 0;
  interface VisibleDelay {
    remaining: number;
    started: number;
    handle?: ReturnType<typeof setTimeout>;
    callback: () => void;
  }
  let revealTimer: VisibleDelay | undefined;
  let warmTimer: VisibleDelay | undefined;
  let reactionTimer: VisibleDelay | undefined;
  let activeReaction: { petId: string; action: CareAction; phase: PetReactionPhase } | undefined;
  let autoHatchQueued = false;
  const autoHatchAttempts = new Set<string>();
  const visibleDelays = new Set<VisibleDelay>();
  let nameError = '';
  const controllers = new Set<AbortController>();
  const cooldowns = new Map<string, number>();
  const nameDrafts = new Map<string, string>();
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  function pets(): Character[] {
    return profile.characters?.characters || [];
  }
  function selectedPet(): Character | undefined {
    return pets().find((pet) => pet.id === selectedPetId) || pets()[0];
  }
  function resumeDelay(delay: VisibleDelay): void {
    if (disposed || document.hidden || delay.handle !== undefined) return;
    delay.started = Date.now();
    delay.handle = setTimeout(() => {
      visibleDelays.delete(delay);
      delay.handle = undefined;
      if (!disposed) delay.callback();
    }, delay.remaining);
  }
  function visibleTimeout(callback: () => void, milliseconds: number): VisibleDelay {
    const delay = { remaining: milliseconds, started: Date.now(), callback };
    visibleDelays.add(delay);
    resumeDelay(delay);
    return delay;
  }
  function cancelVisibleTimeout(delay?: VisibleDelay): void {
    if (!delay) return;
    clearTimeout(delay.handle);
    visibleDelays.delete(delay);
  }
  function reactToCare(petId: string, action: CareAction, phase: PetReactionPhase): void {
    if (selectedPet()?.id !== petId) return;
    cancelVisibleTimeout(reactionTimer);
    activeReaction = phase === 'cancel' ? undefined : { petId, action, phase };
    previewStop?.react?.(action, phase);
    if (phase === 'success') {
      reactionTimer = visibleTimeout(() => {
        if (activeReaction?.petId !== petId || activeReaction.action !== action) return;
        activeReaction = undefined;
        reaction = '';
        const line = container.querySelector<HTMLElement>('.guardian-reaction');
        if (line) line.textContent = guardian?.care[petId]?.activity || 'Disfrutando de su hogar';
      }, PET_REACTION_SECONDS[action] * 1000);
    }
  }
  function releasePreview(): void {
    cancelAnimationFrame(previewFrame);
    const canvases = [...(previewHost?.querySelectorAll<HTMLCanvasElement>('canvas') || [])];
    const ownsContextCleanup = previewStop?.ownsContextCleanup;
    previewStop?.();
    previewStop = undefined;
    previewHost = undefined;
    previewKey = '';
    if (ownsContextCleanup) return;
    for (const canvas of canvases) {
      try {
        const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
        context?.getExtension('WEBGL_lose_context')?.loseContext();
      } catch {
        /* A browser without WebGL uses the preview's static fallback. */
      }
    }
  }
  function buttonDisabled(extra = false): string {
    return pending || loading || needsRefresh || extra ? ' disabled' : '';
  }
  function coolingDown(key: string): boolean {
    return (cooldowns.get(key) || 0) > Date.now() + serverOffset;
  }
  function petPicker(): string {
    const owned = pets();
    if (!owned.length) return '';
    return `<label class="guardian-pet-picker"><span>Tu compañero</span><select data-guardian-select aria-label="Elegir compañero para cuidar">${owned.map((pet) => `<option value="${escapeHtml(pet.id)}"${pet.id === selectedPet()?.id ? ' selected' : ''}>${escapeHtml(pet.name)}</option>`).join('')}</select></label>`;
  }
  function exploreControl(): string {
    if (!pets().length) {
      return '<div class="guardian-explore-wrap"><button type="button" class="guardian-button guardian-button--outline guardian-explore" data-guardian-nav="explore" disabled aria-describedby="guardian-explore-hint">Explorar el mundo 3D <span aria-hidden="true">↗</span></button><p id="guardian-explore-hint">Tu Pet podrá acompañarte cuando nazca. Cuida tu huevo en la incubadora.</p></div>';
    }
    const active = pets().find((pet) => pet.id === profile.selectedCharacter) || pets()[0];
    return `<button type="button" class="guardian-button guardian-button--outline guardian-explore" data-guardian-nav="explore"${pending ? ' disabled' : ''}>Explorar con ${escapeHtml(active.name)} <span aria-hidden="true">↗</span></button>`;
  }
  function nameForm(pet: Character): string {
    const draft = nameDrafts.get(pet.id) ?? pet.name;
    return `<section class="guardian-name-panel" aria-labelledby="guardian-name-heading"><div><p class="guardian-eyebrow">SU HISTORIA CONTIGO</p><h2 id="guardian-name-heading">Un nombre muy suyo</h2><p>Puedes cambiarlo cuando quieras.</p></div><form class="guardian-name-form" data-guardian-name-form data-pet-id="${escapeHtml(pet.id)}"><label for="guardian-name-input">Nombre de tu Pet</label><div class="guardian-name-input-row"><input id="guardian-name-input" name="pet-name" type="text" autocomplete="off" required maxlength="48" value="${escapeHtml(draft)}" placeholder="¿Cómo se llamará?" data-guardian-name-input data-pet-id="${escapeHtml(pet.id)}" data-guardian-focus="name-${escapeHtml(pet.id)}" aria-describedby="guardian-name-hint${nameError ? ' guardian-name-error' : ''}"${nameError ? ' aria-invalid="true"' : ''}${pending ? ' readonly' : ''}><button type="submit" class="guardian-button" data-guardian-name-submit${buttonDisabled(draft.trim().normalize('NFC') === pet.name)}>Guardar nombre</button></div><p class="guardian-name-hint" id="guardian-name-hint">De 1 a 24 caracteres, en una sola línea.</p><p class="guardian-name-error" id="guardian-name-error" role="alert"${nameError ? '' : ' hidden'}>${escapeHtml(nameError)}</p></form></section>`;
  }
  function missions(): string {
    if (!guardian?.missions.length) return '';
    return `<section class="guardian-missions" aria-labelledby="guardian-mission-heading"><div class="guardian-section-heading"><div><p class="guardian-eyebrow">PEQUEÑOS PASOS</p><h2 id="guardian-mission-heading">Una amistad que crece</h2></div><span class="guardian-pill">Misiones de bienvenida</span></div><div class="guardian-mission-grid">${guardian.missions
      .map((mission, index) => {
        const complete = mission.progress >= mission.target;
        const reward = [
          mission.reward.food &&
            `${mission.reward.food} alimento${mission.reward.food === 1 ? '' : 's'}`,
          mission.reward.coins && `${mission.reward.coins} monedas`,
          mission.reward.xp &&
            `${mission.reward.xp} XP${!mission.claimed && selectedPet() ? ` para ${selectedPet()!.name}` : ''}`,
        ]
          .filter(Boolean)
          .join(' · ');
        return `<article class="guardian-mission${mission.claimed ? ' guardian-mission--claimed' : ''}"><span class="guardian-mission-number" aria-hidden="true">${mission.claimed ? '✓' : String(index + 1).padStart(2, '0')}</span><h3>${escapeHtml(mission.title)}</h3><p>${escapeHtml(mission.description)}</p><div class="guardian-mission-progress"><progress max="${Math.max(1, mission.target)}" value="${Math.min(mission.progress, mission.target)}" aria-label="Progreso: ${escapeHtml(mission.title)}"></progress><span>${mission.progress} / ${mission.target}</span></div><div class="guardian-mission-bottom"><small>${escapeHtml(reward)}</small><button type="button" class="guardian-button guardian-button--small" data-guardian-action="claim_mission" data-pet-id="${escapeHtml(selectedPet()?.id || '')}" data-mission-id="${escapeHtml(mission.id)}"${buttonDisabled(!complete || mission.claimed || !selectedPet())}>${mission.claimed ? 'Recibido' : complete ? (selectedPet() ? 'Recibir' : 'Al nacer') : 'En progreso'}</button></div></article>`;
      })
      .join('')}</div></section>`;
  }
  function habitat(): string {
    const pet = selectedPet();
    if (!guardian || !pet)
      return `<section class="guardian-empty"><span aria-hidden="true">❧</span><h2>Tu hábitat espera una nueva vida</h2><p>Visita la incubadora para elegir tu primer huevo.</p><button type="button" class="guardian-button" data-guardian-tab="incubator">Ir a la incubadora</button></section>${missions()}`;
    selectedPetId = pet.id;
    const care = guardian.care[pet.id];
    const genetics = guardian.genetics[pet.id];
    const mood = care
      ? care.mood >= 75
        ? 'A gusto contigo'
        : care.mood >= 40
          ? 'Con ganas de compañía'
          : 'Necesita un poco de cariño'
      : 'Tu compañero';
    const activeEggs = guardian.eggs.filter((egg) => egg.status !== 'hatched');
    return `<div class="guardian-habitat-grid"><section class="guardian-home" aria-labelledby="guardian-pet-name"><div class="guardian-home-top"><span class="guardian-pill"><i></i>${escapeHtml(mood)}</span><span class="guardian-place">EL CLARO · TU REFUGIO</span></div><div class="guardian-landscape"><div class="guardian-sun" aria-hidden="true"></div><div class="guardian-cloud" aria-hidden="true"></div><div class="guardian-hill guardian-hill--back" aria-hidden="true"></div><div class="guardian-hill guardian-hill--front" aria-hidden="true"></div><div class="guardian-tree guardian-tree--left" aria-hidden="true">❧</div><div class="guardian-tree guardian-tree--right" aria-hidden="true">❧</div><div class="guardian-pet-shadow" aria-hidden="true"></div><div class="guardian-preview" role="img" aria-label="Vista 3D de ${escapeHtml(pet.name)}"></div><div class="guardian-flower guardian-flower--one" aria-hidden="true">✿</div><div class="guardian-flower guardian-flower--two" aria-hidden="true">✿</div><p class="guardian-reaction" aria-live="polite">${escapeHtml(reaction || (care ? label(care.activity) : 'Bienvenido a casa'))}</p></div><div class="guardian-pet-caption"><div><p class="guardian-eyebrow">${care ? STAGES[care.stage] : 'COMPAÑERO'} · ${escapeHtml(elementLabel(pet.traits.element))}</p><h2 id="guardian-pet-name">${escapeHtml(pet.name)}</h2><p>${escapeHtml(care ? label(care.personality) : '')}${genetics ? ` <span>· ${escapeHtml(label(genetics.species))}</span>` : ''}</p></div><button type="button" class="guardian-button guardian-button--outline" data-guardian-tab="catalog">Conocer su historia <span aria-hidden="true">↗</span></button></div></section><aside class="guardian-care-panel" aria-labelledby="guardian-care-heading"><div class="guardian-section-heading"><div><p class="guardian-eyebrow">CADA GESTO CUENTA</p><h2 id="guardian-care-heading">Un rato juntos</h2></div><span aria-hidden="true" class="guardian-panel-icon">♡</span></div>${care ? `<div class="guardian-needs">${meter('Saciedad', care.satiety)}${meter('Energía', care.energy, 'guardian-need--gold')}${meter('Ánimo', care.mood, 'guardian-need--rose')}${meter('Higiene', care.hygiene, 'guardian-need--blue')}</div>` : '<p class="guardian-muted">Actualiza el hábitat para ver sus necesidades.</p>'}<div class="guardian-actions">${CARE_ACTIONS.map((action) => `<button type="button" data-guardian-action="${action.id}" data-pet-id="${escapeHtml(pet.id)}" class="guardian-care-action"${buttonDisabled(!care || (action.id === 'feed' && guardian!.food < 1) || coolingDown(`pet:${pet.id}`) || (action.id === 'play' && !!care && care.energy < 6) || (action.id === 'train' && !!care && care.energy < 8))}><span aria-hidden="true">${action.icon}</span><strong>${action.name}</strong><small>${action.hint}</small></button>`).join('')}</div><p class="guardian-care-footnote">${guardian.food < 1 ? 'Juega con tu compañero o recibe alimento en tus misiones.' : 'Los cuidados se guardan en tu cuenta.'}</p></aside></div>${nameForm(pet)}<div class="guardian-habitat-footer"><div><span class="guardian-panel-icon" aria-hidden="true">${activeEggs.length ? '◒' : '✦'}</span><div><strong>${activeEggs.length ? 'Hay una pequeña vida esperando' : guardian.eggs.length ? 'Tu familia sigue creciendo' : 'Una nueva amistad empieza en un huevo'}</strong><p>${activeEggs.length ? 'Dale calor y acompaña su nacimiento.' : guardian.eggs.length ? 'Cuida a cada compañero y descubre su historia.' : 'Elige un huevo de bienvenida en la incubadora.'}</p></div></div><button type="button" class="guardian-text-button" data-guardian-tab="incubator">Visitar incubadora <span aria-hidden="true">→</span></button></div>${missions()}`;
  }
  function incubator(): string {
    if (!guardian) return '';
    const eggs = guardian.eggs.filter((egg) => egg.status !== 'hatched');
    if (!guardian.eggs.length) {
      return `<section class="guardian-incubator-intro"><p class="guardian-eyebrow">EL COMIENZO DE ALGO ESPECIAL</p><h2>¿A quién le darás la bienvenida?</h2><p>Elige un huevo gratis. Su afinidad es una pista; su historia la descubrirán juntos.</p></section><div class="guardian-egg-options" role="group" aria-label="Elige la afinidad de tu huevo">${THEMES.map((theme) => `<button type="button" class="guardian-egg-option${selectedTheme === theme.id ? ' guardian-egg-option--selected' : ''}" aria-pressed="${selectedTheme === theme.id}" data-guardian-theme="${theme.id}"${pending || needsRefresh ? ' disabled' : ''}><span class="guardian-egg-option-check" aria-hidden="true">${selectedTheme === theme.id ? '✓' : ''}</span>${eggVisual(theme.id)}<strong>${theme.name}</strong><span>${theme.hint}</span></button>`).join('')}</div><div class="guardian-choose-footer"><p>Un huevo de bienvenida por cuenta.<br>Se abrirá en 90 segundos o al tercer Dar calor. Cada cuidado mejora todas sus estadísticas en +1 (hasta +3).</p><button type="button" class="guardian-button" data-guardian-action="choose_egg"${buttonDisabled()}>${pending ? 'Preparando…' : `Elegir huevo de ${THEMES.find((theme) => theme.id === selectedTheme)!.name.toLowerCase()}`} <span aria-hidden="true">→</span></button></div>${missions()}`;
    }
    const hatched = guardian.eggs.filter((egg) => egg.status === 'hatched');
    return `<section class="guardian-incubator-intro"><p class="guardian-eyebrow">UN POCO DE CALOR, MUCHO CARIÑO</p><h2>${eggs.length ? 'Algo pequeño está por llegar' : 'Ya hay una nueva vida en casa'}</h2><p>${eggs.length ? 'Dale calor para fortalecer a tu bebé: +1 a todas las estadísticas por cuidado. Se abrirá al tercer cuidado o al terminar los 90 segundos; sin calor tendrá estadísticas más bajas.' : 'Tu huevo de bienvenida ha nacido. Encuentra a tu compañero en el hábitat.'}</p></section><div class="guardian-incubation-grid">${eggs.map((egg) => `<article class="guardian-incubation-card"><div data-egg-scene="${escapeHtml(egg.id)}" class="guardian-incubation-scene${warmedEggId === egg.id ? ' guardian-incubation-scene--warm' : ''}"><span class="guardian-nest-orbit" aria-hidden="true"></span>${eggVisual(egg.theme, canHatch(egg))}<span class="guardian-nest" aria-hidden="true"></span><span class="guardian-incubation-badge" data-egg-badge="${escapeHtml(egg.id)}">${egg.status === 'ready' ? 'Listo para nacer' : 'Incubando'}</span></div><div class="guardian-incubation-info"><p class="guardian-eyebrow">${escapeHtml(THEMES.find((theme) => theme.id === egg.theme)?.name || egg.theme)}</p><h3>${escapeHtml(egg.label)}</h3><p>El calor de tus manos es su primer hogar.</p><div class="guardian-egg-steps" aria-label="${egg.care} de ${egg.requiredCare} cuidados">${Array.from({ length: Math.max(1, Math.min(10, egg.requiredCare)) }, (_, index) => `<span class="${index < egg.care ? 'guardian-egg-step--done' : ''}" aria-hidden="true">${index < egg.care ? '✓' : '♡'}</span>`).join('')}<small>${egg.care} / ${egg.requiredCare} cuidados</small></div><p class="guardian-egg-timer" data-egg-timer="${escapeHtml(egg.id)}"></p><div class="guardian-incubation-buttons"><button type="button" class="guardian-button guardian-button--outline" data-guardian-action="warm_egg" data-egg-id="${escapeHtml(egg.id)}"${buttonDisabled(egg.care >= egg.requiredCare || coolingDown(`egg:${egg.id}`))}>Dar calor <span aria-hidden="true">♡</span></button><button type="button" class="guardian-button" data-guardian-action="hatch" data-egg-id="${escapeHtml(egg.id)}" data-egg-hatch="${escapeHtml(egg.id)}"${buttonDisabled(!canHatch(egg))}>Dar la bienvenida <span aria-hidden="true">✦</span></button></div></div></article>`).join('')}</div>${hatched
      .map((egg) => {
        const pet = pets().find((item) => item.id === egg.petId);
        return `<div class="guardian-hatched-note"><span aria-hidden="true">✦</span><div><strong>${escapeHtml(pet?.name || 'Tu nuevo compañero')} ya nació</strong><p>Su aventura contigo apenas comienza.</p></div><button type="button" class="guardian-text-button" data-guardian-visit-pet="${escapeHtml(egg.petId || '')}">Ir al hábitat <span aria-hidden="true">→</span></button></div>`;
      })
      .join('')}${missions()}`;
  }
  function canHatch(egg: GuardianEgg): boolean {
    return (
      egg.status !== 'hatched' &&
      (egg.care >= egg.requiredCare || timestamp(egg.readyAt) <= Date.now() + serverOffset)
    );
  }
  function catalog(): string {
    if (!guardian) return '';
    const pet = selectedPet();
    const genetics = pet ? guardian.genetics[pet.id] : undefined;
    const care = pet ? guardian.care[pet.id] : undefined;
    return `<section class="guardian-catalog-intro"><p class="guardian-eyebrow">TU CUADERNO DE DESCUBRIMIENTOS</p><h2>Cada compañero, una historia</h2><p>Conoce sus orígenes y los rasgos que hacen única a tu pequeña familia.</p></section><div class="guardian-catalog-grid"><section class="guardian-lineage" aria-labelledby="guardian-lineage-heading"><div class="guardian-section-heading"><div><p class="guardian-eyebrow">${escapeHtml(pet?.name || 'TU FAMILIA')}</p><h3 id="guardian-lineage-heading">Origen y personalidad</h3></div><span aria-hidden="true" class="guardian-panel-icon">❧</span></div>${genetics ? `<dl class="guardian-facts"><div><dt>Especie</dt><dd>${escapeHtml(label(genetics.species))}</dd></div><div><dt>Afinidad</dt><dd>${escapeHtml(label(genetics.affinity))}</dd></div><div><dt>Generación</dt><dd>${genetics.generation}${genetics.generation === 0 ? ' · Fundador' : ''}</dd></div><div><dt>Origen</dt><dd>${escapeHtml(label(genetics.origin))}</dd></div>${care ? `<div><dt>Etapa</dt><dd>${STAGES[care.stage]}</dd></div><div><dt>Personalidad</dt><dd>${escapeHtml(label(care.personality))}</dd></div>` : ''}</dl><div class="guardian-genes"><h4>Rasgos descubiertos</h4><div>${genetics.knownGenes.map((gene) => `<span class="guardian-gene">${escapeHtml(label(gene))}</span>`).join('') || '<p class="guardian-muted">Todavía no hay rasgos revelados.</p>'}${genetics.hiddenGenes ? `<span class="guardian-gene guardian-gene--hidden">? · ${genetics.hiddenGenes} por descubrir</span>` : ''}</div></div>${genetics.parents.length ? `<p class="guardian-muted">Linaje: ${genetics.parents.map((id) => escapeHtml(pets().find((item) => item.id === id)?.name || id)).join(' · ')}</p>` : '<p class="guardian-muted">El inicio de un nuevo linaje.</p>'}<details class="guardian-identity"><summary>Identidad de tu compañero</summary><p>Huella única: <code>${escapeHtml(genetics.fingerprint)}</code></p></details>` : '<p class="guardian-muted">Cuando llegue tu primer compañero, su historia aparecerá aquí.</p>'}</section><section class="guardian-discoveries" aria-labelledby="guardian-discoveries-heading"><p class="guardian-eyebrow">LO QUE HAN ENCONTRADO JUNTOS</p><h3 id="guardian-discoveries-heading">Especies conocidas</h3><div class="guardian-species-grid">${guardian.discoveries.species.map((species) => `<article class="guardian-species"><span aria-hidden="true">❧</span><strong>${escapeHtml(label(species))}</strong><small>Descubierta</small></article>`).join('')}<article class="guardian-species guardian-species--unknown"><span aria-hidden="true">?</span><strong>Por descubrir</strong><small>Tu historia continúa</small></article></div><h4>Rasgos del cuaderno</h4><div class="guardian-gene-list">${guardian.discoveries.genes.map((gene) => `<span class="guardian-gene">${escapeHtml(label(gene))}</span>`).join('') || '<p class="guardian-muted">Cuida a tus compañeros para conocerlos mejor.</p>'}</div>${guardian.discoveries.zones.length ? `<h4>Lugares descubiertos</h4><div class="guardian-gene-list">${guardian.discoveries.zones.map((zone) => `<span class="guardian-gene">${escapeHtml(label(zone))}</span>`).join('')}</div>` : ''}</section></div>${care ? `<section class="guardian-bond"><div><p class="guardian-eyebrow">CRECIENDO CONTIGO</p><h3>Más que un compañero</h3><p>Su bienestar y su vínculo también forman parte de su historia.</p></div><div class="guardian-bond-meters">${meter('Salud', care.health)}${meter('Afecto', care.affection, 'guardian-need--rose')}${meter('Curiosidad', care.curiosity, 'guardian-need--gold')}</div></section>` : ''}`;
  }
  function render(): void {
    if (disposed) return;
    const focused =
      document.activeElement instanceof HTMLElement && container.contains(document.activeElement)
        ? document.activeElement.dataset.guardianFocus
        : undefined;
    const petForPreview = selectedPet();
    const nextPreviewKey = petForPreview
      ? JSON.stringify([
          petForPreview.id,
          petForPreview.traits,
          guardian?.genetics[petForPreview.id]?.fingerprint,
        ])
      : '';
    const retainedPreview =
      tab === 'habitat' && guardian && previewHost && previewStop && nextPreviewKey === previewKey
        ? previewHost
        : undefined;
    if (retainedPreview) retainedPreview.remove();
    else releasePreview();
    container.classList.add('guardian-screen');
    container.setAttribute('aria-busy', String(loading || pending));
    container.classList.toggle('guardian-screen--paused', document.hidden);
    container.innerHTML = `<div class="guardian-shell"><header class="guardian-header"><div class="guardian-header-left"><button type="button" class="guardian-back" data-guardian-nav="back" aria-label="Volver a tu cuenta">←</button><a class="guardian-wordmark" href="#" data-guardian-nav="back">AODASE <span>PETS</span></a></div><div class="guardian-wallet" aria-label="Tus recursos"><span><i aria-hidden="true">◒</i><b>${guardian ? guardian.food : '—'}</b> alimentos</span><span><i aria-hidden="true">✦</i><b>${profile.world?.coins ?? '—'}</b> monedas</span></div></header><div class="guardian-title-row"><div><p class="guardian-eyebrow">UN LUGAR PARA CRECER JUNTOS</p><h1>Tu hábitat<span aria-hidden="true">❧</span></h1><p>Cuídalos. Conócelos. Comparte una nueva aventura.</p></div>${exploreControl()}</div><div class="guardian-toolbar"><nav class="guardian-tabs" aria-label="Secciones de tu hábitat">${(['habitat', 'incubator', 'catalog'] as const).map((item, index) => `<button type="button" data-guardian-tab="${item}" data-guardian-focus="tab-${item}"${item === tab ? ' aria-current="page"' : ''}><span aria-hidden="true">${['⌂', '◒', '▤'][index]}</span>${['Hábitat', 'Incubadora', 'Catálogo'][index]}${item === 'incubator' && guardian?.eggs.some((egg) => egg.status !== 'hatched') ? '<i class="guardian-tab-dot" aria-label="Hay un huevo en tu incubadora"></i>' : ''}</button>`).join('')}</nav>${petPicker()}</div><div class="guardian-feedback"${!error && !notice && !pending ? ' hidden' : ''}>${error ? `<div class="guardian-error" role="alert"><div><strong>No pudimos completar la solicitud</strong><p>${escapeHtml(error)}</p></div><button type="button" class="guardian-text-button" data-guardian-refresh${pending ? ' disabled' : ''}>Actualizar</button></div>` : `<p class="guardian-notice" role="status">${escapeHtml(pending ? 'Guardando este momento…' : notice)}</p>`}</div><main class="guardian-content" id="guardian-content">${loading ? `<section class="guardian-loading" role="status"><div class="guardian-loading-orbit" aria-hidden="true">❧</div><h2>Preparando tu hábitat</h2><p>Estamos buscando a tus compañeros.</p></section>` : !guardian ? `<section class="guardian-empty"><span aria-hidden="true">❧</span><h2>Tu hábitat está esperando</h2><p>Actualiza para cargar a tus compañeros y tus huevos.</p><button type="button" class="guardian-button" data-guardian-refresh>Volver a intentar</button></section>` : tab === 'habitat' ? habitat() : tab === 'incubator' ? incubator() : catalog()}</main><footer class="guardian-footer"><span>AODASE PETS <i aria-hidden="true">✦</i> Pequeñas vidas, grandes historias.</span><button type="button" class="guardian-text-button" data-guardian-refresh${pending || loading ? ' disabled' : ''}>Actualizar hábitat</button></footer>${revealedEgg ? hatchReveal(revealedEgg, reduced) : ''}</div>`;
    container.querySelectorAll<HTMLElement>('button, select').forEach((element, index) => {
      if (!element.dataset.guardianFocus)
        element.dataset.guardianFocus =
          element instanceof HTMLSelectElement ? 'pet-picker' : `control-${index}`;
    });
    if (focused)
      [...container.querySelectorAll<HTMLElement>('[data-guardian-focus]')]
        .find((element) => element.dataset.guardianFocus === focused)
        ?.focus({ preventScroll: true });
    birthPreviewStop?.();
    birthPreviewStop = undefined;
    const pet = selectedPet();
    const birthHost = container.querySelector<HTMLElement>('.guardian-hatch-baby');
    if (birthHost && pet) birthPreviewStop = mountPetPreview(birthHost, pet);
    if (tab === 'habitat' && pet && guardian) {
      const target = container.querySelector<HTMLElement>('.guardian-preview');
      if (retainedPreview && target) {
        target.replaceWith(retainedPreview);
        retainedPreview.setAttribute('aria-label', `Vista 3D de ${pet.name}`);
        previewStop?.setCare?.(guardian.care[pet.id] || {});
      } else {
        previewFrame = requestAnimationFrame(() => {
          if (disposed || tab !== 'habitat' || selectedPet()?.id !== pet.id) return;
          const host = container.querySelector<HTMLElement>('.guardian-preview');
          if (host) {
            previewHost = host;
            previewKey = nextPreviewKey;
            previewStop = mountPetPreview(host, pet);
            previewStop.setCare?.(guardian?.care[pet.id] || {});
            if (activeReaction?.petId === pet.id)
              previewStop.react?.(activeReaction.action, activeReaction.phase);
          }
        });
      }
    }
    updateEggTimers();
  }
  function updateEggTimers(): void {
    if (!guardian || disposed) return;
    for (const button of container.querySelectorAll<HTMLButtonElement>('.guardian-care-action')) {
      const care = guardian.care[button.dataset.petId || ''];
      const action = button.dataset.guardianAction;
      button.disabled =
        pending ||
        loading ||
        needsRefresh ||
        !care ||
        coolingDown(`pet:${button.dataset.petId}`) ||
        (action === 'feed' && guardian.food < 1) ||
        (action === 'play' && care.energy < 6) ||
        (action === 'train' && care.energy < 8);
    }
    for (const egg of guardian.eggs) {
      const scene = [...container.querySelectorAll<HTMLElement>('[data-egg-scene]')].find(
        (node) => node.dataset.eggScene === egg.id
      );
      if (scene && egg.status !== 'hatched') {
        const createdAt = egg.createdAt ?? timestamp(egg.readyAt) - 90000;
        const timeStage = Math.floor(Math.max(0, Date.now() + serverOffset - createdAt) / 20000);
        const stage = Math.min(4, Math.max(egg.care, timeStage));
        scene.style.setProperty('--crack-stage', String(stage));
        scene.dataset.crackStage = String(stage);
        const previous = crackStages.get(egg.id);
        if (!document.hidden && previous !== undefined && timeStage > previous) {
          scene.classList.remove('guardian-incubation-scene--cracking');
          void scene.offsetWidth;
          scene.classList.add('guardian-incubation-scene--cracking');
          visibleTimeout(() => scene.classList.remove('guardian-incubation-scene--cracking'), 1400);
        }
        crackStages.set(egg.id, timeStage);
      }
      const ready = canHatch(egg);
      const time = Math.max(
        0,
        Math.ceil((timestamp(egg.readyAt) - Date.now() - serverOffset) / 1000)
      );
      const timer = [...container.querySelectorAll<HTMLElement>('[data-egg-timer]')].find(
        (element) => element.dataset.eggTimer === egg.id
      );
      if (timer)
        timer.textContent = ready
          ? 'Su cáscara está lista. Estamos preparando su nacimiento.'
          : `Nacerá automáticamente en ${incubationWait(time)}. Calor: +${Math.min(3, egg.care)} a cada estadística. El tercer cuidado abre el huevo.`;
      const hatch = [...container.querySelectorAll<HTMLButtonElement>('[data-egg-hatch]')].find(
        (element) => element.dataset.eggHatch === egg.id
      );
      if (hatch) hatch.disabled = pending || loading || needsRefresh || !ready;
      const warm = [
        ...container.querySelectorAll<HTMLButtonElement>('[data-guardian-action="warm_egg"]'),
      ].find((element) => element.dataset.eggId === egg.id);
      if (warm)
        warm.disabled =
          pending ||
          loading ||
          needsRefresh ||
          egg.care >= egg.requiredCare ||
          coolingDown(`egg:${egg.id}`);
      const badge = [...container.querySelectorAll<HTMLElement>('[data-egg-badge]')].find(
        (element) => element.dataset.eggBadge === egg.id
      );
      if (badge) badge.textContent = ready ? 'Listo para nacer' : 'Incubando';
    }
    maybeAutoHatch();
  }
  function maybeAutoHatch(): void {
    if (
      !guardian ||
      disposed ||
      pending ||
      loading ||
      needsRefresh ||
      document.hidden ||
      autoHatchQueued
    )
      return;
    const egg = guardian.eggs.find((item) => canHatch(item) && !autoHatchAttempts.has(item.id));
    if (!egg) return;
    autoHatchQueued = true;
    queueMicrotask(() => {
      autoHatchQueued = false;
      if (
        disposed ||
        pending ||
        loading ||
        needsRefresh ||
        document.hidden ||
        autoHatchAttempts.has(egg.id)
      )
        return;
      if (!guardian?.eggs.some((item) => item.id === egg.id && canHatch(item))) return;
      void request('hatch', { eggId: egg.id });
    });
  }
  async function request(
    action?: GuardianAction,
    fields: { petId?: string; eggId?: string; missionId?: string; name?: string } = {}
  ): Promise<void> {
    if (disposed || pending || (action && (loading || needsRefresh))) return;
    if (action === 'hatch') {
      const egg = guardian?.eggs.find((item) => item.id === fields.eggId);
      if (!egg || egg.status === 'hatched') return;
      autoHatchAttempts.add(egg.id);
    }
    const token = getToken();
    if (!token) {
      loading = false;
      error = 'Necesitas iniciar sesión para cargar tu hábitat. Vuelve a tu cuenta para entrar.';
      render();
      return;
    }
    const controller = new AbortController();
    controllers.add(controller);
    const sequence = ++requestSequence;
    pending = true;
    error = '';
    notice = '';
    if (action && action in REACTIONS && fields.petId) {
      reaction = 'Se prepara para compartir este momento contigo.';
      reactToCare(fields.petId, action as CareAction, 'intent');
    }
    render();
    try {
      const response = await fetch(action ? '/api/guardian/action' : '/api/guardian', {
        method: action ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        ...(action
          ? {
              body: JSON.stringify({
                action,
                ...fields,
                ...(action === 'choose_egg' ? { theme: selectedTheme } : {}),
                requestId: crypto.randomUUID(),
              }),
            }
          : {}),
      });
      const data = await response.json();
      if (disposed || sequence !== requestSequence) return;
      if (!response.ok)
        throw new Error(
          data.error ||
            data.message ||
            (response.status === 401
              ? 'Tu sesión expiró. Vuelve a tu cuenta para iniciar sesión.'
              : 'El servidor no pudo completar esta acción.')
        );
      const result = data as GuardianResponse<PlayerProfile>;
      if (!result.profile || !result.guardian || result.guardian.version !== 1)
        throw new Error(
          'La respuesta del hábitat está incompleta. Actualiza para volver a intentar.'
        );
      if (action === 'hatch') {
        const egg = result.guardian.eggs.find((item) => item.id === fields.eggId);
        if (
          !egg?.petId ||
          egg.status !== 'hatched' ||
          !result.profile.characters?.characters.some((pet) => pet.id === egg.petId)
        )
          throw new Error(
            'Todavía no pudimos confirmar el nacimiento. Actualiza el hábitat para comprobarlo.'
          );
      }
      profile = result.profile;
      guardian = result.guardian;
      serverOffset = timestamp(guardian.serverNow) - Date.now();
      if (!Number.isFinite(serverOffset)) serverOffset = 0;
      needsRefresh = false;
      const pet = selectedPet();
      if (pet) selectedPetId = pet.id;
      else tab = 'incubator';
      notice =
        result.message ||
        (action ? 'Este momento ya forma parte de su historia.' : 'Tu hábitat está al día.');
      if (action === 'rename_pet') {
        nameDrafts.delete(fields.petId || '');
        nameError = '';
      }
      if (action && action in REACTIONS) {
        cooldowns.set(`pet:${fields.petId}`, guardian.serverNow + 3000);
        reaction = selectedPet()?.id === fields.petId ? REACTIONS[action as CareAction] : '';
        if (fields.petId) reactToCare(fields.petId, action as CareAction, 'success');
      }
      if (action === 'warm_egg') {
        cooldowns.set(`egg:${fields.eggId}`, guardian.serverNow + 3000);
        warmedEggId = fields.eggId || '';
        cancelVisibleTimeout(warmTimer);
        warmTimer = visibleTimeout(() => {
          warmedEggId = '';
          if (!disposed)
            container
              .querySelector('.guardian-incubation-scene--warm')
              ?.classList.remove('guardian-incubation-scene--warm');
        }, 1100);
      }
      if (action === 'hatch') {
        const egg = guardian.eggs.find((item) => item.id === fields.eggId);
        if (egg?.petId) selectedPetId = egg.petId;
        tab = 'habitat';
        reaction = '¡Bienvenido a casa! Una nueva historia empieza contigo.';
        if (egg) {
          revealedEgg = egg.theme;
          cancelVisibleTimeout(revealTimer);
          revealTimer = visibleTimeout(() => {
            revealedEgg = undefined;
            birthPreviewStop?.();
            birthPreviewStop = undefined;
            if (!disposed) container.querySelector('.guardian-hatch-reveal')?.remove();
          }, 2000);
        }
      }
      callbacks.onProfile(profile);
    } catch (failure) {
      if (disposed || sequence !== requestSequence || controller.signal.aborted) return;
      error = failure instanceof Error ? failure.message : 'No pudimos conectar con tu hábitat.';
      if (action && action in REACTIONS && fields.petId) {
        reactToCare(fields.petId, action as CareAction, 'cancel');
        reaction = '';
      }
      if (action) {
        needsRefresh = true;
        error += ' Actualiza el hábitat para confirmar su estado antes de volver a intentarlo.';
      }
    } finally {
      controllers.delete(controller);
      if (!disposed && sequence === requestSequence) {
        pending = false;
        loading = false;
        render();
      }
    }
  }
  function click(event: Event): void {
    const target =
      event.target instanceof Element ? event.target.closest<HTMLElement>('button, a') : null;
    if (
      !target ||
      !container.contains(target) ||
      (target instanceof HTMLButtonElement && target.disabled)
    )
      return;
    if (target.dataset.guardianNav) {
      event.preventDefault();
      if (target.dataset.guardianNav === 'explore' && !pets().length) return;
      if (target.dataset.guardianNav === 'explore') callbacks.onExplore(profile);
      else callbacks.onBack(profile);
      return;
    }
    if (target.dataset.guardianTab) {
      tab = target.dataset.guardianTab as GuardianTab;
      render();
      return;
    }
    if (target.dataset.guardianTheme) {
      selectedTheme = target.dataset.guardianTheme as EggTheme;
      render();
      return;
    }
    if (target.hasAttribute('data-guardian-visit-pet')) {
      selectedPetId = target.dataset.guardianVisitPet || selectedPetId;
      tab = 'habitat';
      reaction = '';
      render();
      return;
    }
    if (target.hasAttribute('data-guardian-refresh')) {
      void request();
      return;
    }
    if (target.dataset.guardianAction) {
      void request(target.dataset.guardianAction as GuardianAction, {
        ...(target.dataset.petId ? { petId: target.dataset.petId } : {}),
        ...(target.dataset.eggId ? { eggId: target.dataset.eggId } : {}),
        ...(target.dataset.missionId ? { missionId: target.dataset.missionId } : {}),
      });
    }
  }
  function change(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || !target.hasAttribute('data-guardian-select'))
      return;
    selectedPetId = target.value;
    reaction = '';
    nameError = '';
    activeReaction = undefined;
    cancelVisibleTimeout(reactionTimer);
    render();
  }
  function input(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.hasAttribute('data-guardian-name-input'))
      return;
    nameDrafts.set(target.dataset.petId || '', target.value);
    nameError = '';
    target.removeAttribute('aria-invalid');
    target.setAttribute('aria-describedby', 'guardian-name-hint');
    const inlineError = container.querySelector<HTMLElement>('.guardian-name-error');
    if (inlineError) inlineError.hidden = true;
    const save = container.querySelector<HTMLButtonElement>('[data-guardian-name-submit]');
    if (save)
      save.disabled =
        pending ||
        loading ||
        needsRefresh ||
        target.value.trim().normalize('NFC') === selectedPet()?.name;
  }
  function submit(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLFormElement) || !target.hasAttribute('data-guardian-name-form'))
      return;
    event.preventDefault();
    if (pending || loading || needsRefresh) return;
    const field = target.querySelector<HTMLInputElement>('[data-guardian-name-input]');
    const pet = pets().find((item) => item.id === target.dataset.petId);
    if (!field || !pet) return;
    const name = field.value.trim().normalize('NFC');
    if (
      !name ||
      Array.from(name).length > 24 ||
      /[<>\p{Cc}\u202a-\u202e\u2066-\u2069]/u.test(name)
    ) {
      nameError = 'Escribe un nombre de 1 a 24 caracteres, en una sola línea.';
      nameDrafts.set(pet.id, field.value);
      render();
      container
        .querySelector<HTMLInputElement>('[data-guardian-name-input]')
        ?.focus({ preventScroll: true });
      return;
    }
    if (name === pet.name) return;
    void request('rename_pet', { petId: pet.id, name });
  }
  container.addEventListener('click', click);
  container.addEventListener('change', change);
  container.addEventListener('input', input);
  container.addEventListener('submit', submit);
  function visibilityChanged(): void {
    container.classList.toggle('guardian-screen--paused', document.hidden);
    for (const delay of visibleDelays) {
      if (document.hidden && delay.handle !== undefined) {
        delay.remaining = Math.max(0, delay.remaining - (Date.now() - delay.started));
        clearTimeout(delay.handle);
        delay.handle = undefined;
      } else if (!document.hidden) resumeDelay(delay);
    }
    if (!document.hidden) updateEggTimers();
  }
  document.addEventListener('visibilitychange', visibilityChanged);
  const clock = setInterval(updateEggTimers, 1000);
  render();
  void request();
  return () => {
    if (disposed) return;
    disposed = true;
    requestSequence++;
    controllers.forEach((controller) => controller.abort());
    controllers.clear();
    clearInterval(clock);
    visibleDelays.forEach((delay) => clearTimeout(delay.handle));
    visibleDelays.clear();
    birthPreviewStop?.();
    birthPreviewStop = undefined;
    releasePreview();
    container.removeEventListener('click', click);
    container.removeEventListener('change', change);
    container.removeEventListener('input', input);
    container.removeEventListener('submit', submit);
    document.removeEventListener('visibilitychange', visibilityChanged);
    container.removeAttribute('aria-busy');
    container.replaceChildren();
  };
}
