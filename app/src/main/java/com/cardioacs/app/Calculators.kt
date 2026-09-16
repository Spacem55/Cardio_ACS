package com.cardioacs.app

import kotlin.math.pow

/**
 * Чистая (без зависимостей от Android) логика расчётов.
 * Все формулы и таблицы баллов взяты из оригинальных публикаций:
 *  - CKD-EPI 2021 (без поправки на расу): Inker LA, et al. N Engl J Med. 2021.
 *  - Кокрофт-Голт: Cockcroft DW, Gault MH. Nephron. 1976.
 *  - Классификация ХБП (KDIGO 2012) по СКФ.
 *  - GRACE (классическая 8-факторная шкала внутригоспитальной летальности):
 *    Granger CB, et al. Arch Intern Med. 2003; таймингы КАГ — ESC NSTE-ACS Guidelines 2020.
 *  - CRUSADE: Subherwal S, et al. Circulation. 2009.
 */

enum class Sex { MALE, FEMALE }

enum class Killip(val label: String, val points: Int) {
    I("I — без признаков СН", 0),
    II("II — влажные хрипы, ритм галопа (S3)", 20),
    III("III — отёк лёгких", 39),
    IV("IV — кардиогенный шок", 59)
}

// ---------- СКФ: CKD-EPI 2021 (race-free) ----------

/** Возвращает СКФ в мл/мин/1.73м². creatinineUmol — креатинин в мкмоль/л. */
fun ckdEpi2021(sex: Sex, age: Int, creatinineUmol: Double): Double {
    val scrMgDl = creatinineUmol / 88.4
    val (kappa, alpha, sexFactor) = if (sex == Sex.FEMALE) {
        Triple(0.7, -0.241, 1.012)
    } else {
        Triple(0.9, -0.302, 1.0)
    }
    val minRatio = minOf(scrMgDl / kappa, 1.0)
    val maxRatio = maxOf(scrMgDl / kappa, 1.0)
    val exponent = if (sex == Sex.FEMALE) -1.200 else -1.200
    return 142.0 *
        minRatio.pow(alpha) *
        maxRatio.pow(exponent) *
        0.9938.pow(age.toDouble()) *
        sexFactor
}

// ---------- Клиренс креатинина: формула Кокрофта-Голта ----------

/** Возвращает клиренс креатинина в мл/мин. weightKg — фактическая масса тела. */
fun cockcroftGault(sex: Sex, age: Int, weightKg: Double, creatinineUmol: Double): Double {
    val constant = if (sex == Sex.FEMALE) 1.04 else 1.23
    return ((140 - age) * weightKg * constant) / creatinineUmol
}

/** Классификация стадии ХБП по величине СКФ/клиренса (KDIGO). */
fun ckdStage(gfr: Double): String = when {
    gfr >= 90 -> "C1 (норма или повышена)"
    gfr >= 60 -> "C2 (незначительно снижена)"
    gfr >= 45 -> "C3a (умеренно снижена)"
    gfr >= 30 -> "C3b (существенно снижена)"
    gfr >= 15 -> "C4 (резко снижена)"
    else -> "C5 (терминальная почечная недостаточность)"
}

// ---------- ИМТ (индекс массы тела) ----------

data class BmiResult(
    val value: Double,
    val category: String
)

/** heightCm — рост в см, weightKg — масса тела в кг. */
fun calculateBmi(weightKg: Double, heightCm: Double): BmiResult {
    val heightM = heightCm / 100.0
    val bmi = weightKg / (heightM * heightM)
    val category = when {
        bmi < 18.5 -> "Дефицит массы тела"
        bmi < 25.0 -> "Норма"
        bmi < 30.0 -> "Избыточная масса тела"
        bmi < 35.0 -> "Ожирение I степени"
        bmi < 40.0 -> "Ожирение II степени"
        else -> "Ожирение III степени"
    }
    return BmiResult(bmi, category)
}

// ---------- Шкала GRACE ----------

data class GraceResult(
    val points: Int,
    val riskCategory: String,
    val kagStrategy: String,
    val kagTiming: String
)

private fun graceAgePoints(age: Int): Int = when {
    age < 30 -> 0
    age <= 39 -> 8
    age <= 49 -> 25
    age <= 59 -> 41
    age <= 69 -> 58
    age <= 79 -> 75
    age <= 89 -> 91
    else -> 100
}

