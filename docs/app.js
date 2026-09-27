'use strict';
// Кардио-калькулятор — веб-версия (v3.0). Полностью переписана поверх v2.0 по
// свежему разбору текущего MainActivity.kt/Calculators.kt (321): добавлена вкладка
// "ФП" (CHA2DS2-VASc / HAS-BLED), новая система тем (наборы фон+акцент вместо
// одной палитры фона), обновлённое меню ("Поделиться"), подзаголовки-карточки в
// диалоге "Формулы". См. комментарии по ходу файла.

// ===================== Константы (порт из MainActivity.kt) =====================

// Фирменные цвета (ui/theme/Color.kt)
const CARDIO_PRIMARY = '#3A75C4';
const CARDIO_SURFACE = '#FFFFFF';
const CARDIO_ON_SURFACE = '#1B1B1B';
const CARDIO_DARK_BACKGROUND = '#1A1A1A';
const CARDIO_DARK_SURFACE = '#262626';
const CARDIO_DARK_ON_SURFACE = '#E8E8E8';
const CARDIO_DARK_ON_SURFACE_VARIANT = '#B0B0B0';
const CARDIO_DARK_PRIMARY = '#6FA8DC';
const CARDIO_DARK_OUTLINE = '#4A4A4A';
// Material3 baseline "outline" по умолчанию — используется светлой темой приложения,
// т.к. LightAppColorScheme его не переопределяет (Theme.kt).
const M3_LIGHT_OUTLINE = '#79747E';
// Светлая тема НЕ переопределяет onSurfaceVariant отдельным приглушённым тоном —
// Theme.kt явно задаёт onSurfaceVariant = CardioOnSurface (тот же #1B1B1B, что и onSurface).

// Сдвиг яркости верхней полосы/полосы "Результаты"/вкладок в тёмной теме.
const DARK_THEME_ACCENT_TONE_ADJUST = -0.3;
// Степень затенения переключателя "Пол", когда он не нужен (MaybeUnneededField).
const UNNEEDED_SHADE_ALPHA = 0.85;
// Заливка между шапкой и кнопками-вкладками (headerFillOpacity, зафиксировано после
// калибровки — пункт меню на Android убран, значение больше не настраивается).
const HEADER_FILL_OPACITY = 0.3113;
// Прозрачность заливки/обводки неактивной вкладки (inactiveButtonFillOpacity/
// inactiveButtonBorderOpacity, тоже зафиксированы после калибровки).
const TAB_INACTIVE_FILL_OPACITY = 0.5691;
const TAB_INACTIVE_BORDER_OPACITY = 0.96;

// ===================== Наборы тем (порт ThemeEntry + forced-defaults v4) =====================
// Каждая тема — пара (цвет фона, цвет акцента). Раньше акцент всегда вычислялся из
// фона по формуле; сейчас (после редактора тем) оба цвета хранятся отдельно и
// заданы напрямую — те же 7 наборов, что зафиксированы как дефолт на Android
// (performSettingsSnapshotRestoreIfNeeded, версия 4).
const DEFAULT_LIGHT_THEMES = [
  { id: 0, bg: '#EAC8B7', accent: '#CB834B' },
  { id: 4, bg: '#CEF1D3', accent: '#227628' },
  { id: 5, bg: '#D4F2E8', accent: '#2E9D78' },
  { id: 6, bg: '#CDDCF0', accent: '#2E5E9D' },
  { id: 7, bg: '#C6CDEE', accent: '#2B4493' },
  { id: 8, bg: '#E2CEF1', accent: '#5F288A' },
  { id: 9, bg: '#F0CADD', accent: '#A7306C' }
];
const DEFAULT_DARK_THEMES = [
  { id: 0, bg: '#190C07', accent: '#BD5B37' },
  { id: 1, bg: '#241A0A', accent: '#B36C34' },
  { id: 5, bg: '#081D16', accent: '#30A47D' },
  { id: 6, bg: '#0B1525', accent: '#376FBD' },
  { id: 8, bg: '#1D0C29', accent: '#8A41C8' },
  { id: 9, bg: '#1F0914', accent: '#C63A85' },
  { id: 10, bg: '#1F090F', accent: '#B6354E' }
];
const DEFAULT_SELECTED_LIGHT_ID = 6;
const DEFAULT_SELECTED_DARK_ID = 6;

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
// Новый ключ (v3) — старые сохранения формата v2 (одна палитра фона) сознательно
// игнорируются, аналогично "forced one-time migration" на Android.
const THEME_STORAGE_KEY = 'cardio_theme_prefs_v3';

