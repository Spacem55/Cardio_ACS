'use strict';

// ---------- Палитра фона (та же, что в Android-версии) ----------
const BACKGROUND_PALETTE = [
  '#AECEF9', '#FFF3E0', '#FCE4EC', // пастельные
  '#FF69B4', // розовый
  '#AEEA00', // салатовый
  '#7FFFD4', // аквамарин
  '#FF7F50', // коралл
];
const CARDIO_PRIMARY = '#3A75C4';
const CARDIO_DARK_PRIMARY = '#6FA8DC';
const CARDIO_BACKGROUND_DEFAULT = '#AECEF9';

const STORAGE_KEY = 'cardio_acs_theme_v1';

// ---------- Цветовые утилиты (порт accentColorFor / contrastingTextColor / luminance) ----------

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

function rgbToHsv({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function hsvToRgb({ h, s, v }) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r1, g1, b1;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

/** Relative luminance по формуле sRGB (та же, что Compose Color.luminance()). */
function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastingTextColor(backgroundHex) {
  return luminance(backgroundHex) > 0.5 ? '#1B1B1B' : '#FFFFFF';
}

function accentColorFor(backgroundHex, isDark) {
  const hsv = rgbToHsv(hexToRgb(backgroundHex));
  if (hsv.s < 0.08) {
    return isDark ? CARDIO_DARK_PRIMARY : CARDIO_PRIMARY;
  }
  const newHsv = { h: hsv.h, s: isDark ? 0.5 : 0.55, v: isDark ? 0.7 : 0.55 };
  return rgbToHex(hsvToRgb(newHsv));
}

function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

// ---------- Состояние темы (персистентность через localStorage) ----------

function loadThemeState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { background: CARDIO_BACKGROUND_DEFAULT, dark: false };
    const parsed = JSON.parse(raw);
    return {
      background: parsed.background || CARDIO_BACKGROUND_DEFAULT,
      dark: !!parsed.dark,
    };
  } catch (e) {
    return { background: CARDIO_BACKGROUND_DEFAULT, dark: false };
  }
}

function saveThemeState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* приватный режим Safari и т.п. — не критично */ }
}

let themeState = loadThemeState();

function applyTheme() {
  const root = document.documentElement;
  root.setAttribute('data-dark', themeState.dark ? 'true' : 'false');
  const effectiveBackground = themeState.dark ? '#1A1A1A' : themeState.background;
  const accent = accentColorFor(effectiveBackground, themeState.dark);
  const onAccent = contrastingTextColor(accent);
  root.style.setProperty('--background', effectiveBackground);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--on-accent', onAccent);
  root.style.setProperty('--accent-14', hexToRgba(accent, 0.14));
  // color-mix может не поддерживаться старым Safari — используем явный rgba как фактическое значение фона плашек.
  document.querySelectorAll('.subsection-header, .result-header').forEach((el) => {
    el.style.background = hexToRgba(accent, 0.14);
  });
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) themeColorMeta.setAttribute('content', accent);
  saveThemeState(themeState);
}

// ---------- Ввод данных: состояние формы ----------

const state = {
  sex: Sex.MALE,
  age: null, height: null, weight: null,
  creatinine: null, heartRate: null, sbp: null, hematocrit: null,
  cardiacArrest: false, stDeviation: false, elevatedEnzymes: false,
  killip: Killip.I,
  signsOfChf: false, priorVascularDisease: false, diabetes: false,
  visibility: { bmi: true, gfr: true, crCl: true, grace: true, crusade: true },
};

