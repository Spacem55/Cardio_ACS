// Чистая логика расчётов — прямой порт Calculators.kt (без UI-зависимостей).
// Формулы и таблицы баллов взяты из тех же публикаций, что и в Android-версии:
//  - CKD-EPI 2021 (без поправки на расу): Inker LA, et al. N Engl J Med. 2021.
//  - Кокрофт-Голт: Cockcroft DW, Gault MH. Nephron. 1976.
//  - Классификация ХБП (KDIGO 2012) по СКФ.
//  - GRACE (классическая 8-факторная шкала): Granger CB, et al. Arch Intern Med. 2003;
//    таймингы КАГ — ESC NSTE-ACS Guidelines 2020.
//  - CRUSADE: Subherwal S, et al. Circulation. 2009.

const Sex = { MALE: 'MALE', FEMALE: 'FEMALE' };

const Killip = {
  I: { key: 'I', label: 'I — без признаков СН', points: 0 },
  II: { key: 'II', label: 'II — влажные хрипы, S3', points: 20 },
  III: { key: 'III', label: 'III — отёк лёгких', points: 39 },
  IV: { key: 'IV', label: 'IV — кардиогенный шок', points: 59 },
};
const KillipOrder = [Killip.I, Killip.II, Killip.III, Killip.IV];

// ---------- СКФ: CKD-EPI 2021 (race-free) ----------

/** Возвращает СКФ в мл/мин/1.73м². creatinineUmol — креатинин в мкмоль/л. */
function ckdEpi2021(sex, age, creatinineUmol) {
  const scrMgDl = creatinineUmol / 88.4;
  const isFemale = sex === Sex.FEMALE;
  const kappa = isFemale ? 0.7 : 0.9;
  const alpha = isFemale ? -0.241 : -0.302;
  const sexFactor = isFemale ? 1.012 : 1.0;
  const minRatio = Math.min(scrMgDl / kappa, 1.0);
  const maxRatio = Math.max(scrMgDl / kappa, 1.0);
  const exponent = -1.200;
  return 142.0 *
    Math.pow(minRatio, alpha) *
    Math.pow(maxRatio, exponent) *
    Math.pow(0.9938, age) *
    sexFactor;
}

// ---------- Клиренс креатинина: формула Кокрофта-Голта ----------

/** Возвращает клиренс креатинина в мл/мин. weightKg — фактическая масса тела. */
function cockcroftGault(sex, age, weightKg, creatinineUmol) {
  const constant = sex === Sex.FEMALE ? 1.04 : 1.23;
  return ((140 - age) * weightKg * constant) / creatinineUmol;
}

/** Классификация стадии ХБП по величине СКФ/клиренса (KDIGO). */
function ckdStage(gfr) {
  if (gfr >= 90) return 'C1 (норма или повышена)';
  if (gfr >= 60) return 'C2 (незначительно снижена)';
  if (gfr >= 45) return 'C3a (умеренно снижена)';
  if (gfr >= 30) return 'C3b (существенно снижена)';
  if (gfr >= 15) return 'C4 (резко снижена)';
  return 'C5 (терминальная почечная недостаточность)';
}

// ---------- ИМТ ----------

/** heightCm — рост в см, weightKg — масса тела в кг. Возвращает {value, category}. */
function calculateBmi(weightKg, heightCm) {
  const heightM = heightCm / 100.0;
  const bmi = weightKg / (heightM * heightM);
  let category;
  if (bmi < 18.5) category = 'Дефицит массы тела';
  else if (bmi < 25.0) category = 'Норма';
  else if (bmi < 30.0) category = 'Избыточная масса тела';
  else if (bmi < 35.0) category = 'Ожирение I степени';
  else if (bmi < 40.0) category = 'Ожирение II степени';
  else category = 'Ожирение III степени';
  return { value: bmi, category };
}

// ---------- Шкала GRACE ----------

function graceAgePoints(age) {
  if (age < 30) return 0;
  if (age <= 39) return 8;
  if (age <= 49) return 25;
  if (age <= 59) return 41;
  if (age <= 69) return 58;
  if (age <= 79) return 75;
  if (age <= 89) return 91;
  return 100;
}

function graceHeartRatePoints(hr) {
  if (hr < 50) return 0;
  if (hr <= 69) return 3;
  if (hr <= 89) return 9;
  if (hr <= 109) return 15;
  if (hr <= 149) return 24;
  if (hr <= 199) return 38;
  return 46;
}