function loadThemePrefs() {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        isDarkTheme: !!parsed.isDarkTheme,
        lightThemes: Array.isArray(parsed.lightThemes) && parsed.lightThemes.length ? parsed.lightThemes : DEFAULT_LIGHT_THEMES,
        darkThemes: Array.isArray(parsed.darkThemes) && parsed.darkThemes.length ? parsed.darkThemes : DEFAULT_DARK_THEMES,
        selectedLightId: typeof parsed.selectedLightId === 'number' ? parsed.selectedLightId : DEFAULT_SELECTED_LIGHT_ID,
        selectedDarkId: typeof parsed.selectedDarkId === 'number' ? parsed.selectedDarkId : DEFAULT_SELECTED_DARK_ID
      };
    }
  } catch (e) { /* localStorage недоступен — используем значения по умолчанию */ }
  return {
    isDarkTheme: false,
    lightThemes: DEFAULT_LIGHT_THEMES,
    darkThemes: DEFAULT_DARK_THEMES,
    selectedLightId: DEFAULT_SELECTED_LIGHT_ID,
    selectedDarkId: DEFAULT_SELECTED_DARK_ID
  };
}
function saveThemePrefs() {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({
      isDarkTheme, lightThemes, darkThemes, selectedLightId, selectedDarkId
    }));
  } catch (e) { /* сохранение — best effort, как и на Android */ }
}

const themePrefs = loadThemePrefs();
let isDarkTheme = themePrefs.isDarkTheme;
let lightThemes = themePrefs.lightThemes;
let darkThemes = themePrefs.darkThemes;
let selectedLightId = themePrefs.selectedLightId;
let selectedDarkId = themePrefs.selectedDarkId;

function findTheme(list, id) {
  return list.find((t) => t.id === id) || list[0];
}