private fun graceHeartRatePoints(hr: Int): Int = when {
    hr < 50 -> 0
    hr <= 69 -> 3
    hr <= 89 -> 9
    hr <= 109 -> 15
    hr <= 149 -> 24
    hr <= 199 -> 38
    else -> 46
}

private fun graceSbpPoints(sbp: Int): Int = when {
    sbp < 80 -> 58
    sbp <= 99 -> 53
    sbp <= 119 -> 43
    sbp <= 139 -> 34
    sbp <= 159 -> 24
    sbp <= 199 -> 10
    else -> 0
}

private fun graceCreatininePoints(creatinineUmol: Double): Int {
    val mgDl = creatinineUmol / 88.4
    return when {
        mgDl < 0.40 -> 1
        mgDl < 0.80 -> 4
        mgDl < 1.20 -> 7
        mgDl < 1.60 -> 10
        mgDl < 2.00 -> 13
        mgDl < 4.00 -> 21
        else -> 28
    }
}

fun graceScore(
    age: Int,
    heartRate: Int,
    sbp: Int,
    creatinineUmol: Double,
    killip: Killip,
    cardiacArrestAtAdmission: Boolean,
    stDeviation: Boolean,
    elevatedEnzymes: Boolean
): GraceResult {
    val points = graceAgePoints(age) +
        graceHeartRatePoints(heartRate) +
        graceSbpPoints(sbp) +
        graceCreatininePoints(creatinineUmol) +
        killip.points +
        (if (cardiacArrestAtAdmission) 39 else 0) +
        (if (stDeviation) 28 else 0) +
        (if (elevatedEnzymes) 14 else 0)

    val (risk, strategy, timing) = when {
        points > 140 -> Triple("Высокий риск", "Экстр. инвазивная стратегия", "КАГ < 24 ч")
        points >= 109 -> Triple("Промежут. риск", "Ранняя инваз. стратегия", "КАГ < 72 ч")
        else -> Triple("Низкий риск", "Селективная инваз. стратегия", "по клиническим показаниям")
    }
    return GraceResult(points, risk, strategy, timing)
}

// ---------- Шкала CRUSADE ----------

data class CrusadeResult(
    val points: Int,
    val riskCategory: String,
    val bleedingRiskPercent: String
)

private fun crusadeHematocritPoints(hct: Double): Int = when {
    hct < 31.0 -> 9
    hct < 34.0 -> 7
    hct < 37.0 -> 3
    hct < 40.0 -> 2
    else -> 0
}

private fun crusadeCrClPoints(crCl: Double): Int = when {
    crCl <= 15.0 -> 39
    crCl <= 30.0 -> 35
    crCl <= 60.0 -> 28
    crCl <= 90.0 -> 17
    crCl <= 120.0 -> 7
    else -> 0
}

private fun crusadeHeartRatePoints(hr: Int): Int = when {
    hr <= 70 -> 0
    hr <= 80 -> 1
    hr <= 90 -> 3
    hr <= 100 -> 6
    hr <= 110 -> 8
    hr <= 120 -> 10
    else -> 11
}

private fun crusadeSbpPoints(sbp: Int): Int = when {
    sbp <= 90 -> 10
    sbp <= 100 -> 8
    sbp <= 120 -> 5
    sbp <= 180 -> 1
    sbp <= 200 -> 3
    else -> 5
}

fun crusadeScore(
    hematocrit: Double,
    creatinineClearance: Double,
    heartRate: Int,
    sex: Sex,
    signsOfChf: Boolean,
    priorVascularDisease: Boolean,
    diabetes: Boolean,
    sbp: Int
): CrusadeResult {
    val points = crusadeHematocritPoints(hematocrit) +
        crusadeCrClPoints(creatinineClearance) +
        crusadeHeartRatePoints(heartRate) +
        (if (sex == Sex.FEMALE) 8 else 0) +
        (if (signsOfChf) 7 else 0) +
        (if (priorVascularDisease) 6 else 0) +
        (if (diabetes) 6 else 0) +
        crusadeSbpPoints(sbp)

    val (risk, bleedRisk) = when {
        points <= 20 -> "Оч. низкий" to "≈ 3.1%"
        points <= 30 -> "Низкий" to "≈ 5.5%"
        points <= 40 -> "Умерен." to "≈ 8.6%"
        points <= 50 -> "Высокий" to "≈ 11.9%"
        else -> "Очень высокий" to "≈ 19.5%"
    }
    return CrusadeResult(points, risk, bleedRisk)
}
