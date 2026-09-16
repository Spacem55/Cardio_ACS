package com.cardioacs.app

import android.content.Context
import android.graphics.Color as AndroidColor
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.times
import com.cardioacs.app.ui.theme.CardioACSTheme
import com.cardioacs.app.ui.theme.CardioBackground
import com.cardioacs.app.ui.theme.CardioDarkBackground
import com.cardioacs.app.ui.theme.CardioDarkPrimary
import com.cardioacs.app.ui.theme.CardioPrimary

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            CardioACSTheme {
                CardioScreen()
            }
        }
    }
}

/** Безопасный парсинг: возвращает null, если строка пустая или не является числом. */
private fun String.toDoubleOrNullSafe(): Double? = this.trim().replace(',', '.').toDoubleOrNull()
private fun String.toIntOrNullSafe(): Int? = this.trim().toIntOrNull()

// ---- Сохранение выбранной темы (цвет фона + тёмная тема) между запусками приложения ----
private const val THEME_PREFS_NAME = "cardio_theme_prefs"
private const val KEY_BACKGROUND_ARGB = "background_argb"
private const val KEY_DARK_THEME = "dark_theme"

// Сдвиг яркости (V в HSV) верхней полосы И полосы "Результаты" в тёмной теме — версия 17,
// зафиксировано по просьбе пользователя (было временным ползунком в версии 16).
private const val darkThemeAccentToneAdjust = -0.3f

// Фиксированный масштаб шрифта надписи "Результаты" (версия 18) — было служебным ползунком
// (версия 17, ключ SharedPreferences и диалог удалены), пользователь подобрал 120% и попросил
// зафиксировать константой, весь служебный UI удалён.
private const val resultsBannerFontScaleFixed = 1.2f

// Фиксированный масштаб шрифта надписи "не требуется" (версия 19) — было служебным
// ползунком (версия 18, ключ SharedPreferences и диалог удалены), пользователь подобрал
// 145% и попросил зафиксировать константой, весь служебный UI удалён.
private const val unneededTextFontScaleFixed = 1.45f

// Степень затенения (alpha полупрозрачной плашки-фона) переключателя Муж/Жен, когда пол
// не нужен (item 1, версия 19) — плашка рисуется ПОВЕРХ реально отрисованных иконок
// (`MaybeUnneededField`, content() всё ещё рисуется), поэтому "затемнение" достигается
// именно тем, что иконки под ней приглушаются полупрозрачным слоем.
private const val unneededShadeAlpha = 0.85f

// Версия 22, ИСПРАВЛЕНО (item 2): область-заменитель "не требуется" в `NumberField`
// (версия 21) рисуется БЕЗ реального поля под собой — раньше для неё тоже
// использовался фон `colorScheme.surface.copy(alpha = unneededShadeAlpha)`, но карточка
// подраздела сама залита ТЕМ ЖЕ `colorScheme.surface` — полупрозрачный слой ОДНОГО и
// ТОГО ЖЕ цвета поверх фона того же цвета визуально не даёт заметного затенения (в
// отличие от версии 17-20, где под плашкой было видно настоящее поле — там же и
// возникал видимый контраст, а не от самого цвета плашки). Теперь фон плашки —
// `colorScheme.onSurface` (контрастный к `surface`) с низкой альфой — стандартный
// Material3-паттерн "неактивного" контейнера (обычно ~12%), даёт заметный сероватый
// оттенок поверх карточки при ЛЮБОЙ теме.
private const val unneededBoxTintAlpha = 0.10f

// Версия 22 (item 2): степень "приглушения" ПОДПИСИ поля (например, "Возраст, лет"),
// когда поле не нужно — по просьбе пользователя подпись тоже должна выглядеть
// затемнённой/приглушённой, а не оставаться в обычном цвете. В отличие от текста "не
// требуется" (версия 20 — там полная непрозрачность специально, т.к. это сообщение
// должно быть чётко читаемым), подпись — второстепенный элемент, поэтому здесь уместно
// именно "выцветание" через снижение альфы (в отличие от версии 19, где так ошибочно
// пытались затемнить ЧИТАЕМЫЙ текст сообщения — см. комментарий у `NumberField`).
private const val unneededLabelAlpha = 0.5f

// Версия 23 (по прямой просьбе пользователя): дополнительная альфа для самого текста "не
// требуется" — раньше (версия 20-22) он рисовался ПОЛНОСТЬЮ непрозрачным `onSurfaceVariant`
// намеренно (это сообщение должно быть легко читаемым, см. комментарий у `NumberField`).
// Теперь текст сидит поверх уже приглушённой плашки (`unneededBoxTintAlpha`), и по просьбе
// пользователя дополнительно чуть "притушен" собственной альфой — значение подобрано
// умеренным (не как `unneededLabelAlpha` у второстепенной подписи), чтобы надпись
// оставалась разборчивой.
private const val unneededTextAlpha = 0.5f

private fun loadSavedBackgroundArgb(context: Context, default: Int): Int =
    context.getSharedPreferences(THEME_PREFS_NAME, Context.MODE_PRIVATE)
        .getInt(KEY_BACKGROUND_ARGB, default)

private fun loadSavedDarkTheme(context: Context): Boolean =
    context.getSharedPreferences(THEME_PREFS_NAME, Context.MODE_PRIVATE)
        .getBoolean(KEY_DARK_THEME, false)

