'use strict';
// Кардио-калькулятор ОКС — веб-версия (v2.0, "с нуля", версия Android как эталон).
// Логика построена по полному свежему разбору MainActivity.kt текущей (321) версии
// приложения: видимость полей, сохранение темы, цветовая математика акцента,
// переключатель пола (картинки) и т.д. — см. комментарии по ходу файла.

// ===================== Константы (порт из MainActivity.kt) =====================

// Фирменные цвета (ui/theme/Color.kt)
const CARDIO_PRIMARY = '#3A75C4';
const CARDIO_BACKGROUND = '#AECEF9';
const CARDIO_SURFACE = '#FFFFFF';
const CARDIO_ON_SURFACE = '#1B1B1B';
const CARDIO_DARK_BACKGROUND = '#1A1A1A';
const CARDIO_DARK_SURFACE = '#262626';
const CARDIO_DARK_ON_SURFACE = '#E8E8E8';
const CARDIO_DARK_ON_SURFACE_VARIANT = '#B0B0B0';
const CARDIO_DARK_PRIMARY = '#6FA8DC';
const CARDIO_DARK_ON_PRIMARY = '#0D1B2A';
const CARDIO_DARK_OUTLINE = '#4A4A4A';
// Material3 baseline "outline" по умолчанию — используется светлой темой приложения,
// т.к. LightAppColorScheme его не переопределяет (Theme.kt).
const M3_LIGHT_OUTLINE = '#79747E';
// Светлая тема НЕ переопределяет onSurfaceVariant отдельным приглушённым тоном —
// Theme.kt явно задаёт onSurfaceVariant = CardioOnSurface (тот же #1B1B1B, что и onSurface).

// Палитра фона, порядок радуги (11 цветов) — MainActivity.kt backgroundPalette.
const BACKGROUND_PALETTE = [
  '#FF7F50', // коралл
  '#FFF3E0', // светло-персиковый
  '#F3D117', // жёлтый
  '#AEEA00', // салатовый
  '#09AB18', // зелёный
  '#7FFFD4', // аквамарин
  '#AECEF9', // светло-голубой
  '#0728C5', // синий
  '#6803B7', // фиолетовый
  '#FF69B4', // розовый
  '#FCE4EC'  // светло-розовый
];

// Сдвиг яркости верхней полосы/полосы "Результаты" в тёмной теме (версия 17).
const DARK_THEME_ACCENT_TONE_ADJUST = -0.3;
// Степень затенения переключателя "Пол", когда он не нужен (версия 19): плашка —
// цвет surface поверх иконок, alpha 0.85 (MaybeUnneededField).
const UNNEEDED_SHADE_ALPHA = 0.85;

