package com.cardioacs.app

import org.junit.Assert.assertEquals
import org.junit.Test
import kotlin.math.round

private fun round1(v: Double) = round(v * 10) / 10

class CalculatorsTest {

    // Мужчина, 60 лет, креатинин 88.4 мкмоль/л (= 1.0 мг/дл ровно)
    // Scr/kappa = 1.0/0.9 = 1.111 > 1 -> min=1, max=1.111
    // eGFR = 142 * 1^-0.302 * 1.111^-1.2 * 0.9938^60
    @Test
    fun `ckdEpi2021 male reference value`() {
        val gfr = ckdEpi2021(Sex.MALE, 60, 88.4)
        // Ожидаемое значение проверено независимым расчётом по формуле CKD-EPI 2021
        assertEquals(86.2, round1(gfr), 0.1)
    }

    // Женщина, 70 лет, вес 60 кг, креатинин 70 мкмоль/л
    // CrCl = (140-70)*60*1.04 / 70 = 62.4
    @Test
    fun `cockcroftGault female reference value`() {
        val crCl = cockcroftGault(Sex.FEMALE, 70, 60.0, 70.0)
        assertEquals(62.4, round1(crCl), 0.1)
    }

    @Test
    fun `ckdStage boundaries`() {
        assertEquals("C1 (норма или повышена)", ckdStage(95.0))
        assertEquals("C2 (незначительно снижена)", ckdStage(75.0))
        assertEquals("C3a (умеренно снижена)", ckdStage(50.0))
        assertEquals("C3b (существенно снижена)", ckdStage(35.0))
        assertEquals("C4 (резко снижена)", ckdStage(20.0))
        assertEquals("C5 (терминальная почечная недостаточность)", ckdStage(10.0))
    }

    // Пример: возраст 65 (58), ЧСС 80 (9), АД 130 (34), креатинин 88.4 мкмоль/л = 1.0 мг/дл (7),
    // Killip I (0), без остановки сердца, без ST-отклонений, без повышенных ферментов.
    // Итого: 58+9+34+7 = 108 -> низкий риск
    @Test
    fun `graceScore low risk example`() {
        val result = graceScore(
            age = 65,
            heartRate = 80,
            sbp = 130,
            creatinineUmol = 88.4,
            killip = Killip.I,
            cardiacArrestAtAdmission = false,
            stDeviation = false,
            elevatedEnzymes = false
        )
        assertEquals(108, result.points)
        assertEquals("Низкий риск", result.riskCategory)
    }

    // То же, но остановка сердца (+39), ST-отклонение (+28), высокие ферменты (+14), Killip III (+39)
    // 58+9+34+7+39+28+14+39 = 228 -> высокий риск
    @Test
    fun `graceScore high risk example`() {
        val result = graceScore(
            age = 65,
            heartRate = 80,
            sbp = 130,
            creatinineUmol = 88.4,
            killip = Killip.III,
            cardiacArrestAtAdmission = true,
            stDeviation = true,
            elevatedEnzymes = true
        )
        assertEquals(228, result.points)
        assertEquals("Высокий риск", result.riskCategory)
        assertEquals("Экстренная инвазивная стратегия", result.kagStrategy)
        assertEquals("КАГ < 24 ч", result.kagTiming)
    }

    // Промежуточный риск: те же данные, но Killip I и без доп. факторов -> 108 баллов (низкий)
    // Добавим ЧСС повыше, чтобы попасть в диапазон 109-140.
    @Test
    fun `graceScore intermediate risk example splits strategy and timing`() {
        val result = graceScore(
            age = 65,
            heartRate = 95,
            sbp = 130,
            creatinineUmol = 88.4,
            killip = Killip.I,
            cardiacArrestAtAdmission = false,
            stDeviation = false,
            elevatedEnzymes = false
        )
        assertEquals("Промежуточный риск", result.riskCategory)
        assertEquals("Ранняя инвазивная стратегия", result.kagStrategy)
        assertEquals("КАГ < 72 ч", result.kagTiming)
    }

    // ИМТ: 80 кг, рост 178 см -> 80 / 1.78^2 ≈ 25.2 (избыточная масса тела)
    @Test
    fun `calculateBmi reference value`() {
        val result = calculateBmi(weightKg = 80.0, heightCm = 178.0)
        assertEquals(25.2, round1(result.value), 0.05)
        assertEquals("Избыточная масса тела", result.category)
    }

    // CRUSADE: гематокрит 36 (3), клиренс 55 (28), ЧСС 75 (1), женщина (8),
    // ХСН нет (0), сосудистое заб. нет (0), диабет нет (0), АД 130 (1)
    // Итого: 3+28+1+8+0+0+0+1 = 41 -> высокий риск
    @Test
    fun `crusadeScore example`() {
        val result = crusadeScore(
            hematocrit = 36.0,
            creatinineClearance = 55.0,
            heartRate = 75,
            sex = Sex.FEMALE,
            signsOfChf = false,
            priorVascularDisease = false,
            diabetes = false,
            sbp = 130
        )
        assertEquals(41, result.points)
        assertEquals("Высокий", result.riskCategory)
    }
}