private fun saveThemePrefs(
    context: Context,
    backgroundArgb: Int,
    darkTheme: Boolean
) {
    context.getSharedPreferences(THEME_PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putInt(KEY_BACKGROUND_ARGB, backgroundArgb)
        .putBoolean(KEY_DARK_THEME, darkTheme)
        .apply()
}

// Палитра фона в порядке радуги (по цветовому тону), 11 цветов, 4 из них новые (item 6).
private val backgroundPalette = listOf(
    Color(0xFFFF7F50), // коралл
    Color(0xFFFFF3E0), // светло-персиковый
    Color(0xFFF3D117), // жёлтый (новый)
    Color(0xFFAEEA00), // салатовый
    Color(0xFF09AB18), // зелёный (новый)
    Color(0xFF7FFFD4), // аквамарин
    Color(0xFFAECEF9), // светло-голубой
    Color(0xFF0728C5), // синий (новый)
    Color(0xFF6803B7), // фиолетовый (новый)
    Color(0xFFFF69B4), // розовый
    Color(0xFFFCE4EC)  // светло-розовый
)

/** Контрастный (тёмный/светлый) цвет текста для заданного фона. */
private fun contrastingTextColor(background: Color): Color =
    if (background.luminance() > 0.5f) Color(0xFF1B1B1B) else Color.White

/** Акцентный цвет заголовков, подобранный в тон выбранному фону (учитывает тёмную тему). */
private fun accentColorFor(background: Color, isDark: Boolean = false): Color {
    val hsv = FloatArray(3)
    AndroidColor.colorToHSV(background.toArgb(), hsv)
    return if (hsv[1] < 0.08f) {
        // фон почти без цвета (белый/серый/никель/тёмно-серый) — используем фирменный акцент
        if (isDark) CardioDarkPrimary else CardioPrimary
    } else {
        hsv[1] = if (isDark) 0.5f else 0.55f
        hsv[2] = if (isDark) 0.7f else 0.55f
        Color(AndroidColor.HSVToColor(hsv))
    }
}

/**
 * Сдвигает яркость (канал V в HSV) цвета на delta (может быть отрицательным — темнее,
 * положительным — светлее), результат зажат в [0,1]. Используется для служебного
 * ползунка подбора тона верхней полосы в тёмной теме (версия 16).
 */
private fun adjustLightness(color: Color, delta: Float): Color {
    if (delta == 0f) return color
    val hsv = FloatArray(3)
    AndroidColor.colorToHSV(color.toArgb(), hsv)
    hsv[2] = (hsv[2] + delta).coerceIn(0f, 1f)
    return Color(AndroidColor.HSVToColor(hsv))
}

private val sectionTitleStyle: TextStyle
    @Composable get() = MaterialTheme.typography.titleMedium.copy(
        fontSize = MaterialTheme.typography.titleMedium.fontSize * 1.3f
    )

// Множитель размера шрифта комментариев (строчного текста) в блоке "Результаты" — измените при необходимости.
private const val resultTextFontScale = 1.0f

private val resultTextStyle: TextStyle
    @Composable get() = MaterialTheme.typography.bodySmall.copy(
        fontSize = MaterialTheme.typography.bodySmall.fontSize * resultTextFontScale
    )

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CardioScreen() {
    // ---- Ввод данных ----
    // Пол теперь nullable (версия 20, item 2): изначально и после сброса — НЕ выбран (обе
    // иконки неактивны), а не MALE по умолчанию, как раньше.
    var sex by rememberSaveable { mutableStateOf<Sex?>(null) }
    var ageText by rememberSaveable { mutableStateOf("") }
    var heightText by rememberSaveable { mutableStateOf("") }
    var weightText by rememberSaveable { mutableStateOf("") }
    var creatinineText by rememberSaveable { mutableStateOf("") }
    var heartRateText by rememberSaveable { mutableStateOf("") }
    var sbpText by rememberSaveable { mutableStateOf("") }
    var hematocritText by rememberSaveable { mutableStateOf("") }

    var cardiacArrest by rememberSaveable { mutableStateOf(false) }
    var stDeviation by rememberSaveable { mutableStateOf(false) }
    var elevatedEnzymes by rememberSaveable { mutableStateOf(false) }
    var killip by rememberSaveable { mutableStateOf(Killip.I) }
    var signsOfChf by rememberSaveable { mutableStateOf(false) }
    var priorVascularDisease by rememberSaveable { mutableStateOf(false) }
    var diabetes by rememberSaveable { mutableStateOf(false) }

    // Цвет фона и тёмная тема сохраняются в SharedPreferences и подхватываются здесь при
    // каждом запуске приложения (rememberSaveable сам по себе переживает только поворот
    // экрана/пересоздание Activity, но не гарантирует восстановление после полного закрытия
    // приложения — поэтому реальное хранилище тут SharedPreferences).
    val context = LocalContext.current
    var backgroundColorArgb by rememberSaveable {
        mutableStateOf(loadSavedBackgroundArgb(context, CardioBackground.toArgb()))
    }
    var isDarkTheme by rememberSaveable {
        mutableStateOf(loadSavedDarkTheme(context))
    }
    LaunchedEffect(backgroundColorArgb, isDarkTheme) {
        saveThemePrefs(context, backgroundColorArgb, isDarkTheme)
    }
    var showColorPicker by remember { mutableStateOf(false) }
    var menuExpanded by remember { mutableStateOf(false) }
    var showFormulasDialog by remember { mutableStateOf(false) }
    var showAboutDialog by remember { mutableStateOf(false) }

    var showBmi by rememberSaveable { mutableStateOf(true) }
    var showGfr by rememberSaveable { mutableStateOf(true) }
    var showCrCl by rememberSaveable { mutableStateOf(true) }
    var showGrace by rememberSaveable { mutableStateOf(true) }
    var showCrusade by rememberSaveable { mutableStateOf(true) }

    val backgroundColor = Color(backgroundColorArgb)
    val effectiveBackgroundColor = if (isDarkTheme) CardioDarkBackground else backgroundColor
    // Акцент теперь всегда считается от ВЫБРАННОГО цвета фона (а не от фиксированного
    // тёмного фона), поэтому в тёмной теме заголовки/полосы тоже следуют за палитрой,
    // выбранной пользователем, а не всегда получают один и тот же синий (item 5).
    val accentColor = accentColorFor(backgroundColor, isDarkTheme)
    // Цвет верхней полосы И полосы "Результаты" (версия 17, item 2 — дублирует одну и ту
    // же поправку на обе полосы): в тёмной теме — accentColor, затемнённый на 30%
    // (darkThemeAccentToneAdjust), в светлой — просто accentColor без изменений.
    // Заголовки подразделов (accentColor.copy(alpha=0.14f)) эту поправку НЕ получают.
    val toneAdjustedAccentColor =
        if (isDarkTheme) adjustLightness(accentColor, darkThemeAccentToneAdjust) else accentColor
    val topBarColor = toneAdjustedAccentColor

    val scrollState = rememberScrollState()

    val age = ageText.toIntOrNullSafe()
    val height = heightText.toDoubleOrNullSafe()
    val weight = weightText.toDoubleOrNullSafe()
    val creatinine = creatinineText.toDoubleOrNullSafe()
    val heartRate = heartRateText.toIntOrNullSafe()
    val sbp = sbpText.toIntOrNullSafe()
    val hematocrit = hematocritText.toDoubleOrNullSafe()
    // Локальная копия для смарт-каста: `sex` — `var` из Compose-состояния, компилятор Kotlin
    // не смарт-кастит такие свойства напрямую даже после проверки на null (версия 20, item 2).
    val sexValue = sex
    val creatinineClearance: Double? =
        if (sexValue != null && age != null && weight != null && weight > 0 && creatinine != null && creatinine > 0) {
            cockcroftGault(sexValue, age, weight, creatinine)
        } else null

    // ---- Какие поля ввода нужны при текущем наборе включённых формул (item 3, версия 17) ----
    // Поле считается ненужным, только если ВСЕ формулы, где оно участвует (включая косвенное
    // участие через клиренс креатинина — Возраст/Масса тела/Креатинин/Пол также нужны CRUSADE,
    // т.к. CRUSADE использует уже посчитанный клиренс), выключены.
    val ageNeeded = showGfr || showCrCl || showGrace || showCrusade
    val heightNeeded = showBmi
    val weightNeeded = showBmi || showCrCl || showCrusade
    val sexNeeded = showGfr || showCrCl || showCrusade
    val creatinineNeeded = showGfr || showCrCl || showGrace || showCrusade
    val heartRateNeeded = showGrace || showCrusade
    val sbpNeeded = showGrace || showCrusade
    val hematocritNeeded = showCrusade

    // ---- Видимость строк и блоков целиком (item 4-5, версия 18) ----
    // Строка скрывается целиком, только если ОБА поля в ней не нужны ни одной формуле.
    val ageSexRowNeeded = ageNeeded || sexNeeded
    val heightWeightRowNeeded = heightNeeded || weightNeeded
    val hrSbpRowNeeded = heartRateNeeded || sbpNeeded
    val creatinineHematocritRowNeeded = creatinineNeeded || hematocritNeeded
    // Блок (вместе с заголовком-подзаголовком) скрывается целиком, если ВСЕ его строки/пункты
    // не нужны ни одной формуле.
    val patientBlockNeeded = ageSexRowNeeded || heightWeightRowNeeded
    val labBlockNeeded = hrSbpRowNeeded || creatinineHematocritRowNeeded
    val clinicalSignsBlockNeeded = showGrace || showCrusade
    // Какой из блоков ввода показывается первым — ему нужен скруглённый верхний край
    // (roundedTop), т.к. предыдущие блоки могут быть скрыты целиком.
    val firstVisibleInputBlock = when {
        patientBlockNeeded -> "patient"
        labBlockNeeded -> "lab"
        showGrace -> "killip"
        clinicalSignsBlockNeeded -> "clinical"
        else -> null
    }

    // ---- Обнуление данных перед скрытием (item 5, версия 18): как только поле/пункт
    // перестаёт быть нужным текущему набору формул, введённое в нём значение сбрасывается. ----
    LaunchedEffect(ageNeeded) { if (!ageNeeded) ageText = "" }
    LaunchedEffect(heightNeeded) { if (!heightNeeded) heightText = "" }
    LaunchedEffect(weightNeeded) { if (!weightNeeded) weightText = "" }
    LaunchedEffect(sexNeeded) { if (!sexNeeded) sex = null }
    LaunchedEffect(creatinineNeeded) { if (!creatinineNeeded) creatinineText = "" }
    LaunchedEffect(heartRateNeeded) { if (!heartRateNeeded) heartRateText = "" }
    LaunchedEffect(sbpNeeded) { if (!sbpNeeded) sbpText = "" }
    LaunchedEffect(hematocritNeeded) { if (!hematocritNeeded) hematocritText = "" }
    LaunchedEffect(showGrace) {
        if (!showGrace) {
            cardiacArrest = false
            stDeviation = false
            elevatedEnzymes = false
            killip = Killip.I
        }
    }
    LaunchedEffect(showCrusade) {
        if (!showCrusade) {
            signsOfChf = false
            priorVascularDisease = false
            diabetes = false
        }
    }

    CardioACSTheme(darkTheme = isDarkTheme) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(effectiveBackgroundColor)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // ---- Фиксированный заголовок (не скроллится, контрастный фон, компактная высота) ----
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(topBarColor)
                    .statusBarsPadding()
            ) {
                Text(
                    "Кардио-калькулятор ОКС",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = contrastingTextColor(topBarColor),
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp)
                )
                // Значок настроек (три горизонтальные черты) — справа от названия, само название не смещается,
                // т.к. Text выше по-прежнему центрируется по всей ширине полосы.
                Box(modifier = Modifier.align(Alignment.CenterEnd)) {
                    IconButton(
                        onClick = { menuExpanded = true },
                        modifier = Modifier
                            .padding(end = 4.dp)
                            .size(36.dp)
                    ) {
                        Icon(
                            Icons.Filled.Menu,
                            contentDescription = "Настройки",
                            tint = contrastingTextColor(topBarColor),
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    DropdownMenu(expanded = menuExpanded, onDismissRequest = { menuExpanded = false }) {
                        DropdownMenuItem(
                            text = { Text("Тема") },
                            onClick = {
                                menuExpanded = false
                                showColorPicker = true
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Формулы") },
                            onClick = {
                                menuExpanded = false
                                showFormulasDialog = true
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("О программе") },
                            onClick = {
                                menuExpanded = false
                                showAboutDialog = true
                            }
                        )
                    }
                }
            }

            // ---- Прокручиваемое содержимое ----
            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(scrollState)
                    .padding(horizontal = 16.dp)
                    .padding(top = 14.dp)
                    .navigationBarsPadding(),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Единый блок ввода данных
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column {
                        if (patientBlockNeeded) {
                            SubsectionHeader(
                                "Пациент",
                                accentColor,
                                roundedTop = firstVisibleInputBlock == "patient",
                                onRefresh = {
                                    // Сброс ВСЕХ введённых пользователем данных: поля ввода и
                                    // отмеченные галочки клинических признаков (настройки
                                    // отображения формул и темы не затрагиваются).
                                    ageText = ""
                                    heightText = ""
                                    weightText = ""
                                    sex = null
                                    creatinineText = ""
                                    heartRateText = ""
                                    sbpText = ""
                                    hematocritText = ""
                                    cardiacArrest = false
                                    stDeviation = false
                                    elevatedEnzymes = false
                                    killip = Killip.I
                                    signsOfChf = false
                                    priorVascularDisease = false
                                    diabetes = false
                                }
                            )
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                // Строка "Возраст"+"Пол" скрывается целиком, если ОБА поля не
                                // нужны текущим формулам (item 4, версия 18).
                                if (ageSexRowNeeded) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(IntrinsicSize.Min),
                                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                                    ) {
                                        NumberField(
                                            "Возраст, лет", ageText, { ageText = it }, KeyboardType.Number,
                                            needed = ageNeeded,
                                            modifier = Modifier.weight(1f).fillMaxHeight()
                                        )
                                        // "Пол" — особый случай (item 1-2, версия 18-19): когда не
                                        // нужен, иконки переключаются на "inactive" (тема-корректный
                                        // вариант, см. `enabled` в SexToggle) И затеняются той же
                                        // плашкой, что и обычные поля (БЕЗ надписи "не требуется"
                                        // поверх иконок, по просьбе пользователя — `MaybeUnneededField`
                                        // версии 21 больше не рисует текст вообще, используется только
                                        // как затеняющая плашка для переключателя пола).
                                        MaybeUnneededField(
                                            needed = sexNeeded,
                                            modifier = Modifier.weight(1f).fillMaxHeight()
                                        ) {
                                            SexToggle(
                                                sex = sex,
                                                onSexChange = { sex = it },
                                                isDarkTheme = isDarkTheme,
                                                enabled = sexNeeded,
                                                modifier = Modifier.fillMaxSize()
                                            )
                                        }
                                    }
                                }
                                // Строка "Рост"+"Масса тела" скрывается целиком, если ОБА поля не
                                // нужны текущим формулам (item 4, версия 18).
                                if (heightWeightRowNeeded) {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        NumberField(
                                            "Рост, см", heightText, { heightText = it }, KeyboardType.Number,
                                            needed = heightNeeded,
                                            modifier = Modifier.weight(1f)
                                        )
                                        NumberField(
                                            "Масса тела, кг", weightText, { weightText = it }, KeyboardType.Decimal,
                                            needed = weightNeeded,
                                            modifier = Modifier.weight(1f)
                                        )
                                    }
                                }
                            }
                        }

                        if (labBlockNeeded) {
                            SubsectionHeader(
                                "Лабораторные и витальные показатели",
                                accentColor,
                                roundedTop = firstVisibleInputBlock == "lab"
                            )
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                // Строка "ЧСС"+"АД сист." скрывается целиком, если ОБА поля не
                                // нужны текущим формулам (item 4, версия 18).
                                if (hrSbpRowNeeded) {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        NumberField(
                                            "ЧСС, уд/мин", heartRateText, { heartRateText = it }, KeyboardType.Number,
                                            needed = heartRateNeeded,
                                            modifier = Modifier.weight(1f)
                                        )
                                        NumberField(
                                            "АД сист. мм рт.ст.", sbpText, { sbpText = it }, KeyboardType.Number,
                                            needed = sbpNeeded,
                                            modifier = Modifier.weight(1f)
                                        )
                                    }
                                }
                                // Строка "Креатинин"+"Гематокрит" скрывается целиком, если ОБА поля
                                // не нужны текущим формулам (item 4, версия 18).
                                if (creatinineHematocritRowNeeded) {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        NumberField(
                                            "Креатинин, мкмоль/л", creatinineText, { creatinineText = it }, KeyboardType.Decimal,
                                            needed = creatinineNeeded,
                                            modifier = Modifier.weight(1f)
                                        )
                                        NumberField(
                                            "Гематокрит,%", hematocritText, { hematocritText = it }, KeyboardType.Decimal,
                                            needed = hematocritNeeded,
                                            modifier = Modifier.weight(1f)
                                        )
                                    }
                                }
                            }
                        }

                        // "Класс ОСН (Killip)" нужен только GRACE — весь блок скрывается,
                        // если GRACE выключен в "Формулы" (item 3, версия 17).
                        if (showGrace) {
                            SubsectionHeader(
                                "Класс ОСН (Killip)",
                                accentColor,
                                roundedTop = firstVisibleInputBlock == "killip"
                            )
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                KillipSelector(killip, borderColor = toneAdjustedAccentColor) { killip = it }
                            }
                        }

                        // "Клинические признаки" — весь блок (включая заголовок) скрывается,
                        // если не нужен ни GRACE, ни CRUSADE (item 5, версия 18).
                        if (clinicalSignsBlockNeeded) {
                            SubsectionHeader(
                                "Клинические признаки",
                                accentColor,
                                roundedTop = firstVisibleInputBlock == "clinical"
                            )
                            Column(modifier = Modifier.padding(6.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                // Первые три — нужны только GRACE, последние три — только CRUSADE
                                // (item 3, версия 17): каждая строка скрывается по отдельности.
                                if (showGrace) {
                                    YesNoRow("Остановка сердца при поступлении", cardiacArrest) { cardiacArrest = it }
                                    YesNoRow("Отклонение сегмента ST на ЭКГ", stDeviation) { stDeviation = it }
                                    YesNoRow("Высокий уровень сердечных ферментов", elevatedEnzymes) { elevatedEnzymes = it }
                                }
                                if (showCrusade) {
                                    YesNoRow("Признаки ХСН при поступлении", signsOfChf) { signsOfChf = it }
                                    YesNoRow(
                                        "Предшествующее сосудистое заболевание (периферический атеросклероз или ОНМК)",
                                        priorVascularDisease
                                    ) { priorVascularDisease = it }
                                    YesNoRow("Сахарный диабет", diabetes) { diabetes = it }
                                }
                            }
                        }
                    }
                }

                // Единый блок результатов
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column {
                        ResultsBanner(toneAdjustedAccentColor)

                        if (showBmi) {
                            val bmi = if (height != null && height > 0 && weight != null && weight > 0) {
                                calculateBmi(weight, height)
                            } else null
                            SubsectionHeader(
                                "ИМТ (индекс массы тела)",
                                accentColor,
                                valueText = bmi?.let { "%.1f".format(it.value) } ?: "—"
                            )
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                if (bmi != null) {
                                    ResultComment("*Единицы измерения: кг/м²")
                                    ResultComment("Категория: ${bmi.category}")
                                } else {
                                    MissingDataHint("рост, масса тела")
                                }
                            }
                        }

                        if (showGfr) {
                            val gfr = if (sexValue != null && age != null && creatinine != null && creatinine > 0) {
                                ckdEpi2021(sexValue, age, creatinine)
                            } else null
                            SubsectionHeader(
                                "СКФ (CKD-EPI 2021)",
                                accentColor,
                                valueText = gfr?.let { "%.1f".format(it) } ?: "—"
                            )
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                if (gfr != null) {
                                    ResultComment("*Единицы измерения: мл/мин/1.73м²")
                                    ResultComment("Стадия ХБП: ${ckdStage(gfr)}")
                                } else {
                                    MissingDataHint("возраст, пол, креатинин")
                                }
                            }
                        }

                        if (showCrCl) {
                            val crCl = creatinineClearance
                            SubsectionHeader(
                                "Клиренс креатинина (Кокрофт-Голт)",
                                accentColor,
                                valueText = crCl?.let { "%.1f".format(it) } ?: "—"
                            )
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                if (crCl != null) {
                                    ResultComment("*Единицы измерения: мл/мин")
                                    ResultComment("Стадия ХБП: ${ckdStage(crCl)}")
                                } else {
                                    MissingDataHint("возраст, пол, масса тела, креатинин")
                                }
                            }
                        }

                        if (showGrace) {
                            val graceResult = if (age != null && heartRate != null && sbp != null && creatinine != null && creatinine > 0) {
                                graceScore(
                                    age = age,
                                    heartRate = heartRate,
                                    sbp = sbp,
                                    creatinineUmol = creatinine,
                                    killip = killip,
                                    cardiacArrestAtAdmission = cardiacArrest,
                                    stDeviation = stDeviation,
                                    elevatedEnzymes = elevatedEnzymes
                                )
                            } else null
                            SubsectionHeader(
                                "Шкала GRACE",
                                accentColor,
                                valueText = graceResult?.let { "${it.points}" } ?: "—"
                            )
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                if (graceResult != null) {
                                    ResultComment("*Единицы измерения: баллы")
                                    ResultComment("Категория риска: ${graceResult.riskCategory}")
                                    ResultComment("Тактика КАГ: ${graceResult.kagStrategy}, ${graceResult.kagTiming}")
                                } else {
                                    MissingDataHint("возраст, ЧСС, АД сист., креатинин")
                                }
                            }
                        }

                        if (showCrusade) {
                            val crCl = creatinineClearance
                            val crusadeResult = if (sexValue != null && hematocrit != null && crCl != null && heartRate != null && sbp != null) {
                                crusadeScore(
                                    hematocrit = hematocrit,
                                    creatinineClearance = crCl,
                                    heartRate = heartRate,
                                    sex = sexValue,
                                    signsOfChf = signsOfChf,
                                    priorVascularDisease = priorVascularDisease,
                                    diabetes = diabetes,
                                    sbp = sbp
                                )
                            } else null
                            SubsectionHeader(
                                "Шкала CRUSADE",
                                accentColor,
                                valueText = crusadeResult?.let { "${it.points}" } ?: "—"
                            )
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                if (crusadeResult != null) {
                                    ResultComment("*Единицы измерения: баллы")
                                    ResultComment("Категория риска кровотечения: ${crusadeResult.riskCategory}")
                                    ResultComment("Риск крупного кровотечения: ${crusadeResult.bleedingRiskPercent}")
                                } else {
                                    MissingDataHint("гематокрит, ЧСС, АД сист. и данные для расчёта клиренса креатинина (возраст, пол, масса, креатинин)")
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))
            }
        }

        if (showColorPicker) {
            BackgroundColorPickerDialog(
                current = backgroundColor,
                isDarkTheme = isDarkTheme,
                onDarkThemeChange = { isDarkTheme = it },
                onColorSelected = { backgroundColorArgb = it.toArgb() },
                onDismiss = { showColorPicker = false }
            )
        }

        if (showFormulasDialog) {
            FormulasVisibilityDialog(
                showBmi = showBmi, onShowBmiChange = { showBmi = it },
                showGfr = showGfr, onShowGfrChange = { showGfr = it },
                showCrCl = showCrCl, onShowCrClChange = { showCrCl = it },
                showGrace = showGrace, onShowGraceChange = { showGrace = it },
                showCrusade = showCrusade, onShowCrusadeChange = { showCrusade = it },
                onDismiss = { showFormulasDialog = false }
            )
        }

        if (showAboutDialog) {
            AboutDialog(onDismiss = { showAboutDialog = false })
        }
    }
    }
}