// ===================== Состояние приложения =====================
// Поля пациента/формулы-переключатели на Android хранятся только через
// rememberSaveable (без SharedPreferences) — переживают поворот экрана, но НЕ
// полный перезапуск приложения. Перезагрузка страницы — ближайший веб-аналог
// полного перезапуска, поэтому это состояние намеренно НЕ сохраняется в localStorage.
const state = {
  activeTab: 'oks', // 'oks' | 'afib'
  sex: null, // null | 'MALE' | 'FEMALE'
  age: '', height: '', weight: '', creatinine: '', heartRate: '', sbp: '', hematocrit: '',
  cardiacArrest: false, stDeviation: false, elevatedEnzymes: false,
  killip: 'I',
  signsOfChf: false, vascularDisease: false, strokeHistory: false, diabetes: false,
  hypertension: false, renalImpairment: false, hepaticImpairment: false,
  bleedingHistory: false, labileInr: false, antiplateletOrNsaid: false, alcoholUse: false,
  showBmi: true, showGfr: true, showCrCl: true, showGrace: true, showCrusade: true,
  showChadsVasc: true, showHasBled: true
};

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
  menuButton: $('menuButton'),
  menuDropdown: $('menuDropdown'),
  tabOks: $('tabOks'), tabAfib: $('tabAfib'),
  tabOksLabel: $('tabOksLabel'), tabAfibLabel: $('tabAfibLabel'),
  pageOks: $('pageOks'), pageAfib: $('pageAfib'),

  // ---- ОКС ----
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
  vascularDiseaseInput: $('vascularDiseaseInput'),
  strokeHistoryInput: $('strokeHistoryInput'),
  diabetesInput: $('diabetesInput'),
  crusadeChecks: $('crusadeChecks'),
  bmiBlock: $('bmiBlock'), bmiValue: $('bmiValue'), bmiComments: $('bmiComments'),
  gfrBlock: $('gfrBlock'), gfrValue: $('gfrValue'), gfrComments: $('gfrComments'),
  crclBlock: $('crclBlock'), crclValue: $('crclValue'), crclComments: $('crclComments'),
  graceBlock: $('graceBlock'), graceValue: $('graceValue'), graceComments: $('graceComments'),
  crusadeBlock: $('crusadeBlock'), crusadeValue: $('crusadeValue'), crusadeComments: $('crusadeComments'),

  // ---- ФП ----
  afibPatientBlock: $('afibPatientBlock'),
  afibClinicalBlock: $('afibClinicalBlock'),
  afibAgeSexRow: $('afibAgeSexRow'),
  afibSbpRow: $('afibSbpRow'),
  afibAgeFieldWrap: $('afibAgeFieldWrap'), afibAgeInput: $('afibAgeInput'),
  afibSbpFieldWrap: $('afibSbpFieldWrap'), afibSbpInput: $('afibSbpInput'),
  afibSexToggle: $('afibSexToggle'),
  afibSexMale: $('afibSexMale'), afibSexMaleIcon: $('afibSexMaleIcon'),
  afibSexFemale: $('afibSexFemale'), afibSexFemaleIcon: $('afibSexFemaleIcon'),
  chadsVascChecks: $('chadsVascChecks'),
  afibSignsOfChfInput: $('afibSignsOfChfInput'),
  hypertensionInput: $('hypertensionInput'),
  afibVascularDiseaseInput: $('afibVascularDiseaseInput'),
  afibStrokeHistoryInput: $('afibStrokeHistoryInput'),
  afibDiabetesInput: $('afibDiabetesInput'),
  hasBledChecks: $('hasBledChecks'),
  renalImpairmentInput: $('renalImpairmentInput'),
  hepaticImpairmentInput: $('hepaticImpairmentInput'),
  bleedingHistoryInput: $('bleedingHistoryInput'),
  labileInrInput: $('labileInrInput'),
  antiplateletOrNsaidInput: $('antiplateletOrNsaidInput'),
  alcoholUseInput: $('alcoholUseInput'),
  chadsVascBlock: $('chadsVascBlock'), chadsVascValue: $('chadsVascValue'), chadsVascComments: $('chadsVascComments'),
  hasBledBlock: $('hasBledBlock'), hasBledValue: $('hasBledValue'), hasBledComments: $('hasBledComments'),

  // ---- Диалоги ----
  themeDialogOverlay: $('themeDialogOverlay'),
  darkThemeSwitch: $('darkThemeSwitch'),
  palette: $('palette'),
  formulasDialogOverlay: $('formulasDialogOverlay'),
  toggleBmi: $('toggleBmi'), toggleGfr: $('toggleGfr'), toggleCrCl: $('toggleCrCl'),
  toggleGrace: $('toggleGrace'), toggleCrusade: $('toggleCrusade'),
  toggleChadsVasc: $('toggleChadsVasc'), toggleHasBled: $('toggleHasBled'),
  aboutDialogOverlay: $('aboutDialogOverlay')
};

