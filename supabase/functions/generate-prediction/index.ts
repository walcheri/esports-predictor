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

    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    
    if (!OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const teamA = matchData.team1?.name || matchData.teamA || 'Team A';
    const teamB = matchData.team2?.name || matchData.teamB || 'Team B';
    const game = matchData.game || 'Unknown';
    const tournament = matchData.tournament || 'Unknown';
    const format = matchData.format || 'Bo3';
    const startTime = matchData.startTime || 'TBD';

    console.log('Starting DeepSeek prediction for:', teamA, 'vs', teamB);

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

    const fullPrompt = `Ты — топовый русскоязычный киберспортивный аналитик (стиль launders + YNk + Thorin). Пиши красиво, живо, с драматургией и абзацами. НИКАКИХ сырых таблиц вида | Дата | Противник | — всё оформляй в красивый markdown или обычный текст. Объём — 1500–2500 слов.

Матч: ${teamA} vs ${teamB} (${game}, ${tournament}, ${startTime})

Данные из PandaScore (используй для анализа): ${statsJson}

Структура отчёта (обязательно в таком порядке, каждый блок — отдельный заголовок второго уровня):

## Составы команд и ключевые игроки
(по 4–6 абзацев на команду: роль, возраст, текущий рейтинг, стиль на картах, яркие фишки. Например: 'nafany на Dust2: агрессивные entry 72% success rate, AWP-контроль мида')

## Личные встречи
(просто текст: «За последние 10 матчей счёт 6:4 в пользу… Самый яркий матч — 16 января 2025, где…» — никаких таблиц-решёток!)

## Текущая форма и психология
(по 5–7 абзацев: последние матчи, тильт/мотивация, серия побед/поражений, выводы)

## Разбор по картам
(отдельный подзаголовок на каждую карту пула: Inferno, Mirage, Dust2 и т.д. — winrate, CT/T-сайд, ключевые дуэли, стиль игры команд на ней)

## Тактика, пики и баны
(что забанят, пермапики, возможные сюрпризы)

## Главные сюжетные линии матча
(реванш, бывшие тиммейты, скандалы, мотивация)

## Финальный прогноз
(одна строчка жирным в конце: **${teamA} — XX % | ${teamB} — YY %** + 2–3 абзаца обоснования и предполагаемый счёт)

Стиль письма:
- Пиши как человек, а не как бот
- Разбивай на короткие абзацы (3–6 строк)
- Используй выделения: **жирный** для имён и процентов, *курсив* для эмоций
- Добавляй эмодзи только там, где уместно (огонь, молния, глаза)
- Никаких «| Дата | Противник |» и прочих сырых таблиц
- Никаких «к сожалению, данных нет» — всегда придумывай правдоподобный анализ на основе общедоступной информации

Пиши так, чтобы после прочтения человек сказал: «Блин, это реально круто, сохраню в избранное».`;

    console.log('Sending request to OpenRouter API (DeepSeek V3)...');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://esports-predictor.lovable.app',
        'X-Title': 'Esports Predictor',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat:free',
        messages: [{ role: 'user', content: fullPrompt }],
        max_tokens: 4000,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      
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
          JSON.stringify({ error: 'Неверный API ключ OpenRouter.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenRouter response received:', JSON.stringify(data).substring(0, 500));
    
    const rawReport = data.choices?.[0]?.message?.content || '';

    if (!rawReport) {
      console.error('Empty response from OpenRouter');
      throw new Error('Пустой ответ от AI модели');
    }

    // Post-processing: убираем остатки таблиц
    const report = rawReport
      .replace(/\|[^\n]*\|/g, '')           // убирает все строки с |
      .replace(/[-|]{4,}/g, '')             // убирает разделители таблиц
      .replace(/\n\s*\n\s*\n/g, '\n\n');    // убирает лишние пустые строки

    console.log('DeepSeek response received. Report length:', report.length, 'chars');

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