/**
 * Тонированная плашка-подзаголовок подраздела, цвет — в тон текущему фону (accentColor).
 * Если передан valueText — итоговое значение показывается в той же строке, справа от заголовка
 * (используется в блоке "Результаты", чтобы не листать за итоговой цифрой).
 */
@Composable
private fun SubsectionHeader(
    title: String,
    accentColor: Color,
    roundedTop: Boolean = false,
    valueText: String? = null,
    onRefresh: (() -> Unit)? = null
) {
    val shape = if (roundedTop) RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp) else RoundedCornerShape(0.dp)
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(accentColor.copy(alpha = 0.14f))
            .padding(horizontal = 16.dp, vertical = 10.dp)
    ) {
        if (valueText != null) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    title,
                    style = sectionTitleStyle,
                    fontWeight = FontWeight.Bold,
                    color = accentColor,
                    modifier = Modifier.weight(1f)
                )
                Text(
                    valueText,
                    style = sectionTitleStyle,
                    fontWeight = FontWeight.Bold,
                    color = accentColor,
                    textAlign = TextAlign.End
                )
            }
        } else if (onRefresh != null) {
            // Заголовок с кнопкой "Обновить" в той же строке (сейчас — только "Пациент").
            // Иконка окрашивается в accentColor — тот же цвет, что и текст заголовка,
            // поэтому меняется вместе с темой автоматически.
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(title, style = sectionTitleStyle, fontWeight = FontWeight.Bold, color = accentColor)
                // Круглая кликабельная зона (32dp, без изменений размера) с обычным
                // ripple-эффектом ("моргание" при нажатии) — ripple обрезан по кругу
                // благодаря .clip(CircleShape) ПЕРЕД .clickable(...).
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onRefresh),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Filled.Refresh,
                        contentDescription = "Сбросить все данные",
                        tint = accentColor,
                        modifier = Modifier.size(32.dp)
                    )
                }
            }
        } else {
            Text(title, style = sectionTitleStyle, fontWeight = FontWeight.Bold, color = accentColor)
        }
    }
}

