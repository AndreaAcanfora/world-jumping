import { preload } from '../assets/models';
import { Game } from '../game/Game';
import type { HudState, RunResult } from '../game/Game';
import { loadRecords, loadSettings, medalFor, mergeRecord, saveRecords, saveSettings, starsOf } from '../game/progress';
import type { LevelRecord, Settings } from '../game/progress';
import { Input, requestLock } from '../input/Input';
import type { LevelDef } from '../level/types';
import { LEVELS } from '../levels';
import { loadRapier } from '../physics/Physics';
import { CHARACTERS } from '../player/Player';
import type { CharacterModel } from '../player/Player';
import { Renderer } from '../render/Renderer';
import { STRINGS, formatTime } from './i18n';
import type { Strings } from './i18n';
import { characterThumbnail } from './thumbnails';
import { Autopilot } from '../debug/Autopilot';

const DONATE_URL = 'https://www.paypal.me/AndreaAca';
const SOURCE_URL = 'https://github.com/AndreaAcanfora/world-jumping';
const CLASSIC_URL = '../platform3D-classic/';

const CHARACTER_NAMES: Record<CharacterModel, string> = {
  'character-oobi': 'Oobi',
  'character-oodi': 'Oodi',
  'character-ooli': 'Ooli',
  'character-oopi': 'Oopi',
  'character-oozi': 'Oozi',
};

