import { mountPetTrial } from './pet-trial';
import { getAllAbilities } from './abilities';
import type { Character } from './characters';
import type { PlayerProfile } from './profile';
import { elementLabel, rarityLabel, statLabel } from './nft';
import { getToken, isLoggedIn } from './api';
import { navigation } from './navigation';
import { mountPetPreview } from './pet-preview';

type Session = {
  id: string;
  stage: 'customize' | 'dice' | 'wheel' | 'name' | 'dart' | 'summary';
  dice?: Record<string, number[]>;
  pet?: Character;
  dart?: { startedAt: number; stat: string; bonus?: number; position?: number };
  serverNow: number;
};
const SESSION_KEY = 'foodie-pets-onboarding';
const elements = ['fuego', 'agua', 'tierra', 'aire', 'sombra', 'luz'] as const;
let session: Session | null = null;
let frame = 0;
let serverTime = 0;
let receivedAt = 0;
let animating = false;
let stopPreview: (() => void) | undefined;
navigation.onNavigate((screen) => {
  if (screen !== 'onboarding') {
    cancelAnimationFrame(frame);
    animating = false;
    stopPreview?.();
    stopPreview = undefined;
  }
});

async function request<T>(path: string, body?: object): Promise<T> {
  const token = getToken();
  const response = await fetch(`/api/onboarding${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No se pudo conectar. Intenta de nuevo.');
  return data;
}

function accept(next: Session) {
  session = next;
  serverTime = next.serverNow;
  receivedAt = performance.now();
  localStorage.setItem(SESSION_KEY, next.id);
}

export async function claimFoodiePet(): Promise<PlayerProfile | null> {
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  const restored = await request<Session>(`/${encodeURIComponent(id)}`);
  accept(restored);
  if (restored.stage !== 'summary') return null;
  const profile = await request<PlayerProfile>(`/${id}/claim`, {});
  localStorage.removeItem(SESSION_KEY);
  session = null;
  return profile;
}

export function hasPendingPet() {
  return !!localStorage.getItem(SESSION_KEY);
}

export function mountOnboarding(onClaim: (profile: PlayerProfile) => void) {
  const panel = document.getElementById('onboarding-content')!;
  const error = document.getElementById('onboarding-error')!;
  const status = document.getElementById('onboarding-status')!;
  const busy = async (button: HTMLButtonElement, action: () => Promise<void>) => {
    button.disabled = true;
    error.textContent = '';
    try {
      await action();
    } catch (e) {
      error.textContent = e instanceof Error ? e.message : 'Intenta de nuevo.';
    } finally {
      button.disabled = false;
    }
  };

  function setAnimating(value: boolean) {
    animating = value;
    document.getElementById('onboarding-back')!.toggleAttribute('disabled', value);
    panel.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      button.disabled = value || (button.id === 'start-dart' && !session?.dice);
    });
  }
  async function animateFor(duration: number, tick: (progress: number) => void) {
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const step = () => {
        if (navigation.getCurrent() !== 'onboarding') {
          resolve();
          return;
        }
        const progress = Math.min(1, (performance.now() - start) / duration);
        tick(progress);
        if (progress < 1) frame = requestAnimationFrame(step);
        else resolve();
      };
      step();
    });
  }

  function draw() {
    cancelAnimationFrame(frame);
    stopPreview?.();
    stopPreview = undefined;
    if (navigation.getCurrent() !== 'onboarding') return;
    if (!session) return;
    error.textContent = '';
    const pet = session.pet;
    status.textContent =
      session.stage === 'summary'
        ? '04 / Tu regalo de bienvenida'
        : session.stage === 'dart'
          ? '03 / Minijuego de dardos'
          : session.stage === 'dice' || session.stage === 'name'
            ? '02 / Tus estadísticas'
            : '01 / Diseña tu Foodie Pet';
    if (session.stage === 'customize' || session.stage === 'wheel') {
      panel.innerHTML = `<h2>Un Foodie Pet a tu manera</h2><p>Elige su personalidad. Los dados decidirán sus estadísticas y tu puntería, su rareza.</p>
      <div class="onboarding-pet-preview" id="custom-preview"></div>
      <form id="custom-form" class="pet-custom-form">
      <label for="pet-name">Nombre</label><input id="pet-name" required minlength="2" maxlength="24" placeholder="Por ejemplo, Mochi" />
      <div class="custom-pair"><div><label for="pet-element">Elemento</label><select id="pet-element">${elements.map((el) => `<option value="${el}">${elementLabel(el)}</option>`).join('')}</select></div>
      <div><label for="pet-shape">Tipo de cuerpo</label><select id="pet-shape"><option value="bestia">Bestia</option><option value="golem">Gólem</option><option value="espectral">Espíritu</option><option value="humanoid">Guardián</option></select></div></div>
      <div class="custom-pair"><div><label for="pet-head">Forma de la cabeza</label><select id="pet-head"><option value="round">Redonda</option><option value="cube">Cuadrada</option><option value="diamond">Diamante</option></select></div>
      <div><label for="pet-limbs">Cantidad de extremidades</label><select id="pet-limbs">${[0, 2, 4, 6, 8].map((n) => `<option value="${n}" ${n === 4 ? 'selected' : ''}>${n} extremidades</option>`).join('')}</select></div></div>
      <label for="pet-length">Largo de las extremidades · <span id="limb-length-value">1.0</span></label><input id="pet-length" type="range" min="0.5" max="1.8" step="0.1" value="1" />
      <label for="pet-color">Color de tu Pet</label><input type="color" id="pet-color" value="#f47752" />
      <fieldset class="power-choices"><legend>Elige dos poderes · <span id="power-count">0/2</span></legend>${getAllAbilities()
        .map(
          (a) =>
            `<label><input type="checkbox" name="power" value="${a.id}" /><span>${a.icon} ${a.name}</span></label>`
        )
        .join('')}</fieldset>
      <button class="foodie-primary" type="submit">Continuar a los dados</button></form>`;
      const select = (id: string) => panel.querySelector<HTMLInputElement | HTMLSelectElement>(id)!;
      const draft = pet
        ? structuredClone(pet)
        : ({
            id: 'preview',
            name: 'Tu Pet',
            traits: {
              headShape: 'round',
              limbCount: 4,
              limbLength: 1,
              element: 'fuego',
              bodyType: 'bestia',
              primaryColor: 0xf47752,
              secondaryColor: 0xffd4a3,
              accentColor: 0xfff4db,
              rarity: 'comun',
              eyeStyle: 0,
              hornStyle: 0,
              wingStyle: 0,
              pattern: 0,
            },
            baseStats: { atk: 2, def: 2, spd: 2, hp: 2, ability: 2 },
            level: 1,
            xp: 0,
            upgrades: [],
            unlockedAt: 0,
            source: 'starter',
            isStarter: true,
          } as Character);
      if (pet) {
        select('#pet-name').value = pet.name;
        select('#pet-element').value = pet.traits.element;
        select('#pet-shape').value = pet.traits.bodyType;
        select('#pet-head').value = pet.traits.headShape ?? 'round';
        select('#pet-limbs').value = String(pet.traits.limbCount ?? 4);
        select('#pet-length').value = String(pet.traits.limbLength ?? 1);
        select('#pet-color').value = `#${pet.traits.primaryColor.toString(16).padStart(6, '0')}`;
      }
      const refresh = () => {
        draft.traits.element = select('#pet-element').value as Character['traits']['element'];
        draft.traits.bodyType = select('#pet-shape').value as Character['traits']['bodyType'];
        draft.traits.headShape = select('#pet-head').value as 'round' | 'cube' | 'diamond';
        draft.traits.limbCount = Number(select('#pet-limbs').value);
        draft.traits.limbLength = Number(select('#pet-length').value);
        panel.querySelector('#limb-length-value')!.textContent = draft.traits.limbLength.toFixed(1);
        draft.traits.primaryColor = parseInt(select('#pet-color').value.slice(1), 16);
        stopPreview?.();
        stopPreview = mountPetPreview(panel.querySelector('#custom-preview')!, draft);
      };
      [
        '#pet-element',
        '#pet-shape',
        '#pet-color',
        '#pet-head',
        '#pet-limbs',
        '#pet-length',
      ].forEach((id) => {
        select(id).onchange = refresh;
      });
      refresh();
      const checks = Array.from(panel.querySelectorAll<HTMLInputElement>('input[name="power"]'));
      checks.forEach((check) => {
        check.checked = !!pet?.powers?.includes(check.value);
        check.onchange = () => {
          const count = checks.filter((c) => c.checked).length;
          panel.querySelector('#power-count')!.textContent = `${count}/2`;
          checks.forEach((c) => {
            c.disabled = count >= 2 && !c.checked;
          });
        };
      });
      checks[0].onchange?.(new Event('change'));
      panel.querySelector<HTMLFormElement>('form')!.onsubmit = (event) => {
        event.preventDefault();
        const button = panel.querySelector<HTMLButtonElement>('button')!;
        void busy(button, async () => {
          const powers = checks.filter((c) => c.checked).map((c) => c.value);
          if (powers.length !== 2) throw new Error('Elige dos poderes para tu Foodie Pet.');
          const next = await request<Session>(`/${session!.id}/customize`, {
            name: select('#pet-name').value,
            element: select('#pet-element').value,
            bodyType: select('#pet-shape').value,
            headShape: select('#pet-head').value,
            limbCount: Number(select('#pet-limbs').value),
            limbLength: Number(select('#pet-length').value),
            color: select('#pet-color').value,
            powers,
          });
          accept(next);
          draw();
        });
      };
    } else if ((session.stage === 'dice' || session.stage === 'name') && pet) {
      panel.innerHTML = `<h2>Los dados de tu Pet</h2><p>Dos dados por estadística. Puedes volver a lanzarlos hasta encontrar las estadísticas que prefieras.</p>
      <div class="dice-grid">${(['atk', 'def', 'spd', 'hp', 'ability'] as const).map((key) => `<div class="dice-stat"><span>${statLabel(key)}</span><div>${(session!.dice?.[key] || [1, 1]).map((n) => `<span class="dice-face" aria-label="Dado ${n}">${['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][n - 1]}</span>`).join('')}</div><b>${session!.dice ? `${session!.dice[key][0]} + ${session!.dice[key][1]} = ${pet.baseStats[key]}` : 'Por lanzar'}</b></div>`).join('')}</div><button class="foodie-primary" id="roll-again">${session.dice ? 'Volver a lanzar los dados' : 'Lanzar mis dados'}</button>
      <label for="dart-stat">¿Qué estadística quieres mejorar con tu regalo?</label><select id="dart-stat">${(['atk', 'def', 'spd', 'hp', 'ability'] as const).map((key) => `<option value="${key}">${statLabel(key)}</option>`).join('')}</select>
      <p>La flecha recorrerá una barra vertical. Detenla en verde para conseguir los mejores premios. Tienes 30 segundos desde que pulses empezar.</p>
      <button class="foodie-primary" id="start-dart" ${session.dice ? '' : 'disabled'}>Empezar minijuego de dardos</button>`;
      panel.querySelector<HTMLButtonElement>('#roll-again')!.onclick = () => {
        const button = panel.querySelector<HTMLButtonElement>('#roll-again')!;
        void busy(button, async () => {
          setAnimating(true);
          try {
            const result = request<Session>(`/${session!.id}/roll`, {
              attemptId: crypto.randomUUID(),
            }).then(
              (next) => ({ next, error: null as unknown }),
              (error) => ({ next: null, error })
            );
            panel.querySelectorAll<HTMLElement>('.dice-stat b').forEach((value) => {
              value.textContent = 'Girando…';
            });
            await animateFor(2000, (progress) => {
              panel.querySelectorAll<HTMLElement>('.dice-face').forEach((face, index) => {
                face.textContent = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][
                  (Math.floor(progress * 36) + index) % 6
                ];
                face.style.transform = `perspective(160px) rotateX(${progress * 1080}deg) rotateY(${progress * 1440}deg)`;
              });
            });
            const rolled = await result;
            if (rolled.error) {
              draw();
              throw rolled.error;
            }
            accept(rolled.next!);
            draw();
          } finally {
            setAnimating(false);
          }
        });
      };
      const button = panel.querySelector<HTMLButtonElement>('#start-dart')!;
      button.onclick = () =>
        busy(button, async () => {
          accept(
            await request<Session>(`/${session!.id}/dart/start`, {
              stat: panel.querySelector<HTMLSelectElement>('#dart-stat')!.value,
            })
          );
          draw();
        });
    } else if (session.stage === 'dart') {
      panel.innerHTML = `<h2>¡Detén la flecha en verde!</h2><p>La flecha sube y baja. Pulsa «Lanzar dardo» o la barra espaciadora cuando pase por tu premio favorito.</p>
      <div class="dart-game"><div class="prize-bar" aria-hidden="true"><div class="prize-center">★</div><span id="dart-cursor" class="dart-arrow">➜</span></div>
      <div class="prize-legend"><span>🔴 Común · +1</span><span>🟠 Raro · +2</span><span>🟢 Épico · +3</span><span>✦ Centro verde: legendario · +4</span><span>★ Centro exacto: especial · +5</span></div></div>
      <p id="dart-time" role="timer"></p><button class="foodie-primary" id="throw-dart">Lanzar dardo</button><button class="foodie-text-button" id="accessible-dart">Continuar sin movimiento · Común +1</button>`;
      const throwButton = panel.querySelector<HTMLButtonElement>('#throw-dart')!;
      const accessible = panel.querySelector<HTMLButtonElement>('#accessible-dart')!;
      let throwing = false;
      let displayedElapsed = Math.max(0, serverTime - session.dart!.startedAt);
      const launch = async (useAccessible: boolean) => {
        if (throwing) return;
        throwing = true;
        accessible.disabled = true;
        cancelAnimationFrame(frame);
        await busy(throwButton, async () => {
          setAnimating(true);
          try {
            const next = await request<Session>(`/${session!.id}/dart/throw`, {
              accessible: useAccessible,
              elapsed: displayedElapsed,
            });
            if (navigation.getCurrent() !== 'onboarding') return;
            const impact = (next.dart?.position ?? 5) - 50;
            panel.innerHTML = `<h2>¡Ahí va tu dardo!</h2><p>Vuela hacia la diana. El centro tiene el mayor puntaje.</p><div class="dart-flight-scene"><div class="red-white-target" id="flight-target"><span class="target-bullseye">★</span><span id="dart-impact" class="dart-impact" hidden>✦</span></div><span id="flying-dart" class="flying-dart"><svg viewBox="0 0 160 40" aria-label="Dardo en vuelo"><path d="M5 5 L42 14 L115 17 L155 20 L115 23 L42 26 L5 35 L16 20 Z" fill="#3d5636"/><path d="M16 20 H120" stroke="#e6bd68" stroke-width="4"/><path d="M5 5 L42 14 L30 20 L5 35 L16 20 Z" fill="#c95b47"/></svg></span></div><p id="flight-caption" role="status">Lanzando…</p>`;
            const target = panel.querySelector<HTMLElement>('#flight-target')!;
            const scene = panel.querySelector<HTMLElement>('.dart-flight-scene')!;
            const targetX = (target.offsetLeft / scene.clientWidth) * 100;
            const targetY =
              50 + ((impact * 0.009 * target.clientHeight) / scene.clientHeight) * 100;
            await animateFor(2000, (progress) => {
              const dart = panel.querySelector<HTMLElement>('#flying-dart');
              if (!dart) return;
              const travel = Math.min(progress / 0.8, 1);
              dart.style.left = `${8 + travel * (targetX - 8)}%`;
              dart.style.top = `${80 + travel * (targetY - 80) - Math.sin(travel * Math.PI) * 24}%`;
              dart.style.transform = `translate(-50%,-50%) rotate(${travel * 40 - 40}deg) scale(${1.6 - travel * 0.9})`;
              if (progress >= 0.8) {
                dart.hidden = true;
                const mark = panel.querySelector<HTMLElement>('#dart-impact')!;
                mark.hidden = false;
                mark.style.top = `${50 + impact * 0.9}%`;
                panel.querySelector('#flight-caption')!.textContent =
                  '¡Impacto! Preparando tu regalo…';
              }
            });
            accept(next);
            draw();
          } finally {
            setAnimating(false);
          }
        });
        throwing = false;
        accessible.disabled = false;
        if (session?.stage === 'dart' && navigation.getCurrent() === 'onboarding') animate();
      };
      throwButton.onclick = () => launch(false);
      accessible.onclick = () => launch(true);
      throwButton.onkeydown = (e) => {
        if (e.code === 'Space') {
          e.preventDefault();
          void launch(false);
        }
      };
      function animate() {
        if (navigation.getCurrent() !== 'onboarding' || session?.stage !== 'dart') return;
        displayedElapsed = Math.max(
          0,
          serverTime + performance.now() - receivedAt - session.dart!.startedAt
        );
        const position = 5 + 90 * (1 - Math.abs((displayedElapsed % 2400) / 1200 - 1));
        panel.querySelector<HTMLElement>('#dart-cursor')!.style.top = `${position}%`;
        panel.querySelector<HTMLElement>('#dart-time')!.textContent =
          `${Math.max(0, Math.ceil((30000 - displayedElapsed) / 1000))} segundos · Un lanzamiento`;
        if (displayedElapsed >= 30000) {
          void launch(true);
          return;
        }
        frame = requestAnimationFrame(animate);
      }
      animate();
      throwButton.focus();
    } else if (pet) {
      panel.innerHTML = `<div class="onboarding-pet-preview" id="onboarding-pet-preview"></div><h2 id="summary-pet-name"></h2><p>${elementLabel(pet.traits.element)} · ${rarityLabel(pet.traits.rarity)} · Nivel 1</p><p>${getAllAbilities()
        .filter((a) => pet.powers?.includes(a.id))
        .map((a) => `${a.icon} ${a.name}`)
        .join(
          ' · '
        )}</p><p>Tu dardo obtuvo <strong>+${session.dart?.bonus ?? 0}</strong> puntos. Tu rareza y bonus quedan guardados.</p>
        <div class="summary-stats">${(['atk', 'def', 'spd', 'hp', 'ability'] as const).map((key) => `<span>${statLabel(key)}<b>${pet.baseStats[key]}${session!.dart?.stat === key && session!.dart.bonus ? ` + ${session!.dart.bonus}` : ''}</b></span>`).join('')}</div>
        <p>Apoya a tus restaurantes favoritos y sigue mejorando tu colección.</p><button class="foodie-primary" id="trial-pet">Probar mi Pet en el campo del mundo</button><button class="foodie-primary" id="claim-pet">${isLoggedIn() ? 'Guardar mi Foodie Pet' : 'Crear cuenta o iniciar sesión para guardarlo'}</button>`;
      panel.querySelector('#summary-pet-name')!.textContent = pet.name;
      panel.querySelector<HTMLButtonElement>('#trial-pet')!.onclick = () => {
        stopPreview?.();
        stopPreview = undefined;
        panel.innerHTML =
          '<h2>El campo de tu Foodie Pet</h2><p>Explora con WASD, las flechas o los botones. Prueba tus poderes y vuelve cuando estés listo.</p><div id="pet-trial"></div><button class="foodie-primary" id="leave-trial">Volver a mi Pet</button>';
        stopPreview = mountPetTrial(panel.querySelector('#pet-trial')!, pet);
        panel.querySelector<HTMLButtonElement>('#leave-trial')!.onclick = draw;
      };
      const button = panel.querySelector<HTMLButtonElement>('#claim-pet')!;
      button.onclick = () =>
        busy(button, async () => {
          if (!isLoggedIn()) {
            navigation.navigate('login');
            return;
          }
          const profile = await claimFoodiePet();
          if (profile) onClaim(profile);
        });
    }
    if (session.stage !== 'customize' && session.stage !== 'wheel') {
      const back = document.createElement('div');
      back.className = 'onboarding-step-back';
      back.innerHTML = `${session.stage !== 'dice' && session.stage !== 'name' ? '<button class="foodie-text-button" data-back="dice">← Volver a los dados</button>' : ''}<button class="foodie-text-button" data-back="customize">← Editar mi personaje</button>`;
      panel.append(back);
      back.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
        button.onclick = () =>
          busy(button, async () => {
            cancelAnimationFrame(frame);
            try {
              accept(
                await request<Session>(`/${session!.id}/back`, { stage: button.dataset.back })
              );
              draw();
            } catch (failure) {
              draw();
              throw failure;
            }
          });
      });
    }
    const preview = panel.querySelector<HTMLElement>('#onboarding-pet-preview');
    if (preview && pet) stopPreview = mountPetPreview(preview, pet);
  }

  const load = async () => {
    panel.textContent = 'Preparando tu aventura…';
    error.textContent = '';
    try {
      const id = localStorage.getItem(SESSION_KEY);
      accept(await request<Session>(id ? `/${encodeURIComponent(id)}` : '', id ? undefined : {}));
      draw();
    } catch (e) {
      error.textContent = e instanceof Error ? e.message : 'No se pudo conectar.';
      panel.innerHTML =
        '<button class="foodie-primary" id="retry-onboarding">Reintentar</button><button class="foodie-text-button" id="restart-onboarding">Empezar una sesión nueva</button>';
      panel.querySelector<HTMLButtonElement>('#retry-onboarding')!.onclick = load;
      panel.querySelector<HTMLButtonElement>('#restart-onboarding')!.onclick = () => {
        localStorage.removeItem(SESSION_KEY);
        void load();
      };
    }
  };
  document.getElementById('onboarding-back')!.onclick = () => {
    if (animating) return;
    cancelAnimationFrame(frame);
    navigation.navigate('landing');
  };
  void load();
}