// ===================== Цветовая математика (порт HSV-функций) =====================

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16)
  };
}
function rgbToHex(r, g, b) {
  const c = (n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
// android.graphics.Color.colorToHSV — H в градусах [0,360), S,V в [0,1].
function rgbToHsv({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}
function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r1, g1, b1;
  if (h < 60) { r1 = c; g1 = x; b1 = 0; }
  else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
  else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
  else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}
// androidx.compose.ui.graphics.Color.luminance() — относительная яркость (WCAG).
function relativeLuminance({ r, g, b }) {
  const chan = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}
/** Контрастный (тёмный/светлый) цвет текста для заданного фона. */
function contrastingTextColor(bgHex) {
  return relativeLuminance(hexToRgb(bgHex)) > 0.5 ? '#1B1B1B' : '#FFFFFF';
}
/** Акцентный цвет заголовков, подобранный в тон выбранному фону (учитывает тёмную тему). */
function accentColorFor(bgHex, isDark) {
  const hsv = rgbToHsv(hexToRgb(bgHex));
  if (hsv.s < 0.08) {
    return isDark ? CARDIO_DARK_PRIMARY : CARDIO_PRIMARY;
  }
  const s = isDark ? 0.5 : 0.55;
  const v = isDark ? 0.7 : 0.55;
  const { r, g, b } = hsvToRgb(hsv.h, s, v);
  return rgbToHex(r, g, b);
}
/** Сдвигает яркость (V) цвета на delta, результат зажат в [0,1]. */
function adjustLightness(hex, delta) {
  if (delta === 0) return hex;
  const hsv = rgbToHsv(hexToRgb(hex));
  const v = Math.max(0, Math.min(1, hsv.v + delta));
  const { r, g, b } = hsvToRgb(hsv.h, hsv.s, v);
  return rgbToHex(r, g, b);
}
/** Накладывает alpha-цвет поверх base (оба — hex), имитируя Compose color.copy(alpha=a) на сплошной подложке. */
function overAlpha(hex, alpha, baseHex) {
  const a = hexToRgb(hex), b = hexToRgb(baseHex);
  const mix = (ca, cb) => ca * alpha + cb * (1 - alpha);
  return rgbToHex(mix(a.r, b.r), mix(a.g, b.g), mix(a.b, b.b));
}

// ===================== Сохранение темы (аналог SharedPreferences) =====================
const THEME_STORAGE_KEY = 'cardio_theme_prefs_v2';

function loadThemePrefs() {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        background: typeof parsed.background === 'string' ? parsed.background : CARDIO_BACKGROUND,
        darkTheme: !!parsed.darkTheme
      };
    }
  } catch (e) { /* localStorage недоступен — используем значения по умолчанию */ }
  return { background: CARDIO_BACKGROUND, darkTheme: false };
}
function saveThemePrefs(background, darkTheme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ background, darkTheme }));
  } catch (e) { /* сохранение — best effort, как и на Android */ }
}

// ===================== Состояние приложения =====================
// Формулы (showBmi..showCrusade) и все поля пациента на Android хранятся только через
// rememberSaveable (без SharedPreferences) — переживают поворот экрана, но НЕ полный
// перезапуск приложения. Перезагрузка страницы — ближайший веб-аналог полного
// перезапуска, поэтому это состояние намеренно НЕ сохраняется в localStorage.
const state = {
  sex: null, // null | 'MALE' | 'FEMALE' — изначально не выбран (версия 20)
  age: '', height: '', weight: '', creatinine: '', heartRate: '', sbp: '', hematocrit: '',
  cardiacArrest: false, stDeviation: false, elevatedEnzymes: false,
  killip: 'I',
  signsOfChf: false, priorVascularDisease: false, diabetes: false,
  showBmi: true, showGfr: true, showCrCl: true, showGrace: true, showCrusade: true
};
const themePrefs = loadThemePrefs();
let backgroundColor = themePrefs.background;
let isDarkTheme = themePrefs.darkTheme;

// ===================== Утилиты парсинга (аналог toDoubleOrNullSafe/toIntOrNullSafe) =====================
function toIntOrNull(s) {
  const t = (s || '').trim();
  if (t === '') return null;
  if (!/^-?\d+$/.test(t)) return null;
  return parseInt(t, 10);
}
function toDoubleOrNull(s) {
  const t = (s || '').trim().replace(',', '.');
  if (t === '' || isNaN(Number(t))) return null;
  return parseFloat(t);
}

