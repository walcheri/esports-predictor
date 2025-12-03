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
    
    if (!matchData) {
      throw new Error('Match data is required');
    }

    const ARTEMOX_API_KEY = Deno.env.get('ARTEMOX_API_KEY');
    
    if (!ARTEMOX_API_KEY) {
      console.error('ARTEMOX_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Artemox API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const teamA = matchData.team1?.name || matchData.teamA || 'Team A';
    const teamB = matchData.team2?.name || matchData.teamB || 'Team B';
    const game = matchData.game || 'Unknown';
    const tournament = matchData.tournament || 'Unknown';
    const format = matchData.format || 'Bo3';
    const startTime = matchData.startTime || 'TBD';

    console.log('Starting Artemox prediction for:', teamA, 'vs', teamB);

    // Prepare PandaScore stats JSON
    const statsJson = JSON.stringify({
      matchId: matchData.id,
      teams: { team1: matchData.team1, team2: matchData.team2 },
      headToHead: matchData.headToHead,
      mapWinrates: matchData.mapWinrates,
      team1Recent: matchData.team1Recent,
      team2Recent: matchData.team2Recent,
      startTime: matchData.startTime,
    }, null, 2);

    const fullPrompt = `Ты — лучший русскоязычный аналитик киберспорта в мире (уровень launders + SPUNJ + Thorin). 
Сделай максимально объёмный и убедительный разбор матча на русском языке — минимум 1500 слов, лучше 2000–3000.

Матч: ${teamA} vs ${teamB}
Игра: ${game}
Турнир: ${tournament}, ${startTime}
Формат: ${format}

Данные из PandaScore (используй всё): ${statsJson}

Обязательно найди и включи в отчёт (самое свежее на сегодня):
- Полные составы с ролями, возрастом, текущим HLTV-рейтингом/KDA за 3–6 месяцев
- Стиль игры каждого ключевого игрока на основных картах (например: «electronic на Mirage — бог AWP с 68 % headshots и 1.42 rating»)
- Таблица личных встреч (последние 8–10 матчей)
- Winrate команд на всех картах пула + CT/T-сайд
- Форма команд (последние 5–7 матчей)
- Тактика, сильные/слабые стороны, возможные пики/баны
- Психология и сюжетные линии (тильт, реванш, драма)
- Финальный прогноз жирным шрифтом, например **${teamA} — 73 % | ${teamB} — 27 %** и предполагаемый счёт

Пиши красиво: markdown, таблицы, списки, эмодзи, драматургия. Никаких «нет данных» — всегда давай глубокий анализ.`;

    console.log('Sending request to Artemox API...');

    const response = await fetch('https://api.artemox.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ARTEMOX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{ role: 'user', content: fullPrompt }],
        max_tokens: 4096,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Artemox API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Превышен лимит запросов. Попробуйте позже.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Требуется оплата API.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Неверный API ключ Artemox.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Artemox API error: ${response.status}`);
    }

    const data = await response.json();
    const report = data.choices?.[0]?.message?.content || '';

    console.log('Artemox response received. Report length:', report.length, 'chars');

    // Extract probabilities from the report
    const probMatches = report.match(/(\d{1,3})\s*%/g) || [];
    let team1Probability = 50;
    let team2Probability = 50;

    if (probMatches.length >= 2) {
      const probs = probMatches.map((p: string) => parseInt(p.replace(/\s*%/, ''))).filter((p: number) => p > 0 && p <= 100);
      // Find two consecutive reasonable probabilities that sum close to 100
      for (let i = 0; i < probs.length - 1; i++) {
        const sum = probs[i] + probs[i + 1];
        if (sum >= 95 && sum <= 105) {
          team1Probability = probs[i];
          team2Probability = probs[i + 1];
          break;
        }
      }
    } else if (probMatches.length === 1) {
      // Only one percentage found - assume it's for team A
      const prob = parseInt(probMatches[0].replace(/\s*%/, ''));
      if (prob > 0 && prob <= 100) {
        team1Probability = prob;
        team2Probability = 100 - prob;
      }
    }

    // Normalize probabilities to sum to 100
    const total = team1Probability + team2Probability;
    if (total !== 100 && total > 0) {
      team1Probability = Math.round((team1Probability / total) * 100);
      team2Probability = 100 - team1Probability;
    }

    console.log('Probabilities extracted:', team1Probability, '% vs', team2Probability, '%');
    console.log('Prediction generated successfully');

    return new Response(
      JSON.stringify({
        team1Probability,
        team2Probability,
        analysis: report,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in generate-prediction:', error);
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate prediction' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