// ===================== Расчёт "нужности" полей (порт needs-флагов из CardioScreen) =====================
function needsFlags() {
  const ageNeededOks = state.showGfr || state.showCrCl || state.showGrace || state.showCrusade;
  const sexNeededOks = state.showGfr || state.showCrCl || state.showCrusade;
  const sbpNeededOks = state.showGrace || state.showCrusade;
  const heightNeeded = state.showBmi;
  const weightNeeded = state.showBmi || state.showCrCl || state.showCrusade;
  const creatinineNeeded = state.showGfr || state.showCrCl || state.showGrace || state.showCrusade;
  const heartRateNeeded = state.showGrace || state.showCrusade;
  const hematocritNeeded = state.showCrusade;

  const ageNeededAfib = state.showChadsVasc;
  const sexNeededAfib = state.showChadsVasc;
  const sbpNeededAfib = state.showHasBled;

  const ageNeeded = ageNeededOks || ageNeededAfib;
  const sexNeeded = sexNeededOks || sexNeededAfib;
  const sbpNeeded = sbpNeededOks || sbpNeededAfib;

  const ageSexRowNeededOks = ageNeededOks || sexNeededOks;
  const heightWeightRowNeeded = heightNeeded || weightNeeded;
  const hrSbpRowNeeded = heartRateNeeded || sbpNeededOks;
  const creatinineHematocritRowNeeded = creatinineNeeded || hematocritNeeded;
  const patientBlockNeeded = ageSexRowNeededOks || heightWeightRowNeeded;
  const labBlockNeeded = hrSbpRowNeeded || creatinineHematocritRowNeeded;
  const clinicalSignsBlockNeeded = state.showGrace || state.showCrusade;
  let firstVisibleInputBlock = null;
  if (patientBlockNeeded) firstVisibleInputBlock = 'patient';
  else if (labBlockNeeded) firstVisibleInputBlock = 'lab';
  else if (state.showGrace) firstVisibleInputBlock = 'killip';
  else if (clinicalSignsBlockNeeded) firstVisibleInputBlock = 'clinical';

  const ageSexRowNeededAfib = ageNeededAfib || sexNeededAfib;
  const sbpRowNeededAfib = sbpNeededAfib;
  const afibPatientBlockNeeded = ageSexRowNeededAfib || sbpRowNeededAfib;
  const afibClinicalBlockNeeded = state.showChadsVasc || state.showHasBled;
  let firstVisibleAfibInputBlock = null;
  if (afibPatientBlockNeeded) firstVisibleAfibInputBlock = 'afibPatient';
  else if (afibClinicalBlockNeeded) firstVisibleAfibInputBlock = 'afibClinical';

  return {
    ageNeededOks, sexNeededOks, sbpNeededOks, heightNeeded, weightNeeded, creatinineNeeded, heartRateNeeded, hematocritNeeded,
    ageNeededAfib, sexNeededAfib, sbpNeededAfib,
    ageNeeded, sexNeeded, sbpNeeded,
    ageSexRowNeededOks, heightWeightRowNeeded, hrSbpRowNeeded, creatinineHematocritRowNeeded,
    patientBlockNeeded, labBlockNeeded, clinicalSignsBlockNeeded, firstVisibleInputBlock,
    ageSexRowNeededAfib, sbpRowNeededAfib, afibPatientBlockNeeded, afibClinicalBlockNeeded, firstVisibleAfibInputBlock
  };
}

