import type { Character } from './characters';
import { elementLabel } from './nft';
import { getAllAbilities, getElementAbilities } from './abilities';
import {
  DEFAULT_APPEARANCE,
  PET_PRESETS,
  normalizeAppearance,
} from '../../shared/pet-appearance.js';
import { mountStudioView, type StudioMode } from './pet-studio-view';

const optionLabels: Record<string, string> = {
  round: 'Redonda',
  cube: 'Cuadrada',
  diamond: 'Diamante',
  humanoid: 'Guardián',
  bestia: 'Bestia',
  espectral: 'Espíritu',
  golem: 'Gólem',
  smooth: 'Liso',
  fluffy: 'Peludito',
  striped: 'Rayas',
  spotted: 'Manchas',
  dirty: 'Sucio / rugoso',
  scales: 'Escamas',
  cat: 'Gatito',
  long: 'Largas',
  none: 'Sin este rasgo',
  insect: 'Insecto',
  feather: 'Plumas',
  bat: 'Murciélago',
  paws: 'Patitas',
  hands: 'Manos y dedos',
  tentacles: 'Tentáculos',
  claws: 'Garras',
  curled: 'Enroscada',
  spiked: 'Con punta',
  slit: 'Alargados',
  bug: 'Ojos de insecto',
  sleepy: 'Dormilones',
};
const tabs = [
  ['family', 'Familia'],
  ['face', 'Cara'],
  ['body', 'Cuerpo'],
  ['details', 'Acabados'],
  ['sculpt', 'Moldear'],
  ['powers', 'Poderes'],
];
const pathLabel = (value: string) => value.replaceAll('.', '-');
const range = (label: string, path: string, min: number, max: number, step = 0.05) =>
  `<label class="studio-range" for="studio-${pathLabel(path)}"><span>${label}<output data-output="${path}"></output></span><input id="studio-${pathLabel(path)}" type="range" data-path="${path}" min="${min}" max="${max}" step="${step}" /></label>`;
const select = (label: string, path: string, values: string[]) =>
  `<label class="studio-select" for="studio-${pathLabel(path)}">${label}<select id="studio-${pathLabel(path)}" data-path="${path}">${values.map((value) => `<option value="${value}">${optionLabels[value] ?? value}</option>`).join('')}</select></label>`;