/**
 * Сплошная плашка-заголовок "Результаты", цвет — в тон текущему фону (accentColor).
 * Масштаб шрифта зафиксирован константой `resultsBannerFontScaleFixed` (версия 18) — раньше
 * был служебным ползунком (версия 17), пользователь подобрал 120% и попросил зафиксировать.
 */
@Composable
private fun ResultsBanner(accentColor: Color) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp))
            .background(accentColor)
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        Text(
            "Результаты",
            style = MaterialTheme.typography.titleLarge.copy(
                fontSize = MaterialTheme.typography.titleLarge.fontSize * 1.3f * resultsBannerFontScaleFixed
            ),
            fontWeight = FontWeight.Bold,
            color = contrastingTextColor(accentColor),
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun BackgroundColorPickerDialog(
    current: Color,
    isDarkTheme: Boolean,
    onDarkThemeChange: (Boolean) -> Unit,
    onColorSelected: (Color) -> Unit,
    onDismiss: () -> Unit
) {
    var selected by remember { mutableStateOf(current) }
    var darkSelected by remember { mutableStateOf(isDarkTheme) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Тема оформления") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Тёмная тема", fontWeight = FontWeight.Medium)
                    Switch(checked = darkSelected, onCheckedChange = { darkSelected = it })
                }
                Text(
                    "Цвет фона",
                    fontWeight = FontWeight.Medium
                )
                // Палитра активна и в тёмной теме — выбранный цвет используется как основа
                // для accentColor и в тёмной теме тоже (item 5), а не только в светлой.
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    backgroundPalette.chunked(6).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            row.forEach { color ->
                                ColorSwatch(
                                    color = color,
                                    selected = color == selected,
                                    onClick = { selected = color }
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                onDarkThemeChange(darkSelected)
                onColorSelected(selected)
                onDismiss()
            }) { Text("Готово") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Отмена") }
        }
    )
}