type Child = Node | string | null | undefined | false;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string | boolean | ((e: Event) => void)>> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v !== undefined) el.setAttribute(k, v);
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export class App {
  private settings: Settings = loadSettings();
  private records: Record<string, LevelRecord> = loadRecords();
  private readonly renderer: Renderer;
  private readonly input: Input;
  private game: Game | null = null;
  private current: LevelDef | null = null;
  private readonly thumbs = new Map<string, Promise<string>>();
  private toastTimer = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly screen: HTMLElement,
    private readonly hud: HTMLElement,
    touchLayer: HTMLElement,
  ) {
    this.renderer = new Renderer({ canvas, maxPixelRatio: this.settings.quality === 'high' ? 2 : 1.25 });
    this.input = new Input(canvas, touchLayer);
    this.applySettings();
    this.input.onPause = () => {
      if (this.game && !this.screen.classList.contains('open')) this.showPause();
    };
    window.addEventListener('keydown', (e) => {
      // Esc without pointer lock (touch, or lock not taken yet) still pauses.
      if (e.code === 'Escape' && this.game && !document.pointerLockElement && !this.screen.classList.contains('open')) this.showPause();
    });
    // Start fetching the engine and the first level while the menu is shown.
    void loadRapier();
    void preload(this.modelsOf(LEVELS[0]!));
  }

  private get t(): Strings {
    return STRINGS[this.settings.lang];
  }

  private applySettings(): void {
    this.input.sensitivity = this.settings.sensitivity;
    this.input.invertY = this.settings.invertY;
    document.documentElement.lang = this.settings.lang;
    saveSettings(this.settings);
  }

  private modelsOf(def: LevelDef): string[] {
    return [
      // 'box' pieces are plain ground drawn in code, not a model file.
      ...def.pieces.filter((p) => p.model !== 'box').map((p) => p.model),
      ...(def.movers ?? []).map((m) => m.model),
      'spring',
      'coin-gold',
      'jewel',
      'flag',
      'block-grass-low',
      this.settings.character,
    ];
  }

  /* ------------------------------------------------------------ screens */

  private open(...content: Child[]): void {
    this.screen.replaceChildren(h('div', { class: 'panel' }, ...content));
    this.screen.classList.add('open');
  }

  private close(): void {
    this.screen.classList.remove('open');
    this.screen.replaceChildren();
  }

  showMenu(): void {
    this.endGame();
    this.screen.classList.add('title-bg');
    const t = this.t;
    this.open(
      h('h1', { class: 'logo' }, h('span', {}, 'World'), h('span', {}, 'Jumping')),
      h('p', { class: 'tagline' }, t.tagline),
      h('div', { class: 'menu' },
        h('button', { class: 'btn primary', onclick: () => this.showLevels() }, t.play),
        h('button', { class: 'btn', onclick: () => this.showCharacters() }, t.character),
        h('button', { class: 'btn', onclick: () => this.showSettings(() => this.showMenu()) }, t.settings),
      ),
      h('footer', { class: 'links' },
        h('a', { class: 'donate', href: DONATE_URL, target: '_blank', rel: 'noopener' }, t.donate),
        h('a', { href: SOURCE_URL, target: '_blank', rel: 'noopener' }, t.source),
        h('a', { href: CLASSIC_URL }, t.classic),
      ),
    );
  }

  private unlocked(index: number): boolean {
    return index === 0 || Boolean(this.records[LEVELS[index - 1]!.id]);
  }

  showLevels(): void {
    this.screen.classList.add('title-bg');
    const t = this.t;
    const stars = LEVELS.reduce((sum, l) => sum + starsOf(this.records[l.id], l.medals), 0);
    this.open(
      h('header', { class: 'bar' },
        h('button', { class: 'link', onclick: () => this.showMenu() }, t.back),
        h('h2', {}, `${t.world} 1`),
        h('span', { class: 'stars', title: 'Stars' }, `★ ${stars}`),
      ),
      h('ol', { class: 'levels' },
        ...LEVELS.map((l, i) => {
          const rec = this.records[l.id];
          const open = this.unlocked(i);
          const medal = rec ? medalFor(rec.best, l.medals) : null;
          return h('li', {},
            h('button', { class: `level ${open ? '' : 'locked'}`, disabled: !open, title: open ? '' : t.locked, onclick: () => void this.play(l) },
              h('span', { class: 'level-id' }, l.id),
              h('span', { class: 'level-name' }, l.name[this.settings.lang]),
              h('span', { class: 'level-meta' },
                rec ? `${t.best} ${formatTime(rec.best)}` : open ? '' : '🔒',
              ),
              h('span', { class: 'level-badges' },
                medal ? h('i', { class: `medal ${medal}`, title: t[medal] }) : null,
                ...(l.gems ?? []).map((_, gi) => h('i', { class: `gem ${rec?.gems[gi] ? 'got' : ''}` })),
              ),
            ),
          );
        }),
      ),
    );
  }

  private thumb(model: string): Promise<string> {
    let p = this.thumbs.get(model);
    if (!p) {
      p = characterThumbnail(model);
      this.thumbs.set(model, p);
    }
    return p;
  }

  showCharacters(): void {
    this.screen.classList.add('title-bg');
    const t = this.t;
    const grid = h('div', { class: 'characters' });
    for (const model of CHARACTERS) {
      const img = h('img', { alt: CHARACTER_NAMES[model], width: '120', height: '120' });
      void this.thumb(model).then((url) => (img.src = url));
      grid.append(
        h('button', {
          class: 'character',
          'aria-pressed': String(this.settings.character === model),
          onclick: () => {
            this.settings.character = model;
            this.applySettings();
            this.showCharacters();
          },
        }, img, h('span', {}, CHARACTER_NAMES[model])),
      );
    }
    this.open(
      h('header', { class: 'bar' }, h('button', { class: 'link', onclick: () => this.showMenu() }, t.back), h('h2', {}, t.chooseCharacter), h('span', {})),
      grid,
    );
  }

  showSettings(back: () => void): void {
    const t = this.t;
    const s = this.settings;
    const seg = <K extends keyof Settings>(key: K, options: [Settings[K], string][]) =>
      h('div', { class: 'segmented' },
        ...options.map(([value, label]) =>
          h('button', {
            'aria-pressed': String(s[key] === value),
            onclick: () => {
              s[key] = value;
              this.applySettings();
              if (key === 'view') this.game?.setView(s.view);
              this.showSettings(back);
            },
          }, label),
        ),
      );
    const slider = h('input', { type: 'range', min: '0.3', max: '2.5', step: '0.1', value: String(s.sensitivity) });
    slider.addEventListener('input', () => {
      s.sensitivity = Number(slider.value);
      this.applySettings();
    });
    this.open(
      h('header', { class: 'bar' }, h('button', { class: 'link', onclick: back }, t.back), h('h2', {}, t.settings), h('span', {})),
      h('div', { class: 'form' },
        h('label', {}, t.camera), seg('view', [['third', t.third], ['first', t.first]]),
        h('label', {}, t.sensitivity), slider,
        h('label', {}, t.invertY), seg('invertY', [[false, t.off], [true, t.on]]),
        h('label', {}, t.quality), seg('quality', [['low', t.low], ['high', t.high]]),
        h('label', {}, t.language), seg('lang', [['it', 'Italiano'], ['en', 'English']]),
      ),
      h('dl', { class: 'controls' },
        ...(this.input.touch ? [h('dd', {}, t.controlsTouch)] : t.controlsDesktop.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])),
      ),
    );
  }

  private showPause(): void {
    if (!this.game || !this.current) return;
    const level = this.current;
    this.game.setPaused(true);
    this.screen.classList.remove('title-bg');
    const t = this.t;
    const resume = () => {
      this.close();
      this.game?.setPaused(false);
      if (!this.input.touch) requestLock(this.canvas);
    };
    this.open(
      h('h2', {}, t.paused),
      h('div', { class: 'menu' },
        h('button', { class: 'btn primary', onclick: resume }, t.resume),
        h('button', { class: 'btn', onclick: () => void this.play(level) }, t.restart),
        h('button', { class: 'btn', onclick: () => this.showSettings(() => this.showPause()) }, t.settings),
        h('button', { class: 'btn', onclick: () => this.showLevels() }, t.levels),
      ),
    );
  }

  private showResults(r: RunResult): void {
    const t = this.t;
    const prev = this.records[r.level.id];
    const newBest = !prev || r.time < prev.best;
    this.records[r.level.id] = mergeRecord(prev, { time: r.time, gems: r.gems });
    saveRecords(this.records);
    const medal = medalFor(r.time, r.level.medals);
    const index = LEVELS.indexOf(r.level);
    const next = LEVELS[index + 1];
    this.screen.classList.remove('title-bg');
    this.open(
      h('p', { class: 'eyebrow' }, `${r.level.id} ${r.level.name[this.settings.lang]}`),
      h('h2', {}, t.finished),
      h('div', { class: `result-medal ${medal ?? 'none'}` }, medal ? t[medal] : t.noMedal),
      h('dl', { class: 'results' },
        h('dt', {}, t.time), h('dd', {}, formatTime(r.time), newBest ? h('em', {}, t.newBest) : null),
        h('dt', {}, t.coins), h('dd', {}, `${r.coins} / ${r.coinsTotal}`),
        h('dt', {}, t.gems), h('dd', {}, ...r.gems.map((g) => h('i', { class: `gem ${g ? 'got' : ''}` }))),
        h('dt', {}, t.falls), h('dd', {}, String(r.falls)),
        h('dt', {}, t.medals),
        h('dd', { class: 'medal-table' }, `${t.gold} ${formatTime(r.level.medals.gold)}, ${t.silver} ${formatTime(r.level.medals.silver)}, ${t.bronze} ${formatTime(r.level.medals.bronze)}`),
      ),
      h('div', { class: 'menu' },
        next ? h('button', { class: 'btn primary', onclick: () => void this.play(next) }, t.next) : null,
        h('button', { class: next ? 'btn' : 'btn primary', onclick: () => void this.play(r.level) }, t.retry),
        h('button', { class: 'btn', onclick: () => this.showLevels() }, t.levels),
      ),
    );
  }

  /* ------------------------------------------------------------ game */

  private endGame(): void {
    this.game?.dispose();
    this.game = null;
    this.current = null;
    this.hud.classList.remove('on');
    document.body.classList.remove('playing');
  }

  async play(def: LevelDef): Promise<void> {
    this.endGame();
    this.screen.classList.remove('title-bg');
    this.open(h('p', { class: 'loading' }, this.t.loading));
    await preload(this.modelsOf(def));
    const game = await Game.create(def, this.settings, this.renderer, this.input, {
      hud: (s) => this.drawHud(s),
      toast: (k) => this.toast(k),
      pause: () => this.showPause(),
      finish: (r) => this.showResults(r),
    });
    const params = new URLSearchParams(location.search);
    if (params.has('autopilot')) game.autopilot = new Autopilot(def);
    if (params.has('autopilot') || params.has('debug')) (window as unknown as { __wjGame?: Game }).__wjGame = game;
    this.game = game;
    this.current = def;
    this.buildHud(def);
    this.hud.classList.add('on');
    document.body.classList.add('playing');
    game.start();
    if (this.input.touch) this.close();
    else {
      const t = this.t;
      this.open(
        h('p', { class: 'eyebrow' }, def.id),
        h('h2', {}, def.name[this.settings.lang]),
        def.hint ? h('p', { class: 'hint' }, def.hint[this.settings.lang]) : null,
        h('button', {
          class: 'btn primary',
          onclick: () => {
            this.close();
            requestLock(this.canvas);
          },
        }, t.clickToPlay),
      );
      this.game.setPaused(true);
      const unpause = () => game.setPaused(false);
      document.addEventListener('pointerlockchange', unpause, { once: true });
    }
    if (this.input.touch && def.hint) this.say(def.hint[this.settings.lang], 5000);
  }

  private buildHud(def: LevelDef): void {
    const t = this.t;
    const a = def.abilities;
    this.hud.replaceChildren(
      h('div', { class: 'hud-top' },
        h('span', { class: 'hud-time', id: 'hud-time' }, '0:00.00'),
        h('span', { class: 'hud-coins', id: 'hud-coins' }, '0'),
        h('span', { class: 'hud-gems', id: 'hud-gems' }),
      ),
      h('div', { class: 'hud-abilities' },
        a.dashes ? h('span', { class: 'ability', id: 'hud-dash', title: t.dash }) : null,
        a.fuel ? h('span', { class: 'ability fuel', title: t.jetpack }, h('b', { id: 'hud-fuel' })) : null,
        a.magic ? h('span', { class: 'ability', id: 'hud-magic', title: t.magic }) : null,
      ),
      h('div', { class: 'toast', id: 'hud-toast' }),
    );
  }

  private drawHud(s: HudState): void {
    const set = (id: string, text: string) => {
      const el = document.getElementById(id);
      if (el && el.textContent !== text) el.textContent = text;
    };
    set('hud-time', formatTime(s.time));
    set('hud-coins', `${s.coins}/${s.coinsTotal}`);
    set('hud-gems', s.gems.map((g) => (g ? '◆' : '◇')).join(''));
    set('hud-dash', `${this.t.dash} ${s.dashes}`);
    set('hud-magic', `${this.t.magic} ${s.magic}`);
    const fuel = document.getElementById('hud-fuel');
    if (fuel) fuel.style.width = `${(100 * s.fuel) / Math.max(s.fuelMax, 0.001)}%`;
  }

  private toast(key: 'checkpoint' | 'fall' | 'gem' | 'win'): void {
    const t = this.t;
    const text = { checkpoint: t.toastCheckpoint, fall: t.toastFall, gem: t.toastGem, win: t.toastWin }[key];
    this.say(text, 1600);
  }

  private say(text: string, ms: number): void {
    const el = document.getElementById('hud-toast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove('on'), ms);
  }
}