export function mountPetEditor(
  container: HTMLElement,
  initial: Character,
  onSubmit: (pet: Character) => Promise<void>
): () => void {
  let draft = structuredClone(initial);
  draft.traits.headShape ??= 'round';
  draft.traits.limbCount ??= 4;
  draft.traits.limbLength ??= 1;
  draft.traits.appearance =
    normalizeAppearance(draft.traits.appearance) ?? structuredClone(DEFAULT_APPEARANCE);
  draft.powers ??= getElementAbilities(draft.traits.element).map((ability) => ability.id);
  let committed = structuredClone(draft);
  const undo: Character[] = [],
    redo: Character[] = [];
  let mode: StudioMode = 'orbit',
    brushRadius = 0.3,
    brushStrength = 0.12,
    rotating = false;
  container.innerHTML = `<div class="pet-studio">
    <div class="studio-title"><span class="studio-eyebrow">EL TALLER FOODIE</span><h2>Pequeña criatura.<br/>Gran personalidad.</h2><p>Mezcla especies, moldea sus formas y crea una mascota que solo podría ser tuya.</p></div>
    <div class="studio-layout">
      <aside class="studio-stage"><div class="studio-stage-heading"><span id="studio-pet-badge">TU COMPAÑERO</span><span>VISTA 3D EN VIVO</span></div>
        <div id="studio-canvas" class="studio-canvas"></div>
        <div class="studio-tools" aria-label="Herramientas de edición 3D"><button type="button" data-mode="orbit" aria-pressed="true">↻ Girar vista</button><button type="button" data-mode="eyes" aria-pressed="false">◉ Mover ojos</button><button type="button" data-mode="raise" aria-pressed="false">△ Levantar</button><button type="button" data-mode="lower" aria-pressed="false">▽ Hundir</button></div>
        <p id="studio-tip" role="status">Arrastra para girar la vista. Usa la rueda o dos dedos para acercarte.</p>
        <div class="studio-history"><button id="studio-undo" type="button" disabled>↶ Deshacer</button><button id="studio-redo" type="button" disabled>↷ Rehacer</button><button id="studio-front" type="button">Vista frontal</button><button id="studio-spin" type="button" aria-pressed="false">Rotación</button></div>
      </aside>
      <form class="studio-inspector" id="studio-form">
        <div class="studio-tabs" role="tablist" aria-label="Secciones del editor">${tabs.map(([id, label], i) => `<button type="button" role="tab" id="tab-${id}" aria-controls="section-${id}" data-tab="${id}" aria-selected="${i === 0}">${label}</button>`).join('')}</div>
        <div class="studio-sections">
          <section id="section-family" role="tabpanel" aria-labelledby="tab-family"><h3>¿De qué mundo viene?</h3><p>Estas bases son un punto de partida. Puedes combinar todos sus rasgos.</p>
            <div class="studio-families">${PET_PRESETS.map((preset) => `<button type="button" data-preset="${preset.id}" aria-pressed="false"><span>${preset.icon}</span><strong>${preset.label}</strong><small>${preset.description}</small></button>`).join('')}</div>
            <label class="studio-select" for="studio-name">Nombre de tu Pet<input id="studio-name" data-path="name" minlength="2" maxlength="24" required placeholder="Por ejemplo, Mochi" /></label>
            <label class="studio-select" for="studio-element">Elemento<select id="studio-element" data-path="traits.element">${(['fuego', 'agua', 'tierra', 'aire', 'sombra', 'luz'] as const).map((element) => `<option value="${element}">${elementLabel(element)}</option>`).join('')}</select></label>
            <h4>Su personalidad</h4><div class="studio-moods">${[
              ['cute', 'Tierna'],
              ['fierce', 'Fuerte'],
              ['grumpy', 'Gruñona'],
              ['odd', 'Extraña'],
            ]
              .map(
                ([value, label]) =>
                  `<button type="button" data-mood="${value}" aria-pressed="false">${label}</button>`
              )
              .join('')}</div>
          </section>
          <section id="section-face" role="tabpanel" aria-labelledby="tab-face" hidden><h3>Una carita única</h3><p>Mueve cada ojo en la vista 3D o ajusta su posición con precisión aquí.</p>
            ${select('Forma de la cabeza', 'traits.headShape', ['round', 'cube', 'diamond'])}
            ${range('Tamaño de la cabeza', 'traits.appearance.headSize', 0.65, 1.6)}
            ${select('Tipo de ojos', 'traits.appearance.eyes', ['round', 'slit', 'bug', 'sleepy'])}
            ${range('Tamaño de los ojos', 'traits.appearance.eyeSize', 0.6, 1.7)}${range('Separación de los ojos', 'traits.appearance.eyeSpacing', 0.65, 1.6)}${range('Altura de los ojos', 'traits.appearance.eyeHeight', -0.16, 0.18, 0.01)}${range('Inclinación de los ojos', 'traits.appearance.eyeTilt', -0.45, 0.45)}
            <details class="studio-precision"><summary>Posición de cada ojo</summary>${(['eyeLeft', 'eyeRight'] as const).map((eye, i) => `<h4>Ojo ${i === 0 ? 'izquierdo' : 'derecho'}</h4>${range('Horizontal', `traits.appearance.${eye}.x`, -0.5, 0.5, 0.01)}${range('Vertical', `traits.appearance.${eye}.y`, -0.5, 0.5, 0.01)}${range('Profundidad', `traits.appearance.${eye}.z`, -0.5, 0.5, 0.01)}`).join('')}</details>
            ${select('Orejas', 'traits.appearance.ears', ['cat', 'long', 'round', 'none'])}${range('Tamaño de las orejas', 'traits.appearance.earSize', 0.5, 1.6)}
          </section>
          <section id="section-body" role="tabpanel" aria-labelledby="tab-body" hidden><h3>Su propia silueta</h3><p>Patitas, manos con dedos, garras o tentáculos. Tú decides.</p>
            ${select('Tipo de cuerpo', 'traits.bodyType', ['bestia', 'humanoid', 'golem', 'espectral'])}
            ${range('Ancho del cuerpo', 'traits.appearance.bodyWidth', 0.6, 1.65)}${range('Alto del cuerpo', 'traits.appearance.bodyHeight', 0.65, 1.6)}${range('Cabeza: mover a los lados', 'traits.appearance.headX', -0.35, 0.35)}${range('Cabeza: subir o bajar', 'traits.appearance.headY', -0.2, 0.35)}
            <label class="studio-select" for="studio-limbs">Cantidad de extremidades<select id="studio-limbs" data-path="traits.limbCount" data-number="true">${[0, 2, 4, 6, 8].map((n) => `<option value="${n}">${n} extremidades</option>`).join('')}</select></label>
            ${select('Tipo de extremidades', 'traits.appearance.limbKind', ['paws', 'hands', 'tentacles', 'claws'])}${range('Largo de las extremidades', 'traits.limbLength', 0.5, 1.8, 0.1)}${select('Cola', 'traits.appearance.tail', ['none', 'curled', 'long', 'spiked'])}
          </section>
          <section id="section-details" role="tabpanel" aria-labelledby="tab-details" hidden><h3>Texturas y pequeños detalles</h3><p>Suave y peludita, cubierta de escamas o un poco sucia.</p>
            <div class="studio-palette">${[
              ['primaryColor', 'Cuerpo'],
              ['secondaryColor', 'Detalles'],
              ['accentColor', 'Acentos'],
            ]
              .map(
                ([key, label]) =>
                  `<label>${label}<input type="color" data-path="traits.${key}" data-color="true" aria-label="Color ${label.toLowerCase()}" /></label>`
              )
              .join('')}</div>
            ${select('Piel o pelaje', 'traits.appearance.coat', ['smooth', 'fluffy', 'striped', 'spotted', 'dirty', 'scales'])}${range('Largo del pelaje', 'traits.appearance.furLength', 0.03, 0.16, 0.01)}${range('Rugosidad / suciedad', 'traits.appearance.roughness', 0, 1)}
            ${select('Alas', 'traits.appearance.wings', ['none', 'insect', 'feather', 'bat'])}${range('Tamaño de las alas', 'traits.appearance.wingSize', 0.5, 1.7)}${range('Largo de las antenas', 'traits.appearance.antennaLength', 0, 1.5)}${range('Cuernos y picos', 'traits.appearance.spikes', 0, 8, 1)}
          </section>
          <section id="section-sculpt" role="tabpanel" aria-labelledby="tab-sculpt" hidden><h3>Dale forma con tus manos</h3><p>Selecciona «Levantar» y pinta sobre la cabeza o el cuerpo para hacer montañitas. «Hundir» crea pequeñas hendiduras. Gira la vista para trabajar por detrás.</p>
            <div class="studio-sculpt-tools"><button type="button" data-mode="raise">△ Levantar superficie</button><button type="button" data-mode="lower">▽ Hundir superficie</button><button type="button" data-mode="orbit">↻ Girar vista</button></div>
            <label class="studio-range" for="studio-brush"><span>Tamaño del pincel</span><input type="range" id="studio-brush" min="0.08" max="0.65" step="0.01" value="0.3" /></label>
            <label class="studio-range" for="studio-strength"><span>Fuerza del pincel</span><input type="range" id="studio-strength" min="0.04" max="0.25" step="0.01" value="0.12" /></label>
            <div class="studio-sculpt-note"><strong id="studio-strokes">0 / 48 trazos</strong><p>Deshaz un trazo cuando quieras. Los cambios se conservan al continuar.</p></div><button type="button" id="studio-clear-sculpt" class="foodie-text-button">Restaurar la superficie</button>
          </section>
          <section id="section-powers" role="tabpanel" aria-labelledby="tab-powers" hidden><h3>Sus dos poderes favoritos</h3><p>Puedes combinar poderes de cualquier elemento.</p><p id="studio-power-count"></p><div class="studio-power-grid">${getAllAbilities()
            .map(
              (ability) =>
                `<label><input type="checkbox" value="${ability.id}" data-power /><span><strong>${ability.icon} ${ability.name}</strong><small>${ability.description}</small></span></label>`
            )
            .join('')}</div></section>
        </div>
        <div class="studio-footer"><p id="studio-error" role="alert"></p><button class="foodie-primary" type="submit">Continuar a los dados ↗</button><small>Todo lo que cambies aquí aparecerá en tu mascota.</small></div>
      </form>
    </div>
  </div>`;
  const query = <T extends HTMLElement>(selector: string) => container.querySelector<T>(selector)!;
  const message = (text: string) => {
    query('#studio-tip').textContent = text;
  };
  const getValue = (path: string): unknown =>
    path
      .split('.')
      .reduce((value, key) => (value as Record<string, unknown>)[key], draft as unknown);
  const setValue = (path: string, value: unknown) => {
    const keys = path.split('.');
    let target = draft as unknown as Record<string, unknown>;
    for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
    target[keys.at(-1)!] = value;
  };
  const sync = () => {
    container
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-path]')
      .forEach((input) => {
        const value = getValue(input.dataset.path!);
        input.value = input.dataset.color
          ? `#${Number(value).toString(16).padStart(6, '0')}`
          : String(value ?? '');
      });
    container.querySelectorAll<HTMLOutputElement>('[data-output]').forEach((output) => {
      output.value = Number(getValue(output.dataset.output!)).toFixed(2);
    });
    container
      .querySelectorAll<HTMLButtonElement>('[data-preset]')
      .forEach((button) =>
        button.setAttribute(
          'aria-pressed',
          String(draft.traits.appearance!.species === button.dataset.preset)
        )
      );
    container
      .querySelectorAll<HTMLButtonElement>('[data-mood]')
      .forEach((button) =>
        button.setAttribute(
          'aria-pressed',
          String(draft.traits.appearance!.mood === button.dataset.mood)
        )
      );
    container.querySelectorAll<HTMLInputElement>('[data-power]').forEach((input) => {
      input.checked = !!draft.powers?.includes(input.value);
      input.disabled = draft.powers!.length >= 2 && !input.checked;
    });
    query('#studio-power-count').textContent = `${draft.powers!.length} de 2 poderes elegidos`;
    query('#studio-strokes').textContent = `${draft.traits.appearance!.sculpt.length} / 48 trazos`;
    query<HTMLButtonElement>('#studio-undo').disabled = undo.length === 0;
    query<HTMLButtonElement>('#studio-redo').disabled = redo.length === 0;
    query('#studio-pet-badge').textContent =
      PET_PRESETS.find((p) => p.id === draft.traits.appearance!.species)?.label.toUpperCase() ??
      'TU COMPAÑERO';
  };
  const commit = () => {
    if (JSON.stringify(draft) !== JSON.stringify(committed)) {
      undo.push(committed);
      if (undo.length > 40) undo.shift();
      redo.length = 0;
      committed = structuredClone(draft);
    }
    sync();
  };
  let view: ReturnType<typeof mountStudioView> | undefined;
  const refresh = (reframe = false) => {
    view?.update(draft, reframe);
  };
  try {
    view = mountStudioView(query('#studio-canvas'), draft, {
      onStart: () => {
        committed = structuredClone(draft);
      },
      onCommit: commit,
      onMessage: message,
      onEye: (eye, offset) => {
        draft.traits.appearance![eye] = offset;
        refresh();
        sync();
      },
      onSculpt: (part, point) => {
        const a = draft.traits.appearance!;
        if (a.sculpt.length >= 48) {
          message('Has usado los 48 trazos. Deshaz alguno para seguir moldeando.');
          return;
        }
        a.sculpt.push({
          part,
          x: Math.max(-1.6, Math.min(1.6, point.x)),
          y: Math.max(-1.6, Math.min(1.6, point.y)),
          z: Math.max(-1.6, Math.min(1.6, point.z)),
          radius: brushRadius,
          strength: mode === 'lower' ? -brushStrength : brushStrength,
        });
        refresh();
        sync();
      },
    });
  } catch {
    query('#studio-canvas').textContent =
      'La vista 3D no está disponible en este dispositivo. Puedes seguir usando los controles.';
  }
  container
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-path]')
    .forEach((input) => {
      input.oninput = () => {
        setValue(
          input.dataset.path!,
          input.dataset.color
            ? parseInt(input.value.slice(1), 16)
            : input.type === 'range' || input.dataset.number
              ? Number(input.value)
              : input.value
        );
        if (input.dataset.path !== 'name') refresh();
        container.querySelectorAll<HTMLOutputElement>('[data-output]').forEach((output) => {
          output.value = Number(getValue(output.dataset.output!)).toFixed(2);
        });
      };
      input.onchange = () => {
        input.oninput?.(new Event('input'));
        commit();
      };
    });
  const openTab = (id: string) => {
    container
      .querySelectorAll<HTMLButtonElement>('[data-tab]')
      .forEach((button) => button.setAttribute('aria-selected', String(button.dataset.tab === id)));
    query('.studio-sections').scrollTop = 0;
    tabs.forEach(([key]) => {
      query(`#section-${key}`).hidden = key !== id;
    });
  };
  query<HTMLInputElement>('#studio-name').oninvalid = () => openTab('family');
  container.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
    button.onclick = () => openTab(button.dataset.tab!);
  });
  container.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((button) => {
    button.onclick = () => {
      const preset = PET_PRESETS.find((p) => p.id === button.dataset.preset)!;
      draft.traits.appearance = { ...structuredClone(DEFAULT_APPEARANCE), ...preset.appearance };
      draft.traits.bodyType = preset.bodyType;
      draft.traits.headShape = 'round';
      draft.traits.limbCount = preset.limbs;
      draft.traits.limbLength = 1;
      draft.traits.primaryColor = parseInt(preset.color.slice(1), 16);
      draft.traits.secondaryColor = parseInt(preset.secondary.slice(1), 16);
      draft.traits.accentColor = parseInt(preset.accent.slice(1), 16);
      commit();
      refresh(true);
      message(`${preset.label}: combina sus rasgos con cualquiera de las otras familias.`);
    };
  });
  container.querySelectorAll<HTMLButtonElement>('[data-mood]').forEach((button) => {
    button.onclick = () => {
      draft.traits.appearance!.mood = button.dataset.mood as typeof DEFAULT_APPEARANCE.mood;
      commit();
      refresh();
    };
  });
  container.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
    button.onclick = () => {
      mode = button.dataset.mode as StudioMode;
      rotating = false;
      query('#studio-spin').setAttribute('aria-pressed', 'false');
      view?.mode(mode);
      container
        .querySelectorAll<HTMLButtonElement>('[data-mode]')
        .forEach((other) =>
          other.setAttribute('aria-pressed', String(other.dataset.mode === mode))
        );
      message(
        mode === 'orbit'
          ? 'Arrastra para girar la vista. Usa la rueda o dos dedos para acercarte.'
          : mode === 'eyes'
            ? 'Toca un ojo y arrástralo. Puedes mover cada uno por separado.'
            : 'Pinta sobre la cabeza o el cuerpo. Cada gesto se puede deshacer.'
      );
      if (mode === 'raise' || mode === 'lower') openTab('sculpt');
      else if (mode === 'eyes') openTab('face');
    };
  });
  query<HTMLInputElement>('#studio-brush').oninput = (event) => {
    brushRadius = Number((event.target as HTMLInputElement).value);
  };
  query<HTMLInputElement>('#studio-strength').oninput = (event) => {
    brushStrength = Number((event.target as HTMLInputElement).value);
  };
  query('#studio-clear-sculpt').onclick = () => {
    draft.traits.appearance!.sculpt = [];
    commit();
    refresh();
  };
  query('#studio-undo').onclick = () => {
    const previous = undo.pop();
    if (!previous) return;
    redo.push(structuredClone(draft));
    draft = previous;
    committed = structuredClone(draft);
    sync();
    refresh();
  };
  query('#studio-redo').onclick = () => {
    const next = redo.pop();
    if (!next) return;
    undo.push(structuredClone(draft));
    draft = next;
    committed = structuredClone(draft);
    sync();
    refresh();
  };
  query('#studio-front').onclick = () => view?.front();
  query('#studio-spin').onclick = () => {
    rotating = !rotating;
    mode = 'orbit';
    view?.mode('orbit');
    view?.spin(rotating);
    query('#studio-spin').setAttribute('aria-pressed', String(rotating));
    container
      .querySelectorAll<HTMLButtonElement>('[data-mode]')
      .forEach((button) =>
        button.setAttribute('aria-pressed', String(button.dataset.mode === 'orbit'))
      );
  };
  container.querySelectorAll<HTMLInputElement>('[data-power]').forEach((input) => {
    input.onchange = () => {
      draft.powers = Array.from(
        container.querySelectorAll<HTMLInputElement>('[data-power]:checked')
      ).map((input) => input.value);
      commit();
    };
  });
  query<HTMLFormElement>('#studio-form').onsubmit = (event) => {
    event.preventDefault();
    const button = query<HTMLButtonElement>('button[type="submit"]'),
      error = query('#studio-error');
    error.textContent = '';
    if (draft.powers?.length !== 2) {
      openTab('powers');
      error.textContent = 'Elige dos poderes para continuar.';
      return;
    }
    button.disabled = true;
    void onSubmit(structuredClone(draft))
      .catch((failure) => {
        error.textContent =
          failure instanceof Error ? failure.message : 'No se pudo guardar. Intenta de nuevo.';
      })
      .finally(() => {
        button.disabled = false;
      });
  };
  sync();
  return () => view?.dispose();
}
