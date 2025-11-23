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

    const prompt = `Ты — профессиональный аналитик по киберспорту ${matchData.game}.

ПРИМЕР КАЧЕСТВЕННОГО АНАЛИЗА (используй как шаблон для стиля и глубины):

Матч: Team Spirit vs Team Liquid (Dota 2, BetBoom Dacha, 22.11 17:00 МСК)
Составы: Spirit — Collapse (Offlane, KDA 5.2), Larl (Mid, KDA 4.8), Yatoro (Carry, KDA 6.1) | Liquid — miCKe (Carry, KDA 4.1), Nisha (Mid, KDA 3.9)
H2H: Spirit 7-3 за последние 6 месяцев (средний счёт 2-1)
Winrate на картах Ancient/Nuke: Spirit 72%, Liquid 41%
Форма: Spirit WWLWW (+1200 gold avg early game) | Liquid LWWWL (-800 gold, слабый лейнинг)

Анализ:
Team Spirit демонстрирует убедительное преимущество в прямых встречах с Liquid, выиграв 7 из последних 10 матчей. Ключевым фактором является доминирование Collapse на линии против слабого офлейнера Liquid — в последних встречах разница по нетворсу к 15-й минуте составляла в среднем +2000 золота. Yatoro на керри показывает феноменальную стабильность (KDA 6.1), что критично для поздней игры Spirit.

Liquid испытывают серьёзные проблемы на лейнинге стейдже — их средняя разница по голду к 10-й минуте составляет -800, что заставляет команду постоянно играть от обороны. Nisha на миде не справляется с агрессивным стилем Larl, особенно на героях типа Puck или Storm Spirit. Единственный шанс Liquid — ранний сноуболл через успешные ганги на Yatoro, но статистика показывает низкую эффективность их четвёрки (38% successful ganks).

Карты Ancient/Nuke, на которых ожидается матч, исторически благоприятны для Spirit (72% винрейт против 41% у Liquid). Spirit отлично контролируют Roshan на этих картах и умеют растягивать игру в поздний этап, где их керри-кор Yatoro практически непобедим. Текущая форма команд (Spirit WWWLW vs Liquid LWWWL) подтверждает явный перевес в сторону действующих чемпионов.

Spirit: 68% (H2H + winrate на картах + текущая форма + преимущество в лейнинге)
Liquid: 32%

ТЕПЕРЬ ТЫ ПОЛУЧАЕШЬ ДАННЫЕ О НОВОМ МАТЧЕ. Проанализируй его ТАК ЖЕ ПОДРОБНО, используя ВСЮ доступную статистику, свои знания о командах, игроках, мете и тактике. НИКОГДА не пиши "недостаточно данных" — всегда давай развёрнутый анализ.

Данные матча (JSON):
${matchDataJson}

Текстовое описание:
Матч: ${matchData.team1.name} vs ${matchData.team2.name}
Турнир: ${matchData.tournament}
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

Напиши подробный анализ (3-4 абзаца, 300-500 слов):
- Анализ сильных/слабых сторон команд, ключевых игроков
- Тактические аспекты (пики/баны, стиль игры, фаза игры)
- H2H история и её значимость
- Влияние карты/формата на исход
- Форма команд и турнирный контекст

ВАЖНО: Если H2H показывает явное преимущество (70%+) И высокий winrate, вероятность должна быть >65%. Используй логику.

Ответ СТРОГО в формате JSON:
{
  "team1Probability": <число 0-100>,
  "team2Probability": <число 0-100>,
  "analysis": "<развёрнутый анализ 3-4 абзаца>"
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