@Composable
private fun FormulasVisibilityDialog(
    showBmi: Boolean, onShowBmiChange: (Boolean) -> Unit,
    showGfr: Boolean, onShowGfrChange: (Boolean) -> Unit,
    showCrCl: Boolean, onShowCrClChange: (Boolean) -> Unit,
    showGrace: Boolean, onShowGraceChange: (Boolean) -> Unit,
    showCrusade: Boolean, onShowCrusadeChange: (Boolean) -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Формулы") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    "Выберите блоки, отображаемые в разделе «Результаты»",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(4.dp))
                FormulaToggleRow("ИМТ (индекс массы тела)", showBmi, onShowBmiChange)
                FormulaToggleRow("СКФ (CKD-EPI 2021)", showGfr, onShowGfrChange)
                FormulaToggleRow("Клиренс креатинина (Кокрофт-Голт)", showCrCl, onShowCrClChange)
                FormulaToggleRow("Шкала GRACE", showGrace, onShowGraceChange)
                FormulaToggleRow("Шкала CRUSADE", showCrusade, onShowCrusadeChange)
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Готово") }
        }
    )
}

@Composable
private fun FormulaToggleRow(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, modifier = Modifier.weight(1f).padding(end = 8.dp))
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
private fun AboutDialog(onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("О программе") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "Кардио-калькулятор ОКС",
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.bodyLarge
                )
                Text(
                    "Версия 2cd D:\\Cardio_ACS.0",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    "Приложение рассчитывает вспомогательные клинические показатели по " +
                        "введённым данным: ИМТ, СКФ (CKD-EPI 2021), клиренс креатинина " +
                        "(формула Кокрофта-Голта), шкалу GRACE и шкалу CRUSADE.",
                    style = MaterialTheme.typography.bodyMedium
                )
                Text(
                    "Важно: приложение не является медицинским изделием и не ставит диагноз. " +
                        "Результаты расчётов носят справочный характер и не заменяют " +
                        "консультацию врача — решения о диагностике и лечении должен " +
                        "принимать квалифицированный медицинский специалист.",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Закрыть") }
        }
    )
}