// Обнуление данных при переходе поля/пункта в "не нужно" — вызывается ПОСЛЕ
// пересчёта needs, если какой-то флаг стал false (порт LaunchedEffect-блоков).
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
  if (!state.showCrusade && !state.showChadsVasc) {
    state.signsOfChf = false; state.vascularDisease = false; state.strokeHistory = false; state.diabetes = false;
  }
  if (!state.showChadsVasc) state.hypertension = false;
  if (!state.showHasBled) {
    state.renalImpairment = false; state.hepaticImpairment = false; state.bleedingHistory = false;
    state.labileInr = false; state.antiplateletOrNsaid = false; state.alcoholUse = false;
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

// ===================== Рендер =====================
function render() {
  const n = needsFlags();
  applyAutoReset(n);

  // ---- Тема/цвета ----
  const selectedTheme = isDarkTheme ? findTheme(darkThemes, selectedDarkId) : findTheme(lightThemes, selectedLightId);
  const effectiveBackground = selectedTheme.bg;
  const accentColor = selectedTheme.accent;
  const topBarColor = isDarkTheme ? adjustLightness(accentColor, DARK_THEME_ACCENT_TONE_ADJUST) : accentColor;
  const surface = isDarkTheme ? CARDIO_DARK_SURFACE : CARDIO_SURFACE;
  const onSurface = isDarkTheme ? CARDIO_DARK_ON_SURFACE : CARDIO_ON_SURFACE;
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
  root.setProperty('--primary', isDarkTheme ? CARDIO_DARK_PRIMARY : CARDIO_PRIMARY);
  root.setProperty('--unneeded-tint', overAlpha(onSurface, 0.10, surface));
  root.setProperty('--unneeded-outline', overAlpha(outline, 0.5, surface));
  root.setProperty('--unneeded-label', overAlpha(onSurfaceVariant, 0.5, surface));
  root.setProperty('--unneeded-text', overAlpha(onSurfaceVariant, 0.5, surface));
  root.setProperty('--sex-unneeded-shade', overAlpha(surface, UNNEEDED_SHADE_ALPHA, surface));
  // Заливка между шапкой и вкладками — topBarColor поверх страницы (эффект наложения слоя).
  root.setProperty('--header-fill', overAlpha(topBarColor, HEADER_FILL_OPACITY, effectiveBackground));
  // Неактивная вкладка — полупрозрачная заливка/обводка topBarColor поверх страницы.
  root.setProperty('--tab-inactive-bg', overAlpha(topBarColor, TAB_INACTIVE_FILL_OPACITY, effectiveBackground));
  root.setProperty('--tab-inactive-border', overAlpha(topBarColor, TAB_INACTIVE_BORDER_OPACITY, effectiveBackground));
  document.body.style.background = effectiveBackground;

  // ---- Вкладки ----
  const onOks = state.activeTab === 'oks';
  el.tabOks.classList.toggle('active', onOks);
  el.tabOks.classList.toggle('inactive', !onOks);
  el.tabAfib.classList.toggle('active', !onOks);
  el.tabAfib.classList.toggle('inactive', onOks);
  el.pageOks.hidden = !onOks;
  el.pageAfib.hidden = onOks;

  // ==================== Страница "ОКС" ====================
  el.patientBlock.hidden = !n.patientBlockNeeded;
  el.labBlock.hidden = !n.labBlockNeeded;
  el.killipBlock.hidden = !state.showGrace;
  el.clinicalBlock.hidden = !n.clinicalSignsBlockNeeded;

  el.ageSexRow.hidden = !n.ageSexRowNeededOks;
  el.heightWeightRow.hidden = !n.heightWeightRowNeeded;
  el.hrSbpRow.hidden = !n.hrSbpRowNeeded;
  el.creatHematRow.hidden = !n.creatinineHematocritRowNeeded;

  el.graceChecks.hidden = !state.showGrace;
  el.crusadeChecks.hidden = !state.showCrusade;

  const headerOfOks = {
    patient: el.patientBlock.querySelector('.subsection-header'),
    lab: el.labBlock.querySelector('.subsection-header'),
    killip: el.killipBlock.querySelector('.subsection-header'),
    clinical: el.clinicalBlock.querySelector('.subsection-header')
  };
  Object.entries(headerOfOks).forEach(([key, headerEl]) => {
    headerEl.classList.toggle('rounded-top', n.firstVisibleInputBlock === key);
  });

  el.ageFieldWrap.classList.toggle('unneeded', !n.ageNeededOks);
  el.heightFieldWrap.classList.toggle('unneeded', !n.heightNeeded);
  el.weightFieldWrap.classList.toggle('unneeded', !n.weightNeeded);
  el.hrFieldWrap.classList.toggle('unneeded', !n.heartRateNeeded);
  el.sbpFieldWrap.classList.toggle('unneeded', !n.sbpNeededOks);
  el.creatinineFieldWrap.classList.toggle('unneeded', !n.creatinineNeeded);
  el.hematocritFieldWrap.classList.toggle('unneeded', !n.hematocritNeeded);

  setUnneededInput(el.ageInput, n.ageNeededOks, state.age);
  setUnneededInput(el.heightInput, n.heightNeeded, state.height);
  setUnneededInput(el.weightInput, n.weightNeeded, state.weight);
  setUnneededInput(el.hrInput, n.heartRateNeeded, state.heartRate);
  setUnneededInput(el.sbpInput, n.sbpNeededOks, state.sbp);
  setUnneededInput(el.creatinineInput, n.creatinineNeeded, state.creatinine);
  setUnneededInput(el.hematocritInput, n.hematocritNeeded, state.hematocrit);

  el.sexToggle.classList.toggle('unneeded', !n.sexNeededOks);
  const maleSelectedOks = n.sexNeededOks && state.sex === 'MALE';
  const femaleSelectedOks = n.sexNeededOks && state.sex === 'FEMALE';
  el.sexMaleIcon.src = `icons/sex/ic_sex_male_${maleSelectedOks ? 'active' : 'inactive'}${isDarkTheme ? '_dark' : ''}.png`;
  el.sexFemaleIcon.src = `icons/sex/ic_sex_female_${femaleSelectedOks ? 'active' : 'inactive'}${isDarkTheme ? '_dark' : ''}.png`;

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

  el.cardiacArrestInput.checked = state.cardiacArrest;
  el.stDeviationInput.checked = state.stDeviation;
  el.elevatedEnzymesInput.checked = state.elevatedEnzymes;
  el.signsOfChfInput.checked = state.signsOfChf;
  el.vascularDiseaseInput.checked = state.vascularDisease;
  el.strokeHistoryInput.checked = state.strokeHistory;
  el.diabetesInput.checked = state.diabetes;

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
          signsOfChf: state.signsOfChf, priorVascularDisease: state.vascularDisease || state.strokeHistory,
          diabetes: state.diabetes, sbp
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

  // ==================== Страница "ФП" ====================
  el.afibPatientBlock.hidden = !n.afibPatientBlockNeeded;
  el.afibClinicalBlock.hidden = !n.afibClinicalBlockNeeded;
  el.afibAgeSexRow.hidden = !n.ageSexRowNeededAfib;
  el.afibSbpRow.hidden = !n.sbpRowNeededAfib;
  el.chadsVascChecks.hidden = !state.showChadsVasc;
  el.hasBledChecks.hidden = !state.showHasBled;

  const headerOfAfib = {
    afibPatient: el.afibPatientBlock.querySelector('.subsection-header'),
    afibClinical: el.afibClinicalBlock.querySelector('.subsection-header')
  };
  Object.entries(headerOfAfib).forEach(([key, headerEl]) => {
    headerEl.classList.toggle('rounded-top', n.firstVisibleAfibInputBlock === key);
  });

  el.afibAgeFieldWrap.classList.toggle('unneeded', !n.ageNeededAfib);
  el.afibSbpFieldWrap.classList.toggle('unneeded', !n.sbpNeededAfib);
  setUnneededInput(el.afibAgeInput, n.ageNeededAfib, state.age);
  setUnneededInput(el.afibSbpInput, n.sbpNeededAfib, state.sbp);

  el.afibSexToggle.classList.toggle('unneeded', !n.sexNeededAfib);
  const maleSelectedAfib = n.sexNeededAfib && state.sex === 'MALE';
  const femaleSelectedAfib = n.sexNeededAfib && state.sex === 'FEMALE';
  el.afibSexMaleIcon.src = `icons/sex/ic_sex_male_${maleSelectedAfib ? 'active' : 'inactive'}${isDarkTheme ? '_dark' : ''}.png`;
  el.afibSexFemaleIcon.src = `icons/sex/ic_sex_female_${femaleSelectedAfib ? 'active' : 'inactive'}${isDarkTheme ? '_dark' : ''}.png`;

  el.afibSignsOfChfInput.checked = state.signsOfChf;
  el.hypertensionInput.checked = state.hypertension;
  el.afibVascularDiseaseInput.checked = state.vascularDisease;
  el.afibStrokeHistoryInput.checked = state.strokeHistory;
  el.afibDiabetesInput.checked = state.diabetes;
  el.renalImpairmentInput.checked = state.renalImpairment;
  el.hepaticImpairmentInput.checked = state.hepaticImpairment;
  el.bleedingHistoryInput.checked = state.bleedingHistory;
  el.labileInrInput.checked = state.labileInr;
  el.antiplateletOrNsaidInput.checked = state.antiplateletOrNsaid;
  el.alcoholUseInput.checked = state.alcoholUse;

  el.chadsVascBlock.hidden = !state.showChadsVasc;
  el.hasBledBlock.hidden = !state.showHasBled;

  if (state.showChadsVasc) {
    const chadsVascResult = (age != null && sex != null) ? cha2ds2VascScore({
      age, sex,
      chfOrLvDysfunction: state.signsOfChf, hypertension: state.hypertension, diabetes: state.diabetes,
      strokeOrTiaOrThromboembolism: state.strokeHistory, vascularDisease: state.vascularDisease
    }) : null;
    el.chadsVascValue.textContent = chadsVascResult ? String(chadsVascResult.points) : '—';
    el.chadsVascComments.innerHTML = '';
    if (chadsVascResult) {
      addComment(el.chadsVascComments, '*Единицы измерения: баллы');
      addComment(el.chadsVascComments, `Рекомендация: ${chadsVascResult.interpretation}`);
    } else {
      addHint(el.chadsVascComments, 'возраст, пол');
    }
  }

  if (state.showHasBled) {
    const hasBledResult = (age != null && sbp != null) ? hasBledScore({
      uncontrolledHypertension: sbp > 160,
      renalImpairment: state.renalImpairment, hepaticImpairment: state.hepaticImpairment,
      strokeHistory: state.strokeHistory, bleedingHistory: state.bleedingHistory, labileInr: state.labileInr,
      elderly: age > 65, antiplateletOrNsaid: state.antiplateletOrNsaid, alcoholUse: state.alcoholUse
    }) : null;
    el.hasBledValue.textContent = hasBledResult ? String(hasBledResult.points) : '—';
    el.hasBledComments.innerHTML = '';
    if (hasBledResult) {
      addComment(el.hasBledComments, '*Единицы измерения: баллы');
      addComment(el.hasBledComments, `Категория риска: ${hasBledResult.riskCategory}`);
    } else {
      addHint(el.hasBledComments, 'возраст, АД сист.');
    }
  }

  saveThemePrefs();
}

// ===================== Обработчики ввода (страница "ОКС") =====================
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
// Возраст и АД сист. — общие поля с вкладкой "ФП", держим оба input в синхроне.
bindTextInput(el.afibAgeInput, 'age');
bindTextInput(el.afibSbpInput, 'sbp');

function setSex(value) {
  if (!needsFlags().sexNeeded) return;
  state.sex = value;
  render();
}
el.sexMale.addEventListener('click', () => setSex('MALE'));
el.sexFemale.addEventListener('click', () => setSex('FEMALE'));
el.afibSexMale.addEventListener('click', () => setSex('MALE'));
el.afibSexFemale.addEventListener('click', () => setSex('FEMALE'));

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
bindCheckbox(el.vascularDiseaseInput, 'vascularDisease');
bindCheckbox(el.strokeHistoryInput, 'strokeHistory');
bindCheckbox(el.diabetesInput, 'diabetes');

// ===================== Обработчики ввода (страница "ФП") =====================
bindCheckbox(el.afibSignsOfChfInput, 'signsOfChf');
bindCheckbox(el.hypertensionInput, 'hypertension');
bindCheckbox(el.afibVascularDiseaseInput, 'vascularDisease');
bindCheckbox(el.afibStrokeHistoryInput, 'strokeHistory');
bindCheckbox(el.afibDiabetesInput, 'diabetes');
bindCheckbox(el.renalImpairmentInput, 'renalImpairment');
bindCheckbox(el.hepaticImpairmentInput, 'hepaticImpairment');
bindCheckbox(el.bleedingHistoryInput, 'bleedingHistory');
bindCheckbox(el.labileInrInput, 'labileInr');
bindCheckbox(el.antiplateletOrNsaidInput, 'antiplateletOrNsaid');
bindCheckbox(el.alcoholUseInput, 'alcoholUse');

// ---- Сброс данных пациента (кнопка в заголовке "Пациент", общая для обеих вкладок) ----
function resetAllPatientData() {
  state.age = ''; state.height = ''; state.weight = ''; state.sex = null;
  state.creatinine = ''; state.heartRate = ''; state.sbp = ''; state.hematocrit = '';
  state.cardiacArrest = false; state.stDeviation = false; state.elevatedEnzymes = false; state.killip = 'I';
  state.signsOfChf = false; state.vascularDisease = false; state.strokeHistory = false; state.diabetes = false;
  state.hypertension = false; state.renalImpairment = false; state.hepaticImpairment = false;
  state.bleedingHistory = false; state.labileInr = false; state.antiplateletOrNsaid = false; state.alcoholUse = false;
  render();
}
document.querySelectorAll('.reset-btn').forEach((btn) => btn.addEventListener('click', resetAllPatientData));

// ===================== Переключатель вкладок "ОКС"/"ФП" =====================
function setActiveTab(tab) {
  if (state.activeTab === tab) return;
  state.activeTab = tab;
  render();
}
el.tabOks.addEventListener('click', () => setActiveTab('oks'));
el.tabAfib.addEventListener('click', () => setActiveTab('afib'));

// Простой свайп по содержимому для переключения вкладок (аналог HorizontalPager).
(function enableSwipe() {
  const content = $('content');
  let startX = null, startY = null;
  content.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  content.addEventListener('touchend', (e) => {
    if (startX == null) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    startX = null; startY = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) setActiveTab('afib'); else setActiveTab('oks');
  }, { passive: true });
})();

