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

    const systemPrompt = `Ты — лучший русскоязычный аналитик киберспорта в мире (уровень Thoorin + launders + SPUNJ вместе взятые).
Пишешь невероятно подробно, красиво и убедительно. Никаких "к сожалению, нет данных" — всегда находишь информацию и делаешь глубокий анализ.
Объём отчёта: 1200–2000 слов. Используй жирный шрифт, курсив, таблицы, списки.`;

    const userPrompt = `Сделай УЛЬТРА-ДЕТАЛЬНЫЙ разбор предстоящего матча.

Матч: ${matchData.team1.name} vs ${matchData.team2.name}
Игра: ${matchData.game}
Турнир: ${matchData.tournament}
Формат: Bo${matchData.bestOf || 1}
Время: ${matchData.startTime}

Данные из PandaScore и других источников:
${matchDataJson}

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

Требования к отчёту (обязательно все пункты, очень подробно, 1200–2000 слов):

### 1. Составы и роль каждого игрока
• Укажи роль, возраст, пик оружия/агента/чемпиона
• Главная фишка игрока (например: "nafany — король clutch 1v2", "electronic — лучший AWP мира на Mirage")
• Текущий рейтинг HLTV 2.0 / Liquipedia rating (используй свои знания)
• KDA и impact rating за последние 3 месяца

### 2. Стиль игры каждой команды в целом
• Агрессивный/контрольный/хаотичный/структурированный
• Любимые тайминги, дефолты, исполнение

### 3. Глубокий разбор по картам (все возможные в пуле + пики)
• % побед каждой команды на карте за 3–6 месяцев
• Средний раундов за карту (CT/T стороны отдельно для шутеров)
• Ключевые дуэли (например: "s1mple vs ZywOo на Overpass A-site")
• Лучшие и худшие позиции игроков на каждой карте

### 4. Личные встречи (таблица последних 8–10 матчей, если есть в твоих знаниях)
| Дата       | Турнир          | Карта/Счёт | Результат | MVP         |
|------------|------------------|-----------|-----------|-------------|

### 5. Текущая форма и психологическое состояние
• Последние 10 матчей каждой команды (W/L + счёт)
• Есть ли тильт, скамейка, замены, драма в команде?
• Кто в лучшей жизненной форме?

### 6. Ключевые сюжетные линии матча
• Реванш? Бывшие тиммейты? Скандалы?
• Исторический контекст противостояния

### 7. Тактика и пики/баны
• Что скорее всего забанят друг другу
• Пермапики и комфорт-карты/герои
• Возможные сюрпризы и неожиданные стратегии

### 8. Финальный прогноз с обоснованием
• Проценты победы (жирным, например **FUT Esports — 74% | Team 2 — 26%**)
• Самый вероятный счёт (2-0, 2-1, карты)
• Лучший игрок матча (MVP prediction)

ВАЖНО:
- НЕ пиши "к сожалению, нет данных" или "информация недоступна" — ВСЕГДА давай анализ на основе своих знаний о профессиональных командах и игроках
- Проценты должны быть логичными и основанными на статистике и форме
- Используй markdown: **жирные заголовки**, *italic для акцентов*, списки, таблицы
- Пиши так, чтобы человек после прочтения сказал: "Блин, это реально лучше, чем на HLTV"
- В конце обязательно финальный прогноз жирным шрифтом

Ответ СТРОГО в формате JSON:
{
  "team1Probability": <число 0-100>,
  "team2Probability": <число 0-100>,
  "analysis": "<полный markdown-отчёт 1200-2000 слов с заголовками, форматированием, списками, таблицами>"
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