// ===================== DOM refs =====================
const $ = (id) => document.getElementById(id);
const el = {
  app: $('app'),
  titleBar: $('titleBar'),
  menuButton: $('menuButton'),
  menuDropdown: $('menuDropdown'),
  resetPatientButton: $('resetPatientButton'),
  patientBlock: $('patientBlock'),
  labBlock: $('labBlock'),
  killipBlock: $('killipBlock'),
  clinicalBlock: $('clinicalBlock'),
  ageSexRow: $('ageSexRow'),
  heightWeightRow: $('heightWeightRow'),
  hrSbpRow: $('hrSbpRow'),
  creatHematRow: $('creatHematRow'),
  ageFieldWrap: $('ageFieldWrap'), ageInput: $('ageInput'),
  heightFieldWrap: $('heightFieldWrap'), heightInput: $('heightInput'),
  weightFieldWrap: $('weightFieldWrap'), weightInput: $('weightInput'),
  hrFieldWrap: $('hrFieldWrap'), hrInput: $('hrInput'),
  sbpFieldWrap: $('sbpFieldWrap'), sbpInput: $('sbpInput'),
  creatinineFieldWrap: $('creatinineFieldWrap'), creatinineInput: $('creatinineInput'),
  hematocritFieldWrap: $('hematocritFieldWrap'), hematocritInput: $('hematocritInput'),
  sexToggle: $('sexToggle'),
  sexMale: $('sexMale'), sexMaleIcon: $('sexMaleIcon'),
  sexFemale: $('sexFemale'), sexFemaleIcon: $('sexFemaleIcon'),
  killipSelect: $('killipSelect'),
  cardiacArrestInput: $('cardiacArrestInput'),
  stDeviationInput: $('stDeviationInput'),
  elevatedEnzymesInput: $('elevatedEnzymesInput'),
  graceChecks: $('graceChecks'),
  signsOfChfInput: $('signsOfChfInput'),
  priorVascularDiseaseInput: $('priorVascularDiseaseInput'),
  diabetesInput: $('diabetesInput'),
  crusadeChecks: $('crusadeChecks'),
  bmiBlock: $('bmiBlock'), bmiValue: $('bmiValue'), bmiComments: $('bmiComments'),
  gfrBlock: $('gfrBlock'), gfrValue: $('gfrValue'), gfrComments: $('gfrComments'),
  crclBlock: $('crclBlock'), crclValue: $('crclValue'), crclComments: $('crclComments'),
  graceBlock: $('graceBlock'), graceValue: $('graceValue'), graceComments: $('graceComments'),
  crusadeBlock: $('crusadeBlock'), crusadeValue: $('crusadeValue'), crusadeComments: $('crusadeComments'),
  themeDialogOverlay: $('themeDialogOverlay'),
  darkThemeSwitch: $('darkThemeSwitch'),
  palette: $('palette'),
  formulasDialogOverlay: $('formulasDialogOverlay'),
  toggleBmi: $('toggleBmi'), toggleGfr: $('toggleGfr'), toggleCrCl: $('toggleCrCl'),
  toggleGrace: $('toggleGrace'), toggleCrusade: $('toggleCrusade'),
  aboutDialogOverlay: $('aboutDialogOverlay')
};

// ===================== Палитра (диалог "Тема") =====================
function buildPalette() {
  el.palette.innerHTML = '';
  BACKGROUND_PALETTE.forEach((color) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch';
    btn.style.background = color;
    btn.dataset.color = color;
    btn.addEventListener('click', () => {
      pendingBackground = color;
      [...el.palette.children].forEach((c) => c.classList.toggle('selected', c.dataset.color === color));
    });
    el.palette.appendChild(btn);
  });
}
buildPalette();

// ===================== Рендер =====================
function needsFlags() {
  const ageNeeded = state.showGfr || state.showCrCl || state.showGrace || state.showCrusade;
  const heightNeeded = state.showBmi;
  const weightNeeded = state.showBmi || state.showCrCl || state.showCrusade;
  const sexNeeded = state.showGfr || state.showCrCl || state.showCrusade;
  const creatinineNeeded = state.showGfr || state.showCrCl || state.showGrace || state.showCrusade;
  const heartRateNeeded = state.showGrace || state.showCrusade;
  const sbpNeeded = state.showGrace || state.showCrusade;
  const hematocritNeeded = state.showCrusade;

  const ageSexRowNeeded = ageNeeded || sexNeeded;
  const heightWeightRowNeeded = heightNeeded || weightNeeded;
  const hrSbpRowNeeded = heartRateNeeded || sbpNeeded;
  const creatinineHematocritRowNeeded = creatinineNeeded || hematocritNeeded;

  const patientBlockNeeded = ageSexRowNeeded || heightWeightRowNeeded;
  const labBlockNeeded = hrSbpRowNeeded || creatinineHematocritRowNeeded;
  const clinicalSignsBlockNeeded = state.showGrace || state.showCrusade;

  let firstVisibleInputBlock = null;
  if (patientBlockNeeded) firstVisibleInputBlock = 'patient';
  else if (labBlockNeeded) firstVisibleInputBlock = 'lab';
  else if (state.showGrace) firstVisibleInputBlock = 'killip';
  else if (clinicalSignsBlockNeeded) firstVisibleInputBlock = 'clinical';

  return {
    ageNeeded, heightNeeded, weightNeeded, sexNeeded, creatinineNeeded, heartRateNeeded, sbpNeeded, hematocritNeeded,
    ageSexRowNeeded, heightWeightRowNeeded, hrSbpRowNeeded, creatinineHematocritRowNeeded,
    patientBlockNeeded, labBlockNeeded, clinicalSignsBlockNeeded, firstVisibleInputBlock
  };
}