@Composable
private fun ColorSwatch(color: Color, selected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(36.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(color)
            .border(
                width = if (selected) 3.dp else 1.dp,
                color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                shape = RoundedCornerShape(8.dp)
            )
            .clickable(onClick = onClick)
    )
}

/**
 * Оборачивает переключатель пола (версия 19; версия 21 — используется ТОЛЬКО для него,
 * см. ниже): если он не требуется ни одной из СЕЙЧАС включённых формул (item 3, версия
 * 17), содержимое остаётся на прежнем месте (тот же размер), но затеняется полупрозрачной
 * плашкой (alpha `unneededShadeAlpha`) и становится некликабельным (клик по плашке ничего
 * не делает — намеренно, чтобы нельзя было случайно нажать иконку пола, которая сейчас ни
 * на что не влияет).
 * Версия 21: надпись "не требуется" здесь БОЛЬШЕ НЕ РИСУЕТСЯ — для "Пол" она и не была
 * нужна (иконки сами переключаются в "inactive", см. `SexToggle`/`enabled`), а для полей
 * ввода (`NumberField`) центрирование текста поверх ВСЕГО поля (подпись + рамка вместе)
 * было архитектурной ошибкой: плашка перекрывала подпись+рамку как единое целое, поэтому
 * текст центрировался относительно слишком высокой области и визуально "уезжал" от
 * видимой рамки поля. Правильное решение (предложено пользователем) — рисовать заменяющую
 * область РОВНО в границах самой рамки ввода, а не всего поля целиком; теперь это делает
 * сам `NumberField` через параметр `needed` (см. ниже), а не эта обёртка.
 */
@Composable
private fun MaybeUnneededField(
    needed: Boolean,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    Box(modifier = modifier) {
        content()
        if (!needed) {
            Box(
                modifier = Modifier
                    .matchParentSize()
                    .clip(RoundedCornerShape(4.dp))
                    .background(MaterialTheme.colorScheme.surface.copy(alpha = unneededShadeAlpha))
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = {}
                    )
            )
        }
    }
}

