# Esports Predictor — Design System

Справочник визуального стиля. Источник правды для токенов: `src/index.css`.

## Концепция

Тёмный минималистичный интерфейс в духе киберспорта: почти чёрный фон, карточки чуть светлее, один яркий неоново-зелёный акцент. Ощущение «gaming dashboard» — glow на hover, gradient text в заголовках, плавные переходы.

## Цвета

| Роль | HEX | CSS-переменная |
|------|-----|----------------|
| Фон страницы | `#0E0E0E` | `--background` |
| Карточки / header | `#1A1A1A` | `--card` |
| Акцент бренда | `#00FFAA` | `--primary` |
| Границы | ~20% lightness | `--border` |
| Live-матч | красный | `--status-live` |
| Предстоящий | акцент | `--status-upcoming` |

Градиент акцента: `135deg` от `hsl(162 100% 50%)` к более тёмному оттенку.
Glow: `0 0 30px hsla(162 100% 50% / 0.3)`.

## Типографика

- **Montserrat** (300–800), подключён в `index.html`
- Основной текст: `text-foreground`, вторичный: `text-muted-foreground`
- Hero: крупный black weight, часть фразы — `bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent`

## Макет

```
┌─────────────────────────────────────────┐
│  Header (fixed, blur, border-b)         │
├─────────────────────────────────────────┤
│  Hero / контент (pt-32)                 │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐           │
│  │card│ │card│ │card│ │card│  grid 4col │
│  └────┘ └────┘ └────┘ └────┘           │
├─────────────────────────────────────────┤
│  Footer (disclaimer, border-t)          │
└─────────────────────────────────────────┘
```

- Контейнер центрирован, padding `2rem`, breakpoint `2xl: 1400px`
- Радиус скругления: `--radius: 0.75rem` (lg), карточки игр — `rounded-2xl`

## Ключевые UI-паттерны

### Header
- Логотип: квадрат 32×32, gradient primary, буква «E» на тёмном фоне
- Название: gradient text
- Навигация: hover → `text-primary`
- Premium: ghost-кнопка с crown-иконкой и glow на hover

### Карточка матча (MatchCard)
- Статус: badge live (красный + пульсирующая точка) / upcoming (зелёный)
- Команды: лого 64×64 в `rounded-lg bg-muted`, VS по центру
- Квалификатор: placeholder с `HelpCircle`, жёлтый badge «Квалификация»
- CTA: полноширинная кнопка «Анализировать» с arrow, group-hover primary

### Карточки дисциплин (главная)
- Gradient background per game, border-2, hover scale 105% + glow
- Иконка в полупрозрачном круге с backdrop-blur

### Страница матча
- Диаграммы (pie/bar) в тонах primary и game colors
- AI-отчёт в `.premium-report` — стилизованный markdown

### Модалки (Auth, Premium)
- Стандартные dialog из ui-kit, акцентные кнопки primary, outline с `border-primary/30`

## Игровые цвета (графики и акценты карточек)

| Игра | Цвет |
|------|------|
| CS2 | `#DE9B35` / primary |
| Dota 2 | `#F04747` |
| LoL | `#1E96FF` |
| Valorant | `#FF4654` |

## Анимации

- Страницы: `fade-in 0.3s ease-out` на `main`, `section`
- Интерактив: `transition-all duration-300`
- Live badge: `animate-pulse` на точке
- Кнопки: `group-hover:translate-x-1` на стрелках

## Язык интерфейса

Русский. Disclaimer в футере обязателен.