function parseNum(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function parseInt10(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function fmt1(n) { return n.toFixed(1); }

// ---------- Рендер результатов ----------

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function renderResults() {
  const creatinineClearance = (state.age != null && state.weight != null && state.weight > 0 &&
    state.creatinine != null && state.creatinine > 0)
    ? cockcroftGault(state.sex, state.age, state.weight, state.creatinine)
    : null;

  // ИМТ
  const bmiBlock = document.getElementById('bmiBlock');
  bmiBlock.hidden = !state.visibility.bmi;
  if (state.visibility.bmi) {
    const comments = document.getElementById('bmiComments');
    comments.innerHTML = '';
    if (state.height != null && state.height > 0 && state.weight != null && state.weight > 0) {
      const bmi = calculateBmi(state.weight, state.height);
      document.getElementById('bmiValue').textContent = fmt1(bmi.value);
      comments.appendChild(el('p', 'result-comment', '*Единицы измерения: кг/м²'));
      comments.appendChild(el('p', 'result-comment', `Категория: ${bmi.category}`));
    } else {
      document.getElementById('bmiValue').textContent = '—';
      comments.appendChild(el('p', 'missing-hint', 'Заполните: рост, масса тела'));
    }
  }

  // СКФ
  const gfrBlock = document.getElementById('gfrBlock');
  gfrBlock.hidden = !state.visibility.gfr;
  if (state.visibility.gfr) {
    const comments = document.getElementById('gfrComments');
    comments.innerHTML = '';
    if (state.age != null && state.creatinine != null && state.creatinine > 0) {
      const gfr = ckdEpi2021(state.sex, state.age, state.creatinine);
      document.getElementById('gfrValue').textContent = fmt1(gfr);
      comments.appendChild(el('p', 'result-comment', '*Единицы измерения: мл/мин/1.73м²'));
      comments.appendChild(el('p', 'result-comment', `Стадия ХБП: ${ckdStage(gfr)}`));
    } else {
      document.getElementById('gfrValue').textContent = '—';
      comments.appendChild(el('p', 'missing-hint', 'Заполните: возраст, креатинин'));
    }
  }

  // Клиренс креатинина
  const crclBlock = document.getElementById('crclBlock');
  crclBlock.hidden = !state.visibility.crCl;
  if (state.visibility.crCl) {
    const comments = document.getElementById('crclComments');
    comments.innerHTML = '';
    if (creatinineClearance != null) {
      document.getElementById('crclValue').textContent = fmt1(creatinineClearance);
      comments.appendChild(el('p', 'result-comment', '*Единицы измерения: мл/мин'));
      comments.appendChild(el('p', 'result-comment', `Стадия ХБП: ${ckdStage(creatinineClearance)}`));
    } else {
      document.getElementById('crclValue').textContent = '—';
      comments.appendChild(el('p', 'missing-hint', 'Заполните: возраст, масса тела, креатинин'));
    }
  }

  // GRACE
  const graceBlock = document.getElementById('graceBlock');
  graceBlock.hidden = !state.visibility.grace;
  if (state.visibility.grace) {
    const comments = document.getElementById('graceComments');
    comments.innerHTML = '';
    if (state.age != null && state.heartRate != null && state.sbp != null &&
        state.creatinine != null && state.creatinine > 0) {
      const res = graceScore({
        age: state.age, heartRate: state.heartRate, sbp: state.sbp,
        creatinineUmol: state.creatinine, killip: state.killip,
        cardiacArrestAtAdmission: state.cardiacArrest,
        stDeviation: state.stDeviation, elevatedEnzymes: state.elevatedEnzymes,
      });
      document.getElementById('graceValue').textContent = String(res.points);
      comments.appendChild(el('p', 'result-comment', '*Единицы измерения: баллы'));
      comments.appendChild(el('p', 'result-comment', `Категория риска: ${res.riskCategory}`));
      comments.appendChild(el('p', 'result-comment', `Тактика КАГ: ${res.kagStrategy}, ${res.kagTiming}`));
    } else {
      document.getElementById('graceValue').textContent = '—';
      comments.appendChild(el('p', 'missing-hint', 'Заполните: возраст, ЧСС, АД сист., креатинин'));
    }
  }

  // CRUSADE
  const crusadeBlock = document.getElementById('crusadeBlock');
  crusadeBlock.hidden = !state.visibility.crusade;
  if (state.visibility.crusade) {
    const comments = document.getElementById('crusadeComments');
    comments.innerHTML = '';
    if (state.hematocrit != null && creatinineClearance != null &&
        state.heartRate != null && state.sbp != null) {
      const res = crusadeScore({
        hematocrit: state.hematocrit, creatinineClearance,
        heartRate: state.heartRate, sex: state.sex,
        signsOfChf: state.signsOfChf, priorVascularDisease: state.priorVascularDisease,
        diabetes: state.diabetes, sbp: state.sbp,
      });
      document.getElementById('crusadeValue').textContent = String(res.points);
      comments.appendChild(el('p', 'result-comment', '*Единицы измерения: баллы'));
      comments.appendChild(el('p', 'result-comment', `Категория риска кровотечения: ${res.riskCategory}`));
      comments.appendChild(el('p', 'result-comment', `Риск крупного кровотечения: ${res.bleedingRiskPercent}`));
    } else {
      document.getElementById('crusadeValue').textContent = '—';
      comments.appendChild(el('p', 'missing-hint', 'Заполните: гематокрит, ЧСС, АД сист. и данные для расчёта клиренса креатинина (возраст, масса, креатинин)'));
    }
  }

  applyTheme(); // перекрашиваем плашки после innerHTML-замены (стиль background ставится инлайново)
}

// ---------- Обработчики ввода ----------

function bindNumberInput(id, key, parser) {
  document.getElementById(id).addEventListener('input', (e) => {
    state[key] = parser(e.target.value);
    renderResults();
  });
}

bindNumberInput('ageInput', 'age', parseInt10);
bindNumberInput('heightInput', 'height', parseNum);
bindNumberInput('weightInput', 'weight', parseNum);
bindNumberInput('hrInput', 'heartRate', parseInt10);
bindNumberInput('sbpInput', 'sbp', parseInt10);
bindNumberInput('creatinineInput', 'creatinine', parseNum);
bindNumberInput('hematocritInput', 'hematocrit', parseNum);

function bindCheckbox(id, key) {
  document.getElementById(id).addEventListener('change', (e) => {
    state[key] = e.target.checked;
    renderResults();
  });
}
bindCheckbox('cardiacArrestInput', 'cardiacArrest');
bindCheckbox('stDeviationInput', 'stDeviation');
bindCheckbox('elevatedEnzymesInput', 'elevatedEnzymes');
bindCheckbox('signsOfChfInput', 'signsOfChf');
bindCheckbox('priorVascularDiseaseInput', 'priorVascularDisease');
bindCheckbox('diabetesInput', 'diabetes');

// Пол
function updateSexButtons() {
  document.getElementById('sexMale').classList.toggle('active', state.sex === Sex.MALE);
  document.getElementById('sexFemale').classList.toggle('active', state.sex === Sex.FEMALE);
}
document.getElementById('sexMale').addEventListener('click', () => { state.sex = Sex.MALE; updateSexButtons(); renderResults(); });
document.getElementById('sexFemale').addEventListener('click', () => { state.sex = Sex.FEMALE; updateSexButtons(); renderResults(); });
updateSexButtons();

// Killip select
const killipSelect = document.getElementById('killipSelect');
KillipOrder.forEach((k) => {
  const opt = document.createElement('option');
  opt.value = k.key;
  opt.textContent = k.label;
  killipSelect.appendChild(opt);
});
killipSelect.addEventListener('change', () => {
  state.killip = KillipOrder.find((k) => k.key === killipSelect.value) || Killip.I;
  renderResults();
});

// ---------- Меню (гамбургер) ----------

const menuButton = document.getElementById('menuButton');
const menuDropdown = document.getElementById('menuDropdown');
menuButton.addEventListener('click', (e) => {
  e.stopPropagation();
  const willShow = menuDropdown.hidden;
  menuDropdown.hidden = !willShow;
  menuButton.setAttribute('aria-expanded', String(willShow));
});
document.addEventListener('click', () => { menuDropdown.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); });
menuDropdown.addEventListener('click', (e) => e.stopPropagation());

menuDropdown.querySelector('[data-action="open-theme"]').addEventListener('click', () => {
  menuDropdown.hidden = true;
  openThemeDialog();
});
menuDropdown.querySelector('[data-action="open-formulas"]').addEventListener('click', () => {
  menuDropdown.hidden = true;
  document.getElementById('formulasDialogOverlay').hidden = false;
});
menuDropdown.querySelector('[data-action="open-about"]').addEventListener('click', () => {
  menuDropdown.hidden = true;
  document.getElementById('aboutDialogOverlay').hidden = false;
});

// ---------- Диалог "Тема" ----------

const themeDialogOverlay = document.getElementById('themeDialogOverlay');
const darkThemeSwitch = document.getElementById('darkThemeSwitch');
const paletteEl = document.getElementById('palette');
let pendingBackground = themeState.background;
let pendingDark = themeState.dark;

function buildPalette() {
  paletteEl.innerHTML = '';
  BACKGROUND_PALETTE.forEach((hex) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch';
    btn.style.background = hex;
    btn.addEventListener('click', () => {
      if (pendingDark) return;
      pendingBackground = hex;
      updatePaletteSelection();
    });
    btn.dataset.hex = hex;
    paletteEl.appendChild(btn);
  });
  updatePaletteSelection();
}
function updatePaletteSelection() {
  [...paletteEl.children].forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.hex === pendingBackground);
  });
}
buildPalette();