// Обнуление данных при переходе поля/пункта в "не нужно" (версия 18, item 5) — вызывается
// ПОСЛЕ пересчёта needs, если какой-то флаг стал false.
let prevNeeds = null;
function applyAutoReset(n) {
  if (!n.ageNeeded) state.age = '';
  if (!n.heightNeeded) state.height = '';
  if (!n.weightNeeded) state.weight = '';
  if (!n.sexNeeded) state.sex = null;
  if (!n.creatinineNeeded) state.creatinine = '';
  if (!n.heartRateNeeded) state.heartRate = '';
  if (!n.sbpNeeded) state.sbp = '';
  if (!n.hematocritNeeded) state.hematocrit = '';
  if (!state.showGrace) {
    state.cardiacArrest = false; state.stDeviation = false; state.elevatedEnzymes = false; state.killip = 'I';
  }
  if (!state.showCrusade) {
    state.signsOfChf = false; state.priorVascularDisease = false; state.diabetes = false;
  }
}

function setUnneededInput(inputEl, needed, currentValue) {
  inputEl.classList.toggle('unneeded', !needed);
  inputEl.disabled = !needed;
  if (!needed) {
    inputEl.value = '';
    inputEl.placeholder = 'не требуется';
  } else {
    if (inputEl.value !== currentValue) inputEl.value = currentValue;
    inputEl.placeholder = '';
  }
}

