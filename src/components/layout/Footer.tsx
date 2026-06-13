export function Footer() {
  return (
    <footer className="border-t border-border bg-card/50 py-8">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          <strong className="text-foreground">Дисклеймер:</strong> Esports Predictor
          предоставляет аналитические прогнозы исключительно в информационных целях.
          Результаты основаны на статистических моделях и не гарантируют точность
          предсказаний. Сервис не является букмекерской конторой и не поощряет
          азартные игры. Используйте прогнозы на свой страх и риск.
        </p>
        <p className="mt-4 text-xs text-muted-foreground/60">
          © 2026 Esports Predictor. Все права защищены.
        </p>
      </div>
    </footer>
  )
}