function graceSbpPoints(sbp) {
  if (sbp < 80) return 58;
  if (sbp <= 99) return 53;
  if (sbp <= 119) return 43;
  if (sbp <= 139) return 34;
  if (sbp <= 159) return 24;
  if (sbp <= 199) return 10;
  return 0;
}

function graceCreatininePoints(creatinineUmol) {
  const mgDl = creatinineUmol / 88.4;
  if (mgDl < 0.40) return 1;
  if (mgDl < 0.80) return 4;
  if (mgDl < 1.20) return 7;
  if (mgDl < 1.60) return 10;
  if (mgDl < 2.00) return 13;
  if (mgDl < 4.00) return 21;
  return 28;
}

/**
 * Возвращает {points, riskCategory, kagStrategy, kagTiming}.
 * killip — один из объектов Killip.*
 */
function graceScore({ age, heartRate, sbp, creatinineUmol, killip, cardiacArrestAtAdmission, stDeviation, elevatedEnzymes }) {
  const points = graceAgePoints(age) +
    graceHeartRatePoints(heartRate) +
    graceSbpPoints(sbp) +
    graceCreatininePoints(creatinineUmol) +
    killip.points +
    (cardiacArrestAtAdmission ? 39 : 0) +
    (stDeviation ? 28 : 0) +
    (elevatedEnzymes ? 14 : 0);

  let riskCategory, kagStrategy, kagTiming;
  if (points > 140) {
    riskCategory = 'Высокий риск';
    kagStrategy = 'Экстренная инвазивная стратегия';
    kagTiming = 'КАГ < 24 ч';
  } else if (points >= 109) {
    riskCategory = 'Промежуточный риск';
    kagStrategy = 'Ранняя инвазивная стратегия';
    kagTiming = 'КАГ < 72 ч';
  } else {
    riskCategory = 'Низкий риск';
    kagStrategy = 'Селективная инвазивная стратегия';
    kagTiming = 'по клиническим показаниям';
  }
  return { points, riskCategory, kagStrategy, kagTiming };
}

// ---------- Шкала CRUSADE ----------

function crusadeHematocritPoints(hct) {
  if (hct < 31.0) return 9;
  if (hct < 34.0) return 7;
  if (hct < 37.0) return 3;
  if (hct < 40.0) return 2;
  return 0;
}

function crusadeCrClPoints(crCl) {
  if (crCl <= 15.0) return 39;
  if (crCl <= 30.0) return 35;
  if (crCl <= 60.0) return 28;
  if (crCl <= 90.0) return 17;
  if (crCl <= 120.0) return 7;
  return 0;
}

function crusadeHeartRatePoints(hr) {
  if (hr <= 70) return 0;
  if (hr <= 80) return 1;
  if (hr <= 90) return 3;
  if (hr <= 100) return 6;
  if (hr <= 110) return 8;
  if (hr <= 120) return 10;
  return 11;
}

function crusadeSbpPoints(sbp) {
  if (sbp <= 90) return 10;
  if (sbp <= 100) return 8;
  if (sbp <= 120) return 5;
  if (sbp <= 180) return 1;
  if (sbp <= 200) return 3;
  return 5;
}

/** Возвращает {points, riskCategory, bleedingRiskPercent}. */
function crusadeScore({ hematocrit, creatinineClearance, heartRate, sex, signsOfChf, priorVascularDisease, diabetes, sbp }) {
  const points = crusadeHematocritPoints(hematocrit) +
    crusadeCrClPoints(creatinineClearance) +
    crusadeHeartRatePoints(heartRate) +
    (sex === Sex.FEMALE ? 8 : 0) +
    (signsOfChf ? 7 : 0) +
    (priorVascularDisease ? 6 : 0) +
    (diabetes ? 6 : 0) +
    crusadeSbpPoints(sbp);

  let riskCategory, bleedingRiskPercent;
  if (points <= 20) { riskCategory = 'Очень низкий'; bleedingRiskPercent = '≈ 3.1%'; }
  else if (points <= 30) { riskCategory = 'Низкий'; bleedingRiskPercent = '≈ 5.5%'; }
  else if (points <= 40) { riskCategory = 'Умеренный'; bleedingRiskPercent = '≈ 8.6%'; }
  else if (points <= 50) { riskCategory = 'Высокий'; bleedingRiskPercent = '≈ 11.9%'; }
  else { riskCategory = 'Очень высокий'; bleedingRiskPercent = '≈ 19.5%'; }
  return { points, riskCategory, bleedingRiskPercent };
}