function render() {
  const n = needsFlags();
  applyAutoReset(n);

  // ---- Тема/цвета ----
  const accentColor = accentColorFor(backgroundColor, isDarkTheme);
  const topBarColor = isDarkTheme ? adjustLightness(accentColor, DARK_THEME_ACCENT_TONE_ADJUST) : accentColor;
  const effectiveBackground = isDarkTheme ? CARDIO_DARK_BACKGROUND : backgroundColor;
  const surface = isDarkTheme ? CARDIO_DARK_SURFACE : CARDIO_SURFACE;
  const onSurface = isDarkTheme ? CARDIO_DARK_ON_SURFACE : CARDIO_ON_SURFACE;
  // Светлая тема: onSurfaceVariant = onSurface (Theme.kt не задаёт отдельный приглушённый тон).
  const onSurfaceVariant = isDarkTheme ? CARDIO_DARK_ON_SURFACE_VARIANT : CARDIO_ON_SURFACE;
  const outline = isDarkTheme ? CARDIO_DARK_OUTLINE : M3_LIGHT_OUTLINE;

  const root = document.documentElement.style;
  root.setProperty('--background', effectiveBackground);
  root.setProperty('--surface', surface);
  root.setProperty('--on-surface', onSurface);
  root.setProperty('--on-surface-variant', onSurfaceVariant);
  root.setProperty('--outline', outline);
  root.setProperty('--accent', accentColor);
  root.setProperty('--accent-topbar', topBarColor);
  root.setProperty('--on-accent-topbar', contrastingTextColor(topBarColor));
  // "primary" — фиксированный фирменный цвет (НЕ пересчитывается из палитры), см.
  // MaterialTheme.colorScheme.primary в Theme.kt: используется рамкой поля в фокусе,
  // чекбоксами, переключателями, выделением свотча палитры, текстом кнопок диалога.
  root.setProperty('--primary', isDarkTheme ? CARDIO_DARK_PRIMARY : CARDIO_PRIMARY);
  // "не требуется" — плашка/подпись/текст (см. NumberField в MainActivity.kt):
  // фон плашки — onSurface@10%, рамка — outline@50%, подпись и текст — onSurfaceVariant@50%.
  root.setProperty('--unneeded-tint', overAlpha(onSurface, 0.10, surface));
  root.setProperty('--unneeded-outline', overAlpha(outline, 0.5, surface));
  root.setProperty('--unneeded-label', overAlpha(onSurfaceVariant, 0.5, surface));
  root.setProperty('--unneeded-text', overAlpha(onSurfaceVariant, 0.5, surface));
  // Затенение переключателя "Пол", когда не нужен — surface@85% поверх иконок.
  root.setProperty('--sex-unneeded-shade', overAlpha(surface, UNNEEDED_SHADE_ALPHA, surface));
  document.body.style.background = effectiveBackground;

  // ---- Видимость блоков/строк ----
  el.patientBlock.hidden = !n.patientBlockNeeded;
  el.labBlock.hidden = !n.labBlockNeeded;
  el.killipBlock.hidden = !state.showGrace;
  el.clinicalBlock.hidden = !n.clinicalSignsBlockNeeded;

  el.ageSexRow.hidden = !n.ageSexRowNeeded;
  el.heightWeightRow.hidden = !n.heightWeightRowNeeded;
  el.hrSbpRow.hidden = !n.hrSbpRowNeeded;
  el.creatHematRow.hidden = !n.creatinineHematocritRowNeeded;

  el.graceChecks.hidden = !state.showGrace;
  el.crusadeChecks.hidden = !state.showCrusade;

  // Скруглённый верхний угол — у первого ВИДИМОГО блока ввода.
  const headerOf = {
    patient: el.patientBlock.querySelector('.subsection-header'),
    lab: el.labBlock.querySelector('.subsection-header'),
    killip: el.killipBlock.querySelector('.subsection-header'),
    clinical: el.clinicalBlock.querySelector('.subsection-header')
  };
  Object.entries(headerOf).forEach(([key, headerEl]) => {
    headerEl.classList.toggle('rounded-top', n.firstVisibleInputBlock === key);
  });

  // ---- Поля ввода: подписи (приглушение при !needed) + значения/disabled ----
  el.ageFieldWrap.classList.toggle('unneeded', !n.ageNeeded);
  el.heightFieldWrap.classList.toggle('unneeded', !n.heightNeeded);
  el.weightFieldWrap.classList.toggle('unneeded', !n.weightNeeded);
  el.hrFieldWrap.classList.toggle('unneeded', !n.heartRateNeeded);
  el.sbpFieldWrap.classList.toggle('unneeded', !n.sbpNeeded);
  el.creatinineFieldWrap.classList.toggle('unneeded', !n.creatinineNeeded);
  el.hematocritFieldWrap.classList.toggle('unneeded', !n.hematocritNeeded);

  setUnneededInput(el.ageInput, n.ageNeeded, state.age);
  setUnneededInput(el.heightInput, n.heightNeeded, state.height);
  setUnneededInput(el.weightInput, n.weightNeeded, state.weight);
  setUnneededInput(el.hrInput, n.heartRateNeeded, state.heartRate);
  setUnneededInput(el.sbpInput, n.sbpNeeded, state.sbp);
  setUnneededInput(el.creatinineInput, n.creatinineNeeded, state.creatinine);
  setUnneededInput(el.hematocritInput, n.hematocritNeeded, state.hematocrit);

  // ---- Переключатель "Пол" (картинки + затенение, версия 18-19) ----
  el.sexToggle.classList.toggle('unneeded', !n.sexNeeded);
  const maleSelected = n.sexNeeded && state.sex === 'MALE';
  const femaleSelected = n.sexNeeded && state.sex === 'FEMALE';
  el.sexMaleIcon.src = `icons/sex/ic_sex_male_${maleSelected ? 'active' : 'inactive'}${isDarkTheme ? '_dark' : ''}.png`;
  el.sexFemaleIcon.src = `icons/sex/ic_sex_female_${femaleSelected ? 'active' : 'inactive'}${isDarkTheme ? '_dark' : ''}.png`;

  // ---- Killip select ----
  if (el.killipSelect.dataset.built !== '1') {
    KillipOrder.forEach((key) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = Killip[key].label;
      el.killipSelect.appendChild(opt);
    });
    el.killipSelect.dataset.built = '1';
  }
  el.killipSelect.value = state.killip;

  // ---- Чекбоксы ----
  el.cardiacArrestInput.checked = state.cardiacArrest;
  el.stDeviationInput.checked = state.stDeviation;
  el.elevatedEnzymesInput.checked = state.elevatedEnzymes;
  el.signsOfChfInput.checked = state.signsOfChf;
  el.priorVascularDiseaseInput.checked = state.priorVascularDisease;
  el.diabetesInput.checked = state.diabetes;

  // ---- Результаты ----
  el.bmiBlock.hidden = !state.showBmi;
  el.gfrBlock.hidden = !state.showGfr;
  el.crclBlock.hidden = !state.showCrCl;
  el.graceBlock.hidden = !state.showGrace;
  el.crusadeBlock.hidden = !state.showCrusade;

  const age = toIntOrNull(state.age);
  const height = toDoubleOrNull(state.height);
  const weight = toDoubleOrNull(state.weight);
  const creatinine = toDoubleOrNull(state.creatinine);
  const heartRate = toIntOrNull(state.heartRate);
  const sbp = toIntOrNull(state.sbp);
  const hematocrit = toDoubleOrNull(state.hematocrit);
  const sex = state.sex;

  const creatinineClearance = (sex != null && age != null && weight != null && weight > 0 && creatinine != null && creatinine > 0)
    ? cockcroftGault(sex, age, weight, creatinine) : null;

  if (state.showBmi) {
    const bmi = (height != null && height > 0 && weight != null && weight > 0) ? calculateBmi(weight, height) : null;
    el.bmiValue.textContent = bmi ? bmi.value.toFixed(1) : '—';
    el.bmiComments.innerHTML = '';
    if (bmi) {
      addComment(el.bmiComments, '*Единицы измерения: кг/м²');
      addComment(el.bmiComments, `Категория: ${bmi.category}`);
    } else {
      addHint(el.bmiComments, 'рост, масса тела');
    }
  }

  if (state.showGfr) {
    const gfr = (sex != null && age != null && creatinine != null && creatinine > 0) ? ckdEpi2021(sex, age, creatinine) : null;
    el.gfrValue.textContent = gfr != null ? gfr.toFixed(1) : '—';
    el.gfrComments.innerHTML = '';
    if (gfr != null) {
      addComment(el.gfrComments, '*Единицы измерения: мл/мин/1.73м²');
      addComment(el.gfrComments, `Стадия ХБП: ${ckdStage(gfr)}`);
    } else {
      addHint(el.gfrComments, 'возраст, пол, креатинин');
    }
  }

  if (state.showCrCl) {
    const crCl = creatinineClearance;
    el.crclValue.textContent = crCl != null ? crCl.toFixed(1) : '—';
    el.crclComments.innerHTML = '';
    if (crCl != null) {
      addComment(el.crclComments, '*Единицы измерения: мл/мин');
      addComment(el.crclComments, `Стадия ХБП: ${ckdStage(crCl)}`);
    } else {
      addHint(el.crclComments, 'возраст, пол, масса тела, креатинин');
    }
  }

  if (state.showGrace) {
    const graceResult = (age != null && heartRate != null && sbp != null && creatinine != null && creatinine > 0)
      ? graceScore({
          age, heartRate, sbp, creatinineUmol: creatinine, killip: Killip[state.killip],
          cardiacArrestAtAdmission: state.cardiacArrest, stDeviation: state.stDeviation, elevatedEnzymes: state.elevatedEnzymes
        }) : null;
    el.graceValue.textContent = graceResult ? String(graceResult.points) : '—';
    el.graceComments.innerHTML = '';
    if (graceResult) {
      addComment(el.graceComments, '*Единицы измерения: баллы');
      addComment(el.graceComments, `Категория риска: ${graceResult.riskCategory}`);
      addComment(el.graceComments, `Тактика КАГ: ${graceResult.kagStrategy}, ${graceResult.kagTiming}`);
    } else {
      addHint(el.graceComments, 'возраст, ЧСС, АД сист., креатинин');
    }
  }

  if (state.showCrusade) {
    const crCl = creatinineClearance;
    const crusadeResult = (sex != null && hematocrit != null && crCl != null && heartRate != null && sbp != null)
      ? crusadeScore({
          hematocrit, creatinineClearance: crCl, heartRate, sex,
          signsOfChf: state.signsOfChf, priorVascularDisease: state.priorVascularDisease, diabetes: state.diabetes, sbp
        }) : null;
    el.crusadeValue.textContent = crusadeResult ? String(crusadeResult.points) : '—';
    el.crusadeComments.innerHTML = '';
    if (crusadeResult) {
      addComment(el.crusadeComments, '*Единицы измерения: баллы');
      addComment(el.crusadeComments, `Категория риска кровотечения: ${crusadeResult.riskCategory}`);
      addComment(el.crusadeComments, `Риск крупного кровотечения: ${crusadeResult.bleedingRiskPercent}`);
    } else {
      addHint(el.crusadeComments, 'гематокрит, ЧСС, АД сист. и данные для расчёта клиренса креатинина (возраст, пол, масса, креатинин)');
    }
  }

  saveThemePrefs(backgroundColor, isDarkTheme);
}

