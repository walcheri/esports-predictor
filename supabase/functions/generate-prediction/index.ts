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

У тебя есть данные, собранные из интернет-источников (API статистики) в формате JSON и краткое текстовое описание матча. Даже если какие-то поля в JSON пустые или отсутствуют, НЕ пиши, что недостаточно данных. Всегда делай обоснованный прогноз, используя имеющуюся статистику, свои знания и типичные паттерны матчей.

Структурированные данные о матче в формате JSON (используй их внимательно, даже если часть полей пустая):
${matchDataJson}

Краткое текстовое описание матча:
Матч: ${matchData.team1.name} vs ${matchData.team2.name}
Турнир: ${matchData.tournament}
Формат: Bo${matchData.bestOf || 1}
Дата: ${matchData.startTime}

Составы команд:
${matchData.team1.name}: ${team1Players}
${matchData.team2.name}: ${team2Players}

${h2hInfo}

Winrate на текущей карте/игре (за последние 3 месяца):
${matchData.team1.name}: ${matchData.mapWinrates?.team1 || 0}%
${matchData.team2.name}: ${matchData.mapWinrates?.team2 || 0}%

Форма команд (последние 5 матчей):
${matchData.team1.name}: ${team1Form}
${matchData.team2.name}: ${team2Form}

Последние матчи ${matchData.team1.name}:
${matchData.team1Recent.map((m: any) => `${m.date} против ${m.opponent}: ${m.result === 'win' ? 'Победа' : 'Поражение'} (${m.score})`).join('\n')}

Последние матчи ${matchData.team2.name}:
${matchData.team2Recent.map((m: any) => `${m.date} против ${m.opponent}: ${m.result === 'win' ? 'Победа' : 'Поражение'} (${m.score})`).join('\n')}

Дай подробный профессиональный анализ на русском языке (3-4 абзаца):
- Анализ сильных и слабых сторон каждой команды
- Ключевые игроки и их влияние на матч
- Важность карты/мэтчапа для каждой команды
- Факторы, которые могут повлиять на исход (форма, H2H история, турнирный контекст)

В конце дай точные проценты победы с учётом всей статистики.

ВАЖНО: Если H2H показывает явное преимущество одной команды (например, 8-2) и высокий winrate на карте (70%+), вероятность должна быть >70%. Используй логику и статистику.

Формат ответа должен быть строго JSON:
{
  "team1Probability": <число от 0 до 100>,
  "team2Probability": <число от 0 до 100>,
  "analysis": "<текст аналитического отчёта, 3-4 абзаца>"
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
