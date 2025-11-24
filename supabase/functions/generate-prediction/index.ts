import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { matchData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating AI prediction for match:', matchData.id);

    // Prepare detailed prompt with all statistics
    const team1Form = matchData.team1Recent.map((m: any) => (m.result === 'win' ? 'W' : 'L')).join('');
    const team2Form = matchData.team2Recent.map((m: any) => (m.result === 'win' ? 'W' : 'L')).join('');

    const team1Players = matchData.team1.players?.map((p: any) => `${p.name} (${p.role})`).join(', ') || 'Состав неизвестен';
    const team2Players = matchData.team2.players?.map((p: any) => `${p.name} (${p.role})`).join(', ') || 'Состав неизвестен';

    const h2hInfo = matchData.headToHead?.matches?.length > 0
      ? `H2H за последние 6 месяцев: ${matchData.team1.name} ${matchData.headToHead.team1Wins} - ${matchData.headToHead.team2Wins} ${matchData.team2.name}`
      : 'H2H данные отсутствуют';

    const matchDataJson = JSON.stringify(matchData, null, 2);

    const prompt = `Ты — топ-аналитик по киберспорту ${matchData.game}, эксперт с опытом работы в профессиональных командах и на турнирах высокого уровня.

ПРИМЕР ПОЛНОГО АНАЛИТИЧЕСКОГО ОТЧЁТА (используй как шаблон для структуры и детальности):

**Матч: Team Spirit vs Team Liquid (Dota 2, BetBoom Dacha, 22.11 17:00 МСК)**

### Составы и ключевые игроки

Team Spirit выставляет свой классический состав с Collapse на офлейне (KDA 5.2, 68% винрейт на героях-инициаторах), Larl на миде (KDA 4.8, специализация на темповых героях) и Yatoro на керри (KDA 6.1, феноменальная стабильность в фарме). Этот трио показывает исключительную синергию в последних матчах, особенно в затяжных играх.

Liquid противопоставляет miCKe на керри (KDA 4.1, склонность к агрессивным пикам) и Nisha на миде (KDA 3.9, непостоянная форма). Слабым звеном Liquid остаётся офлейн, где команда регулярно проигрывает линию против топ-офлейнеров вроде Collapse.

### H2H и историческое противостояние

За последние 6 месяцев Spirit доминирует в противостоянии с Liquid — 7-3 в прямых встречах. Средний счёт 2-1 в пользу Spirit показывает, что даже когда Liquid выигрывают карту, им сложно закрывать серию. В ключевые моменты Spirit демонстрируют лучшую координацию и decision-making.

Детальный анализ последних встреч показывает, что Spirit выигрывают через доминирование в early-game (средняя разница +1200 gold к 15-й минуте) и контроль над Roshan. Liquid же пытаются компенсировать слабый лейнинг через успешные ганги, но статистика показывает лишь 38% успешных инициаций против Spirit.

### Анализ карт и винрейты

На ожидаемых картах Ancient и Nuke статистика категорична: Spirit показывают 72% винрейт против 41% у Liquid за последние 3 месяца. Spirit отлично контролируют Roshan на этих картах благодаря превосходному ward coverage и способности быстро реагировать на инициации противника. Их понимание тайминга push'ей и дефа на этих картах — одно из лучших в регионе.

Liquid на этих картах испытывают проблемы с контролем карты в mid-game. Их типичная стратегия split-push часто не срабатывает против агрессивного five-man style Spirit.

### Форма команд и текущий контекст

**Spirit**: WWLWW — команда в отличной форме после короткого спада. Последние две победы показывают, что они вернули уверенность и командную игру. Средняя разница по голду +800 в победных матчах говорит о стабильном контроле игры.

**Liquid**: LWWWL — непостоянная форма. Поражение в последнем матче выявило старые проблемы с лейнингом (-800 gold avg к 10-й минуте). Три победы подряд были против слабых оппонентов, что не даёт полной картины реальной формы команды.

### Тактические аспекты и пики/баны

Spirit, скорее всего, забанят Mars и Beastmaster — любимые пики Liquid для early aggression. В ответ Liquid должны убрать Razor и Slardar — ключевых героев Collapse для доминирования на линии.

Первый пик Spirit, вероятно, будет темповый мид-герой для Larl (Storm Spirit, Puck), чтобы создавать давление по карте. Liquid придётся отвечать безопасным пиком керри (Faceless Void, Morphling) для miCKe, чтобы гарантировать фарм.

Ключевое противостояние: Collapse vs офлейнер Liquid. Если Spirit выиграют эту линию, как показывает статистика (+2000 gold avg в победных матчах), Liquid будет крайне сложно вернуться в игру. Единственный шанс Liquid — успешный ранний сноуболл через координированные четвёркой ганги на Yatoro, но у Spirit отличное vision control, что делает это затруднительным.

### Прогноз и вероятности

**Team Spirit: 68%** — Явное преимущество по всем параметрам: H2H (7-3), винрейт на картах (72% vs 41%), текущая форма (WWLWW vs LWWWL), доминирование в лейнинге. Spirit имеют психологическое преимущество и лучше понимают тактические нюансы противостояния с Liquid.

**Team Liquid: 32%** — Шансы есть только при идеальном драфте и ранней агрессии. Требуется максимальная концентрация и безошибочная игра уже с первых минут. Любая ошибка на лейнинге приведёт к снежному кому в пользу Spirit.

---

ТЕПЕРЬ ПОЛУЧИ ДАННЫЕ О НОВОМ МАТЧЕ И СОЗДАЙ АНАЛОГИЧНЫЙ ДЕТАЛЬНЫЙ ОТЧЁТ (500+ слов, обязательно используй markdown для структуры: заголовки, жирный/курсивный текст, списки).

Данные матча (JSON):
${matchDataJson}

Текстовое описание:
Матч: ${matchData.team1.name} vs ${matchData.team2.name}
Турнир: ${matchData.tournament}
Игра: ${matchData.game}
Формат: Bo${matchData.bestOf || 1}
Дата: ${matchData.startTime}

Составы:
${matchData.team1.name}: ${team1Players}
${matchData.team2.name}: ${team2Players}

${h2hInfo}

Winrate (последние 3 месяца):
${matchData.team1.name}: ${matchData.mapWinrates?.team1 || 0}%
${matchData.team2.name}: ${matchData.mapWinrates?.team2 || 0}%

Форма (последние 5 матчей):
${matchData.team1.name}: ${team1Form}
${matchData.team2.name}: ${team2Form}

Последние результаты ${matchData.team1.name}:
${matchData.team1Recent.map((m: any) => `${m.date} vs ${m.opponent}: ${m.result === 'win' ? 'W' : 'L'} (${m.score})`).join('\n')}

Последние результаты ${matchData.team2.name}:
${matchData.team2Recent.map((m: any) => `${m.date} vs ${m.opponent}: ${m.result === 'win' ? 'W' : 'L'} (${m.score})`).join('\n')}

ТРЕБОВАНИЯ К ОТЧЁТУ:
1. Объём 500-700 слов минимум (не укорачивай!)
2. Используй markdown для структуры: ### заголовки, **жирный** для важного, *курсив* для акцентов, списки
3. Обязательные секции:
   - ### Составы и ключевые игроки (детальный анализ каждой роли)
   - ### H2H и историческое противостояние (если есть данные)
   - ### Анализ карт/мап и винрейты (специфика для игры)
   - ### Форма команд и текущий контекст (детали последних матчей)
   - ### Тактические аспекты (пики/баны для MOBA, стратегии для CS2/Valorant)
   - ### Прогноз и вероятности (обоснование процентов)
4. Проценты должны быть логичными: если H2H 8-2 И винрейт 70%, то вероятность >65%
5. Используй знания о мете, игроках, командах из твоей базы знаний
6. НИКОГДА не пиши "недостаточно данных" — всегда давай полный анализ

Ответ СТРОГО в формате JSON:
{
  "team1Probability": <число 0-100>,
  "team2Probability": <число 0-100>,
  "analysis": "<полный markdown-отчёт 500-700 слов с заголовками, форматированием, списками>"
}`;

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content:
              'Ты эксперт по анализу киберспортивных матчей. У тебя есть доступ к собранной статистике и собственной базе знаний. Даже при неполных данных НИКОГДА не отвечай, что недостаточно данных — всегда давай развёрнутый анализ и вероятности. Отвечай только на русском языке в формате JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your Lovable AI workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI generation failed' }),
        { status: aiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    console.log('AI response received:', content.substring(0, 100));

    // Parse JSON from AI response
    let prediction;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || 
                       content.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      prediction = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Fallback: create a basic prediction
      prediction = {
        team1Probability: 50,
        team2Probability: 50,
        analysis: content || 'Не удалось сгенерировать прогноз. Попробуйте снова.',
      };
    }

    // Ensure probabilities sum to 100
    if (prediction.team1Probability + prediction.team2Probability !== 100) {
      const total = prediction.team1Probability + prediction.team2Probability;
      if (total > 0) {
        prediction.team1Probability = Math.round((prediction.team1Probability / total) * 100);
        prediction.team2Probability = 100 - prediction.team1Probability;
      } else {
        prediction.team1Probability = 50;
        prediction.team2Probability = 50;
      }
    }

    console.log('Prediction generated successfully');

    return new Response(
      JSON.stringify(prediction),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-prediction function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