function addComment(container, text) {
  const p = document.createElement('p');
  p.className = 'result-comment';
  p.textContent = text;
  container.appendChild(p);
}
function addHint(container, fields) {
  const p = document.createElement('p');
  p.className = 'missing-hint';
  p.textContent = `Заполните: ${fields}`;
  container.appendChild(p);
}

// ===================== Обработчики ввода =====================
function bindTextInput(inputEl, stateKey) {
  inputEl.addEventListener('input', () => {
    state[stateKey] = inputEl.value;
    render();
  });
}
bindTextInput(el.ageInput, 'age');
bindTextInput(el.heightInput, 'height');
bindTextInput(el.weightInput, 'weight');
bindTextInput(el.hrInput, 'heartRate');
bindTextInput(el.sbpInput, 'sbp');
bindTextInput(el.creatinineInput, 'creatinine');
bindTextInput(el.hematocritInput, 'hematocrit');

el.sexMale.addEventListener('click', () => {
  if (!needsFlags().sexNeeded) return;
  state.sex = 'MALE';
  render();
});
el.sexFemale.addEventListener('click', () => {
  if (!needsFlags().sexNeeded) return;
  state.sex = 'FEMALE';
  render();
});

el.killipSelect.addEventListener('change', () => {
  state.killip = el.killipSelect.value;
  render();
});