/**
 * Поле ввода с ПОСТОЯННОЙ подписью над рамкой.
 *
 * У обычного OutlinedTextField подпись всегда анимированно "прыгает" между центром поля
 * (пусто и не в фокусе) и верхней границей (в фокусе или есть текст) — это встроенное
 * поведение Compose Material3, которое не отключается никакими параметрами (в т.ч. и
 * placeholder — это не сработало). Поэтому здесь подпись рисуется отдельным статичным
 * текстом НАД полем, а само поле — обычная рамка с BasicTextField без встроенного label.
 *
 * `needed` (версия 21, item 2 — архитектурное исправление): когда `false`, вместо
 * `BasicTextField` рисуется статичная область ТОЙ ЖЕ формы (те же рамка, скругление и
 * отступы `padding(horizontal = 12.dp, vertical = 14.dp)`, что и у реального поля ввода) и
 * некликабельная, с надписью "не требуется" (шрифт `unneededTextFontScaleFixed`, 145%),
 * центрированной ИМЕННО в границах этой области — а не поверх подписи+рамки вместе, как
 * было раньше в `MaybeUnneededField`.
 * **Цвет текста "не требуется" — версия 23, ИЗМЕНЕНО по явной просьбе пользователя**: до
 * версии 23 текст рисовался ПОЛНОСТЬЮ непрозрачным `onSurfaceVariant` (версия 20 — снижение
 * альфы СВЕТЛИТ текст, а не затемняет, поэтому альфа сознательно не применялась к этому
 * читаемому сообщению). Версия 23 добавляет `.copy(alpha = unneededTextAlpha)` (0.7)
 * ПО ПРЯМОЙ ПРОСЬБЕ пользователя — текст теперь сидит поверх уже приглушённой плашки
 * (см. ниже), а не поверх карточки напрямую, поэтому дополнительное лёгкое "притушение"
 * самого текста читается иначе, чем в версии 19 (где то же самое делалось поверх ПРОСТО
 * фона карточки и визуально "высветляло" текст) — умеренное значение 0.7 выбрано, чтобы
 * текст оставался разборчивым.
 * **Фон плашки — ИСПРАВЛЕНО (версия 22, item 2; альфа скорректирована пользователем в
 * версии 23)**: версия 21 красила фон в `colorScheme.surface.copy(alpha =
 * unneededShadeAlpha)`, но карточка подраздела САМА залита тем же `colorScheme.surface` —
 * тот же цвет поверх того же цвета визуально не затеняет вообще (в версиях 17-20 контраст
 * брался не от цвета плашки, а от того, что под ней было видно НАСТОЯЩЕЕ поле). Версия 22
 * заменила фон на `colorScheme.onSurface` (контрастный тон) с низкой альфой
 * `unneededBoxTintAlpha` (Material3-паттерн неактивного контейнера) — пользователь напрямую
 * отредактировал значение на устройстве, `0.12f → 0.10f` (версия 23, чуть менее
 * интенсивный оттенок). Рамка при `!needed` тоже приглушена (`outline.copy(alpha =
 * unneededLabelAlpha)`), чтобы не выглядеть как активное поле в фокусе.
 * **Подпись поля (label) — ЗАТЕМНЕНА при `!needed` (версия 22, item 2)**: пользователь
 * попросил, чтобы подпись НАД рамкой (например, "Возраст, лет") тоже выглядела
 * приглушённой, когда поле не нужно — раньше (версия 21) она всегда рисовалась в обычном
 * цвете независимо от `needed`. Теперь при `!needed` цвет подписи —
 * `onSurfaceVariant.copy(alpha = unneededLabelAlpha)`. Это НЕ противоречит выводу версии
 * 20 ("alpha светлит, не затемняет") — там речь была о ЧИТАЕМОМ сообщении "не требуется",
 * которое обязано оставаться разборчивым; подпись здесь, наоборот, второстепенный элемент,
 * и её "выцветание"/приглушение через альфу — обычный и ожидаемый способ показать, что
 * элемент неактивен.
 */
@Composable
private fun NumberField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    keyboardType: KeyboardType,
    needed: Boolean = true,
    modifier: Modifier = Modifier
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()
    val borderColor = if (isFocused) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline
    val borderWidth = if (isFocused) 2.dp else 1.dp
    val textColor = MaterialTheme.colorScheme.onSurface

    Column(modifier = modifier) {
        Text(
            label,
            style = MaterialTheme.typography.bodySmall,
            color = if (needed) {
                MaterialTheme.colorScheme.onSurfaceVariant
            } else {
                MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = unneededLabelAlpha)
            },
            modifier = Modifier.padding(start = 4.dp, bottom = 4.dp)
        )
        if (needed) {
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = true,
                textStyle = MaterialTheme.typography.bodyLarge.copy(color = textColor),
                keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
                cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                interactionSource = interactionSource,
                modifier = Modifier
                    .fillMaxWidth()
                    .border(borderWidth, borderColor, RoundedCornerShape(4.dp))
                    .padding(horizontal = 12.dp, vertical = 14.dp)
            )
        } else {
            val unneededFontSize = MaterialTheme.typography.bodySmall.fontSize * unneededTextFontScaleFixed
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(4.dp))
                    .background(MaterialTheme.colorScheme.onSurface.copy(alpha = unneededBoxTintAlpha))
                    .border(
                        1.dp,
                        MaterialTheme.colorScheme.outline.copy(alpha = unneededLabelAlpha),
                        RoundedCornerShape(4.dp)
                    )
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = {}
                    )
                    .padding(horizontal = 12.dp, vertical = 14.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    "не требуется",
                    style = MaterialTheme.typography.bodySmall.copy(
                        fontSize = unneededFontSize,
                        lineHeight = unneededFontSize
                    ),
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = unneededTextAlpha),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

/**
 * Компактный переключатель пола: кнопки-иконки (без текстовой подписи, без рамки и
 * фона), картинка зависит от состояния — активная/неактивная (см.
 * drawable/ic_sex_*_active.xml и ic_sex_*_inactive.xml, цвет активного/неактивного
 * состояния уже "зашит" в сам файл). Внешний контейнер каждой кнопки по-прежнему
 * занимает ту же область, что и раньше (`weight(1f).fillMaxHeight()`, высота — из
 * modifier родителя, подогнана под поле "Возраст" через IntrinsicSize.Min), поэтому
 * иконки остаются на прежнем месте по центру бывших кнопок — но кликабельна и видна
 * только сама иконка (её фактическая площадь), а не вся прежняя прямоугольная область.
 */
@Composable
private fun SexToggle(
    sex: Sex?,
    onSexChange: (Sex) -> Unit,
    isDarkTheme: Boolean,
    enabled: Boolean = true,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        SexToggleButton(
            contentDescription = "Муж",
            activeIconRes = if (isDarkTheme) R.drawable.ic_sex_male_active_dark else R.drawable.ic_sex_male_active,
            inactiveIconRes = if (isDarkTheme) R.drawable.ic_sex_male_inactive_dark else R.drawable.ic_sex_male_inactive,
            // Если поле не нужно текущим формулам (item 2, версия 18) — обе иконки
            // показываются как "inactive", независимо от выбранного пола, без надписи.
            selected = enabled && sex == Sex.MALE,
            onClick = { if (enabled) onSexChange(Sex.MALE) },
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
        )
        SexToggleButton(
            contentDescription = "Жен",
            activeIconRes = if (isDarkTheme) R.drawable.ic_sex_female_active_dark else R.drawable.ic_sex_female_active,
            inactiveIconRes = if (isDarkTheme) R.drawable.ic_sex_female_inactive_dark else R.drawable.ic_sex_female_inactive,
            selected = enabled && sex == Sex.FEMALE,
            onClick = { if (enabled) onSexChange(Sex.FEMALE) },
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
        )
    }
}