function openThemeDialog() {
  pendingBackground = themeState.background;
  pendingDark = themeState.dark;
  darkThemeSwitch.checked = pendingDark;
  paletteEl.classList.toggle('disabled', pendingDark);
  updatePaletteSelection();
  themeDialogOverlay.hidden = false;
}
darkThemeSwitch.addEventListener('change', () => {
  pendingDark = darkThemeSwitch.checked;
  paletteEl.classList.toggle('disabled', pendingDark);
});
themeDialogOverlay.querySelector('[data-action="cancel-theme"]').addEventListener('click', () => {
  themeDialogOverlay.hidden = true;
});
themeDialogOverlay.querySelector('[data-action="confirm-theme"]').addEventListener('click', () => {
  themeState = { background: pendingBackground, dark: pendingDark };
  applyTheme();
  renderResults();
  themeDialogOverlay.hidden = true;
});

// ---------- Диалог "Формулы" ----------

const formulasDialogOverlay = document.getElementById('formulasDialogOverlay');
function bindFormulaToggle(id, key) {
  document.getElementById(id).addEventListener('change', (e) => {
    state.visibility[key] = e.target.checked;
    renderResults();
  });
}
bindFormulaToggle('toggleBmi', 'bmi');
bindFormulaToggle('toggleGfr', 'gfr');
bindFormulaToggle('toggleCrCl', 'crCl');
bindFormulaToggle('toggleGrace', 'grace');
bindFormulaToggle('toggleCrusade', 'crusade');
formulasDialogOverlay.querySelector('[data-action="close-formulas"]').addEventListener('click', () => {
  formulasDialogOverlay.hidden = true;
});

// ---------- Диалог "О программе" ----------

const aboutDialogOverlay = document.getElementById('aboutDialogOverlay');
aboutDialogOverlay.querySelector('[data-action="close-about"]').addEventListener('click', () => {
  aboutDialogOverlay.hidden = true;
});

// Клик по overlay (вне диалога) закрывает его
[themeDialogOverlay, formulasDialogOverlay, aboutDialogOverlay].forEach((overlay) => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.hidden = true;
  });
});

// ---------- Инициализация ----------

applyTheme();
renderResults();

// Регистрация service worker (офлайн-режим PWA), если доступно.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* необязательно */ });
  });
}