function bindCheckbox(inputEl, stateKey) {
  inputEl.addEventListener('change', () => {
    state[stateKey] = inputEl.checked;
    render();
  });
}
bindCheckbox(el.cardiacArrestInput, 'cardiacArrest');
bindCheckbox(el.stDeviationInput, 'stDeviation');
bindCheckbox(el.elevatedEnzymesInput, 'elevatedEnzymes');
bindCheckbox(el.signsOfChfInput, 'signsOfChf');
bindCheckbox(el.priorVascularDiseaseInput, 'priorVascularDisease');
bindCheckbox(el.diabetesInput, 'diabetes');

// ---- Сброс данных пациента (кнопка в заголовке "Пациент") ----
el.resetPatientButton.addEventListener('click', () => {
  state.age = ''; state.height = ''; state.weight = ''; state.sex = null;
  state.creatinine = ''; state.heartRate = ''; state.sbp = ''; state.hematocrit = '';
  state.cardiacArrest = false; state.stDeviation = false; state.elevatedEnzymes = false; state.killip = 'I';
  state.signsOfChf = false; state.priorVascularDisease = false; state.diabetes = false;
  render();
});

// ===================== Меню (три черты) =====================
function closeMenu() {
  el.menuDropdown.hidden = true;
  el.menuButton.setAttribute('aria-expanded', 'false');
}
el.menuButton.addEventListener('click', (e) => {
  e.stopPropagation();
  const willOpen = el.menuDropdown.hidden;
  el.menuDropdown.hidden = !willOpen;
  el.menuButton.setAttribute('aria-expanded', String(willOpen));
});
document.addEventListener('click', (e) => {
  if (!el.menuDropdown.hidden && !el.menuDropdown.contains(e.target) && e.target !== el.menuButton) {
    closeMenu();
  }
});
el.menuDropdown.querySelectorAll('button[data-action]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    closeMenu();
    if (action === 'open-theme') openThemeDialog();
    else if (action === 'open-formulas') openFormulasDialog();
    else if (action === 'open-about') openAboutDialog();
  });
});

