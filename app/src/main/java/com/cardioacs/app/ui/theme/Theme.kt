package com.cardioacs.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

// Фиксированная цветовая схема по требованиям заказчика:
// фон экрана — CardioBackground, фон блоков (Card) — белый (CardioSurface),
// цвет выделения/галочек/радиокнопок — CardioPrimary.
private val LightAppColorScheme = lightColorScheme(
    primary = CardioPrimary,
    onPrimary = CardioSurface,
    secondary = CardioPrimary,
    onSecondary = CardioSurface,
    background = CardioBackground,
    onBackground = CardioOnSurface,
    surface = CardioSurface,
    onSurface = CardioOnSurface,
    surfaceVariant = CardioSurface,
    onSurfaceVariant = CardioOnSurface
)

// Тёмная тема: тёмно-серый фон и блоки, гармонирующие друг с другом.
private val DarkAppColorScheme = darkColorScheme(
    primary = CardioDarkPrimary,
    onPrimary = CardioDarkOnPrimary,
    secondary = CardioDarkPrimary,
    onSecondary = CardioDarkOnPrimary,
    background = CardioDarkBackground,
    onBackground = CardioDarkOnSurface,
    surface = CardioDarkSurface,
    onSurface = CardioDarkOnSurface,
    surfaceVariant = CardioDarkSurface,
    onSurfaceVariant = CardioDarkOnSurfaceVariant,
    outline = CardioDarkOutline
)

@Composable
fun CardioACSTheme(darkTheme: Boolean = false, content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkAppColorScheme else LightAppColorScheme,
        typography = Typography,
        content = content
    )
}