// Авто-уменьшение шрифта подписи вкладки, если она не помещается (порт AutoShrinkButtonLabel).
function fitTabLabel(labelEl, baseSizePx, minSizePx) {
  let size = baseSizePx;
  labelEl.style.fontSize = size + 'px';
  const parent = labelEl.parentElement;
  const parentStyle = getComputedStyle(parent);
  const paddingX = parseFloat(parentStyle.paddingLeft) + parseFloat(parentStyle.paddingRight);
  const available = parent.clientWidth - paddingX;
  let guard = 0;
  while (labelEl.scrollWidth > available && size > minSizePx && guard < 40) {
    size -= 1;
    labelEl.style.fontSize = size + 'px';
    guard++;
  }
}
function fitAllTabLabels() {
  fitTabLabel(el.tabOksLabel, 16, 9);
  fitTabLabel(el.tabAfibLabel, 16, 9);
}
window.addEventListener('resize', fitAllTabLabels);

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
    else if (action === 'share') shareApp();
  });
});

// ===================== "Поделиться" (аналог Intent.ACTION_SEND на Android) =====================
const SHARE_URL = 'https://www.rustore.ru/catalog/app/com.cardioacs.app';
function showToast(text) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = text;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 1800);
}
async function shareApp() {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Кардио-калькулятор', text: 'Кардио-калькулятор', url: SHARE_URL });
      return;
    } catch (e) { /* пользователь отменил — ничего не делаем */ return; }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      showToast('Ссылка скопирована');
      return;
    } catch (e) { /* переходим к запасному варианту ниже */ }
  }
  window.prompt('Скопируйте ссылку:', SHARE_URL);
}