// ===================== Диалог "Тема" =====================
let pendingBackground = backgroundColor;
let pendingDark = isDarkTheme;
function openThemeDialog() {
  pendingBackground = backgroundColor;
  pendingDark = isDarkTheme;
  el.darkThemeSwitch.checked = pendingDark;
  [...el.palette.children].forEach((c) => c.classList.toggle('selected', c.dataset.color === pendingBackground));
  el.themeDialogOverlay.hidden = false;
}
el.darkThemeSwitch.addEventListener('change', () => { pendingDark = el.darkThemeSwitch.checked; });
el.themeDialogOverlay.querySelector('[data-action="cancel-theme"]').addEventListener('click', () => {
  el.themeDialogOverlay.hidden = true;
});
el.themeDialogOverlay.querySelector('[data-action="confirm-theme"]').addEventListener('click', () => {
  isDarkTheme = pendingDark;
  backgroundColor = pendingBackground;
  el.themeDialogOverlay.hidden = true;
  render();
});

// ===================== Диалог "Формулы" =====================
function openFormulasDialog() {
  el.toggleBmi.checked = state.showBmi;
  el.toggleGfr.checked = state.showGfr;
  el.toggleCrCl.checked = state.showCrCl;
  el.toggleGrace.checked = state.showGrace;
  el.toggleCrusade.checked = state.showCrusade;
  el.formulasDialogOverlay.hidden = false;
}
function bindFormulaToggle(inputEl, stateKey) {
  inputEl.addEventListener('change', () => {
    state[stateKey] = inputEl.checked;
    render();
  });
}
bindFormulaToggle(el.toggleBmi, 'showBmi');
bindFormulaToggle(el.toggleGfr, 'showGfr');
bindFormulaToggle(el.toggleCrCl, 'showCrCl');
bindFormulaToggle(el.toggleGrace, 'showGrace');
bindFormulaToggle(el.toggleCrusade, 'showCrusade');
el.formulasDialogOverlay.querySelector('[data-action="close-formulas"]').addEventListener('click', () => {
  el.formulasDialogOverlay.hidden = true;
});

// ===================== Диалог "О программе" =====================
function openAboutDialog() { el.aboutDialogOverlay.hidden = false; }
el.aboutDialogOverlay.querySelector('[data-action="close-about"]').addEventListener('click', () => {
  el.aboutDialogOverlay.hidden = true;
});

// ===================== Service worker (PWA) =====================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* офлайн-кеш необязателен */ });
  });
}

// ===================== Первый рендер =====================
render();