@Composable
private fun SexToggleButton(
    contentDescription: String,
    activeIconRes: Int,
    inactiveIconRes: Int,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    // Контейнер центрирует иконку в прежней области (без изменений расположения).
    Box(
        modifier = modifier.fillMaxHeight(),
        contentAlignment = Alignment.Center
    ) {
        // Круглая кликабельная зона МЕНЬШЕ видимой иконки (65dp против 70dp визуала) —
        // рисуется первой (снизу), с обычным ripple-эффектом, обрезанным по кругу.
        Box(
            modifier = Modifier
                .size(65.dp)
                .clip(CircleShape)
                .clickable(onClick = onClick)
        )
        // Сама иконка (70dp) рисуется поверх и НЕ имеет своих pointer-input модификаторов,
        // поэтому клики "проходят сквозь" неё к круглой зоне ниже — визуальный размер
        // иконки остаётся больше кликабельной области.
        Image(
            painter = painterResource(id = if (selected) activeIconRes else inactiveIconRes),
            contentDescription = contentDescription,
            modifier = Modifier.size(70.dp)
        )
    }
}

// Фиксированный масштаб шрифта подписей "Клинические признаки" (версия 16) — раньше был
// редактируемым через UI (версия 15), зафиксирован на 95% и настройка удалена по просьбе
// пользователя.
private const val clinicalFontScaleFixed = 0.95f

@Composable
private fun YesNoRow(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth()
    ) {
        Checkbox(checked = checked, onCheckedChange = onCheckedChange)
        // Межстрочный интервал держится в фиксированном отношении к размеру шрифта —
        // без этого при переносе на 2 строки между строками виден большой зазор
        // (особенно заметно при увеличенном системном размере шрифта на телефоне).
        val scaledFontSize = MaterialTheme.typography.bodyLarge.fontSize * clinicalFontScaleFixed
        Text(
            label,
            modifier = Modifier.weight(1f),
            style = MaterialTheme.typography.bodyLarge.copy(
                fontSize = scaledFontSize,
                lineHeight = scaledFontSize * 1.2f
            )
        )
    }
}

/**
 * `borderColor` (версия 19, item 3) — тонкая (1dp) обводка выпадающего меню в тон текущей
 * теме: тот же цвет, что и у полосы "Результаты"/верхней полосы (`toneAdjustedAccentColor`
 * с сайта вызова — см. `CardioScreen`).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun KillipSelector(killip: Killip, borderColor: Color, onKillipChange: (Killip) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    // Небольшие ОДИНАКОВЫЕ отступы (8dp) от ЭКРАНА с обеих сторон меню (версия 16, item 4):
    // поле "Класс ОСН" само по себе уже отступает от края экрана на 32dp (16dp — внешняя
    // прокручиваемая колонка + 16dp — Column этого подраздела), а обычный
    // `ExposedDropdownMenu` без явного смещения "прилипает" левым краем к полю и, если
    // не помещается по ширине экрана, обрезается СПРАВА (правый край упирался почти
    // вплотную в границу экрана, левый — нет). Поэтому используется обычный `DropdownMenu`
    // (не `ExposedDropdownMenu`) с явным `offset`, чтобы задать положение точно: левый край
    // меню — 8dp от края экрана, ширина — во весь экран минус эти 8dp с каждой стороны.
    val screenWidthDp = LocalConfiguration.current.screenWidthDp
    val menuMargin = 8.dp
    val anchorLeftOffset = 32.dp // 16dp (прокручиваемая колонка) + 16dp (Column подраздела)
    val menuWidth = (screenWidthDp.dp - menuMargin * 2)
    val menuOffsetX = menuMargin - anchorLeftOffset
    // Высота строки пункта меню (версия 20, item 1): Material3 `DropdownMenuItem` по
    // умолчанию не даёт высоте упасть ниже 48dp (встроенный minHeight), сколько бы ни
    // уменьшать `contentPadding` — поэтому высота меняется явным `heightIn(min = ...)` на
    // самом пункте. Значение подобрано компактнее дефолта; легко подправить в одном месте.
    val killipMenuItemMinHeight = 40.dp
    // Высота ЗАКРЫТОЙ строки-селектора (версия 21, item 1, ИСПРАВЛЕНО): версия 20 меняла
    // только высоту строк ВНУТРИ раскрытого списка (см. `killipMenuItemMinHeight` выше) —
    // высота самой закрытой строки (видна всегда, с текущим выбранным значением) не
    // менялась, т.к. использовался стандартный `OutlinedTextField`, у которого есть
    // встроенный нижний предел высоты через внутренние отступы Material3, не убираемый
    // публичными параметрами конструктора (та же причина, по которой `NumberField` уже
    // построен на компактной рамке с `BasicTextField`, а не на `OutlinedTextField` — см.
    // комментарий у `NumberField`). Поэтому здесь применён тот же паттерн: закрытая строка
    // — обычная рамка (`Row` с текстом и иконкой) с явными отступами, без встроенного
    // Material3-минимума.
    val killipClosedRowVerticalPadding = 10.dp
    Column {
        ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
            Row(
                // Версия 22, ИСПРАВЛЕНО: без явного `.clickable` — `.menuAnchor()` сам по
                // себе уже открывает/закрывает меню по тапу на закрытой строке (именно так
                // работал прежний `OutlinedTextField` — у него тоже не было ручного onClick).
                // Версия 21 добавила СВОЙ `.clickable { expanded = !expanded }` поверх — это
                // вызывало двойное переключение на каждый тап (встроенный обработчик
                // `menuAnchor()` + наш) и меню визуально переставало открываться вовсе.
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor()
                    .clip(RoundedCornerShape(4.dp))
                    .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(4.dp))
                    .padding(horizontal = 12.dp, vertical = killipClosedRowVerticalPadding),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    killip.label,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                Icon(
                    Icons.Filled.KeyboardArrowDown,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            DropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false },
                offset = DpOffset(x = menuOffsetX, y = 0.dp),
                modifier = Modifier
                    .width(menuWidth)
                    .border(1.dp, borderColor, RoundedCornerShape(4.dp))
            ) {
                Killip.entries.forEach { option ->
                    DropdownMenuItem(
                        text = {
                            Text(
                                option.label,
                                maxLines = 1
                            )
                        },
                        onClick = {
                            onKillipChange(option)
                            expanded = false
                        },
                        modifier = Modifier.heightIn(min = killipMenuItemMinHeight)
                    )
                }
            }
        }
    }
}

/** Строка-комментарий в блоке "Результаты": второстепенные детали и расшифровка формул (мельче основного шрифта). */
@Composable
private fun ResultComment(text: String) {
    Text(
        text,
        style = resultTextStyle,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
}

@Composable
private fun MissingDataHint(fields: String) {
    Text(
        "Заполните: $fields",
        style = resultTextStyle,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
}
