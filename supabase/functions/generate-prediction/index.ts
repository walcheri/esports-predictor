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
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    
    if (!OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY not configured');
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

    const systemPrompt = `Ты — легендарный русскоязычный аналитик киберспорта (уровень Thoorin + launders + SPUNJ + YNk вместе взятые).
Пишешь невероятно убедительно, с историями и драматургией, без шаблонов и воды. Каждое утверждение обосновываешь фактами и статистикой.
Объём отчёта: 1200–2000 слов. 
Стиль: Профессионально, но с личностью. Используй markdown: **жирный**, *курсив*, таблицы, списки, эмодзи (умеренно).
ОБЯЗАТЕЛЬНО: Используй свои знания о профессиональных игроках, командах, их истории, стилях игры на конкретных картах. Анализируй как настоящий эксперт, а не обобщай.`;

    const userPrompt = `Разбери матч **${matchData.team1.name} vs ${matchData.team2.name}** (${matchData.game}, ${matchData.tournament}, ${matchData.startTime})

📊 **Данные PandaScore и твои профессиональные знания:**
${matchDataJson}

**Составы:**
- ${matchData.team1.name}: ${team1Players}
- ${matchData.team2.name}: ${team2Players}

**H2H:** ${h2hInfo}

**Winrate (последние 3 месяца):**
- ${matchData.team1.name}: ${matchData.mapWinrates?.team1 || 'N/A'}%
- ${matchData.team2.name}: ${matchData.mapWinrates?.team2 || 'N/A'}%

**Форма (последние 5 матчей):**
- ${matchData.team1.name}: ${team1Form}
- ${matchData.team2.name}: ${team2Form}

**Последние результаты ${matchData.team1.name}:**
${matchData.team1Recent.map((m: any) => `  • ${m.date} vs ${m.opponent}: ${m.result === 'win' ? '✅ WIN' : '❌ LOSS'} (${m.score})`).join('\n')}

**Последние результаты ${matchData.team2.name}:**
${matchData.team2Recent.map((m: any) => `  • ${m.date} vs ${m.opponent}: ${m.result === 'win' ? '✅ WIN' : '❌ LOSS'} (${m.score})`).join('\n')}

---

🎯 **СТРУКТУРА ОТЧЁТА (1500+ слов, максимально глубоко и убедительно):**

## 1. 🎮 Составы + Стиль Игроков на Картах (400+ слов)
Для КАЖДОГО игрока (минимум топ-3 каждой команды):
- Роль, возраст, основное оружие/агент/чемпион
- **ГЛАВНОЕ**: Конкретный стиль на конкретных картах. Примеры:
  * "nafany на Dust2: *агрессивные entry через Long A (успех 72%), но слабеет на eco-раундах*"
  * "electronic на Mirage: *доминирует AWP-дуэли на mid (65% headshots vs top AWPers), но уязвим на Inferno B-site*"
  * "Collapse на Ancient (Dota): *signature hero Axe, 8.2 KDA, clutch initiation в 80% teamfights*"
- Текущий рейтинг (HLTV 2.0 / Liquipedia / твои знания): 1.15, 1.22, и т.д.
- KDA, impact rating, ключевые метрики за 3 месяца
- **Микро-анализ**: В каких позициях игрок проваливается? Где непобедим?

## 2. 🧠 Стиль Игры Команд: Микро + Макро (300+ слов)
- Общий стиль: *Агрессивный rush / Контрольный slow / Хаотичный execute / Структурированный defaults*
- **Тактика на картах** (конкретно):
  * ${matchData.team1.name} на Mirage: "Предпочитают CT-hold B-site + ротация через mid. T-side: часто фейк A → execute B (75% успеха)"
  * ${matchData.team2.name} на Ancient: "Агрессивная CT aggro на mid, но слабая защита A-site против split"
- Любимые тайминги, дефолты, исполнение стратегий
- **Слабые места**: Где команды ломаются?

## 3. 🗺️ Разбор по Картам: Дуэли + Позиции (400+ слов)
Для каждой карты в map pool (топ-5 карт минимум):
- % побед команд за 3–6 месяцев (используй свои знания + данные)
- **Ключевые дуэли** (примеры):
  * "s1mple vs ZywOo на Overpass A-site: *ZywOo выигрывает 58% long-range AWP дуэлей*"
  * "GANK's nafany vs PCIFIC's AWPer на Dust2 mid: *nafany быстрее на peek (0.2s avg), но проигрывает post-plant*"
- Средний раундов за карту: CT/T стороны отдельно (15-12, 10-5 CT/T, и т.д.)
- **Лучшие и худшие позиции** каждой команды на карте:
  * ${matchData.team1.name} на Mirage: сильные B-apps hold, слабые A-retakes
  * ${matchData.team2.name} на Inferno: доминируют banana control, но теряют arch battles

## 4. 📋 Личные Встречи: Таблица + Контекст (200+ слов)
Создай таблицу последних 8–10 матчей (если есть в твоих знаниях):

| Дата       | Турнир          | Карта/Счёт        | Результат | MVP         | Ключевой момент                     |
|------------|------------------|-------------------|-----------|-------------|-------------------------------------|
| 12.11.2024 | ESL Pro League  | Mirage 16-14      | ${matchData.team1.name} WIN | electronic  | Clutch 1v3 от electronic на A-site  |
| ...        | ...              | ...               | ...       | ...         | ...                                 |

**Контекст**: Почему ${matchData.team1.name} выигрывает/проигрывает последние встречи? Есть ли паттерн (карты, стратегии)?

## 5. 🔥 Форма + Психология: Тильт или Confidence? (200+ слов)
- Последние 10 матчей каждой команды: W/L + счёт (детально)
- **Психологическое состояние**:
  * Есть ли замены? Скамейка? Драма в команде (например, конфликт IGL с frag hunter)?
  * Кто в *insane форме* (например: "electronic 1.35 rating последние 3 турнира")?
  * Есть ли *тильт* после проигрышей? (например: "${matchData.team2.name} проиграли 3 подряд после замены AWPera")

## 6. 🎬 Сюжетные Линии: Драма + Реванш (150+ слов)
- Это реванш за прошлый турнир?
- Бывшие тиммейты играют друг против друга?
- Скандалы, конфликты, мотивация (например: "nafany vs его бывшая команда — эмоции зашкаливают")
- Исторический контекст: кто доминировал в этом matchup раньше?

## 7. 🎯 Тактика: Пики/Баны + Стратегии (200+ слов)
- **Предсказание pick/ban фазы**:
  * Что скорее всего забанят друг другу (и почему)?
  * Пермапики: ${matchData.team1.name} — Mirage (68% winrate), ${matchData.team2.name} — Ancient (75%)
- **Возможные сюрпризы**:
  * Неожиданные стратегии (например: "PCIFIC может удивить агрессивным Nuke pick")
  * Антистратегии (counter-picks на основе H2H)

## 8. 🏆 ФИНАЛЬНЫЙ ПРОГНОЗ (150+ слов + проценты жирным)
**Проценты победы** (жирным, например):
**${matchData.team1.name} — 68% | ${matchData.team2.name} — 32%**

**Обоснование** (логическое, на основе всего анализа):
- H2H: ${matchData.team1.name} выигрывают 6 из последних 10 встреч
- Форма: ${matchData.team1.name} в лучшей форме (WWLWW vs LWLWL)
- Карты: ${matchData.team1.name} доминируют на Mirage/Dust2 (вероятные пики)
- Игроки: electronic + nafany в *insane форме* (1.30+ rating)
- **НО**: ${matchData.team2.name} могут удивить на Ancient/Nuke

**Самый вероятный счёт**: 2-1 для ${matchData.team1.name} (карты: Mirage WIN, Ancient LOSS, Dust2 WIN)

**MVP prediction**: electronic (${matchData.team1.name}) — 1.40+ rating, 25+ frags на Mirage

---

⚠️ **КРИТИЧЕСКИ ВАЖНО**:
- **НЕ пиши** "к сожалению, нет данных" или "информация недоступна"
- **ВСЕГДА** давай конкретный анализ на основе своих знаний о профессиональных командах/игроках
- Проценты должны быть **логичными** и основанными на статистике (если H2H 8-2 + winrate 70%, то победа НЕ может быть 51%)
- Пиши с **драматургией и убедительностью**: "Это будет эпичное противостояние! electronic против своего бывшего напарника nafany..."
- Используй **эмодзи умеренно** (🔥💪✅❌🎯) для акцентов

📄 **Ответ СТРОГО в формате JSON:**
{
  "team1Probability": <число 0-100>,
  "team2Probability": <число 0-100>,
  "analysis": "<полный markdown-отчёт 1500+ слов с заголовками ##, форматированием **жирным**, *курсивом*, таблицами, списками, эмодзи>"
}`;

    // Call OpenRouter with Llama 3.1 405B (most powerful free model)
    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://esports-predictor.lovable.app',
        'X-Title': 'Esports Predictor',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-405b-instruct',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        max_tokens: 4096,
        temperature: 0.8,
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
      console.error('OpenRouter AI error:', aiResponse.status, errorText);
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
      let jsonStr = content;
      
      // Remove markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      
      // Try to find JSON object pattern
      const objectMatch = jsonStr.match(/\{[\s\S]*"team1Probability"[\s\S]*"team2Probability"[\s\S]*"analysis"[\s\S]*\}/);
      if (objectMatch) {
        jsonStr = objectMatch[0];
      }
      
      // Clean up the JSON string - escape problematic characters in analysis
      // First, try direct parse
      try {
        prediction = JSON.parse(jsonStr);
      } catch {
        // If direct parse fails, try to extract values manually
        const team1Match = jsonStr.match(/"team1Probability"\s*:\s*(\d+)/);
        const team2Match = jsonStr.match(/"team2Probability"\s*:\s*(\d+)/);
        const analysisMatch = jsonStr.match(/"analysis"\s*:\s*"([\s\S]*?)(?:"\s*}|\"\s*,\s*")/);
        
        if (team1Match && team2Match) {
          prediction = {
            team1Probability: parseInt(team1Match[1]),
            team2Probability: parseInt(team2Match[1]),
            analysis: analysisMatch ? analysisMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : 'Анализ недоступен. Попробуйте снова.',
          };
        } else {
          throw new Error('Could not extract prediction values');
        }
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Fallback: create a basic prediction with the raw content as analysis
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