// ===================== Диалог "Тема" =====================
// Выбор применяется только по нажатию "Готово" (без живого предпросмотра) —
// как и в текущей Android-версии (редактор тем недостижим из UI).
let pendingDark = isDarkTheme;
let pendingSelectedLightId = selectedLightId;
let pendingSelectedDarkId = selectedDarkId;

function currentPendingList() { return pendingDark ? darkThemes : lightThemes; }
function currentPendingSelectedId() { return pendingDark ? pendingSelectedDarkId : pendingSelectedLightId; }

function renderPalette() {
  el.palette.innerHTML = '';
  const list = currentPendingList();
  const selectedId = currentPendingSelectedId();
  list.forEach((entry) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch' + (entry.id === selectedId ? ' selected' : '');
    btn.style.background = entry.accent;
    btn.addEventListener('click', () => {
      if (pendingDark) pendingSelectedDarkId = entry.id; else pendingSelectedLightId = entry.id;
      renderPalette();
    });
    el.palette.appendChild(btn);
  });
}

function openThemeDialog() {
  pendingDark = isDarkTheme;
  pendingSelectedLightId = selectedLightId;
  pendingSelectedDarkId = selectedDarkId;
  el.darkThemeSwitch.checked = pendingDark;
  renderPalette();
  el.themeDialogOverlay.hidden = false;
}
el.darkThemeSwitch.addEventListener('change', () => {
  pendingDark = el.darkThemeSwitch.checked;
  renderPalette();
});
el.themeDialogOverlay.querySelector('[data-action="cancel-theme"]').addEventListener('click', () => {
  el.themeDialogOverlay.hidden = true;
});
el.themeDialogOverlay.querySelector('[data-action="confirm-theme"]').addEventListener('click', () => {
  isDarkTheme = pendingDark;
  selectedLightId = pendingSelectedLightId;
  selectedDarkId = pendingSelectedDarkId;
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
  el.toggleChadsVasc.checked = state.showChadsVasc;
  el.toggleHasBled.checked = state.showHasBled;
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
bindFormulaToggle(el.toggleChadsVasc, 'showChadsVasc');
bindFormulaToggle(el.toggleHasBled, 'showHasBled');
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
fitAllTabLabels();
