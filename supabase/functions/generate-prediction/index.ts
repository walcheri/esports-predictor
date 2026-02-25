import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Game-specific config
const gameConfig: Record<string, { 
  roles: string[], 
  terms: string,
  sources: string,
}> = {
  'valorant': {
    roles: ['Duelist', 'Controller', 'Initiator', 'Sentinel'],
    terms: 'agents, abilities, spike, ults, dash, flash, smokes',
    sources: 'VLR.gg, Liquipedia Valorant',
  },
  'dota2': {
    roles: ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'],
    terms: 'heroes, lanes, gold diff, GPM, XPM, teamfights, Roshan',
    sources: 'Dotabuff, OpenDota, Liquipedia Dota 2',
  },
  'csgo': {
    roles: ['IGL', 'AWPer', 'Entry Fragger', 'Lurker', 'Support'],
    terms: 'maps, AWP duels, CT/T side, clutches, opening kills, HLTV rating',
    sources: 'HLTV.org, Liquipedia CS',
  },
  'lol': {
    roles: ['Top', 'Jungle', 'Mid', 'ADC', 'Support'],
    terms: 'champions, lanes, dragons, Baron, KDA, CS/min, vision score',
    sources: 'OP.GG, Leaguepedia, Games of Legends',
  }
};

function getGameSlug(game: string): string {
  const g = game.toLowerCase();
  if (g.includes('valorant') || g.includes('valo')) return 'valorant';
  if (g.includes('dota')) return 'dota2';
  if (g.includes('cs') || g.includes('counter')) return 'csgo';
  if (g.includes('lol') || g.includes('league')) return 'lol';
  return 'csgo';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { matchData } = await req.json();
    if (!matchData) throw new Error('Match data is required');

    const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
    if (!DEEPSEEK_API_KEY) {
      console.error('DEEPSEEK_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'DeepSeek API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const teamA = matchData.team1?.name || matchData.teamA || 'Team A';
    const teamB = matchData.team2?.name || matchData.teamB || 'Team B';
    const game = matchData.game || 'CS2';
    const gameSlug = getGameSlug(game);
    const config = gameConfig[gameSlug];
    const tournament = matchData.tournament || 'Unknown';
    const format = matchData.format || 'Bo3';
    const startTime = matchData.startTime || 'TBD';

    console.log('Starting DeepSeek prediction:', teamA, 'vs', teamB, '| Game:', game);

    // Build stats context from available data
    const h2h = matchData.headToHead?.length > 0 
      ? JSON.stringify(matchData.headToHead, null, 2) 
      : 'Нет данных — сгенерируй на основе своих знаний';
    const mapStats = matchData.mapWinrates 
      ? JSON.stringify(matchData.mapWinrates, null, 2) 
      : 'Сгенерируй реалистичные проценты';
    const team1Recent = matchData.team1Recent?.length > 0 
      ? JSON.stringify(matchData.team1Recent, null, 2) 
      : 'Используй свои знания';
    const team2Recent = matchData.team2Recent?.length > 0 
      ? JSON.stringify(matchData.team2Recent, null, 2) 
      : 'Используй свои знания';

    const systemPrompt = `Ты — лучший в мире русскоязычный аналитик киберспорта (стиль: launders + YNk + Thorin). 
Пиши подробно, убедительно, с драматургией и абзацами. Объём — минимум 1500 слов. 
Никогда не пиши "допустим", "предположим", "Игрок 1/2", "данных нет".
Всегда используй реальные ники игроков и данные из своих знаний о киберспорте.
Адаптируй терминологию под ${game}: ${config.terms}.
Источники: ${config.sources}.`;

    const userPrompt = `Сделай детальный анализ матча **${teamA}** vs **${teamB}** (${game}, ${tournament}, ${format}, ${startTime}).

Доступные данные:
- H2H: ${h2h}
- Карты: ${mapStats}
- Последние матчи ${teamA}: ${team1Recent}
- Последние матчи ${teamB}: ${team2Recent}

## ОБЯЗАТЕЛЬНАЯ СТРУКТУРА ОТЧЁТА:

## 📊 Составы команд и ключевые игроки
(Каждый игрок: ник, роль (${config.roles.join('/')}), рейтинг/KDA, стиль игры. Используй реальные актуальные составы из своих знаний.)
В начале блока укажи: "📊 Составы сканированы с ${config.sources} на февраль 2026"

## ⚔️ История личных встреч
(Минимум 5-10 встреч с датами и счётом, текстом — НЕ таблицей)

## 🔥 Текущая форма и психология
(Последние 5 матчей каждой команды, тренды, тильт/мотивация)

## 🗺️ Разбор по картам
(Winrate на ключевых картах, дуэли, тактические особенности)

## 🎯 Тактика, пики и баны
(Map pool, perma-bans, ожидаемые стратегии)

## 📖 Сюжетные линии матча
(Драма, ривалри, мотивация, контекст турнира)

## 🏆 Финальный прогноз
(**${teamA} — XX% | ${teamB} — YY%** с обоснованием и ожидаемым счётом)

ФОРМАТ:
- Короткие абзацы (3–6 строк)
- **Жирный** для ников и процентов
- *Курсив* для эмоций
- Эмодзи умеренно (🔥⚡👀)
- НЕТ сырых таблиц с |
- Финальный прогноз выдели жирным: **${teamA} — XX% | ${teamB} — YY%**`;

    console.log('Sending request to DeepSeek API...');

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 6000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Превышен лимит запросов DeepSeek. Попробуйте позже.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402 || response.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Ошибка авторизации DeepSeek. Проверьте API ключ.' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`DeepSeek error: ${response.status}`);
    }

    const data = await response.json();
    console.log('DeepSeek response received');

    const rawReport = data.choices?.[0]?.message?.content || '';
    if (!rawReport) throw new Error('Пустой ответ от DeepSeek');

    // Post-processing
    let report = rawReport
      .replace(/\|[^\n]*\|/g, '')
      .replace(/[-|]{4,}/g, '')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/допустим|предположим|Игрок\s*\d/gi, '');

    console.log('Report length:', report.length, 'chars');

    // Extract probabilities
    let team1Probability = 50;
    let team2Probability = 50;

    const finalPredictionRegex = /\*\*([^—\*]+)\s*—\s*(\d+)\s*%\s*\|\s*([^—\*]+)\s*—\s*(\d+)\s*%\*\*/;
    const finalMatch = report.match(finalPredictionRegex);

    if (finalMatch) {
      team1Probability = parseInt(finalMatch[2]);
      team2Probability = parseInt(finalMatch[4]);
    } else {
      const probMatches = report.match(/(\d{1,3})\s*%/g) || [];
      if (probMatches.length >= 2) {
        const probs = probMatches.map((p: string) => parseInt(p.replace(/\s*%/, ''))).filter((p: number) => p > 0 && p <= 100);
        for (let i = 0; i < probs.length - 1; i++) {
          if (probs[i] + probs[i + 1] >= 95 && probs[i] + probs[i + 1] <= 105) {
            team1Probability = probs[i];
            team2Probability = probs[i + 1];
            break;
          }
        }
      }
    }

    // Normalize
    const total = team1Probability + team2Probability;
    if (total !== 100 && total > 0) {
      team1Probability = Math.round((team1Probability / total) * 100);
      team2Probability = 100 - team1Probability;
    }

    // Add final prediction block for chart sync
    report += `\n\n---\n\n**ФИНАЛЬНЫЙ ПРОГНОЗ ДЛЯ ДИАГРАММЫ:**\n**${teamA} — ${team1Probability}% | ${teamB} — ${team2Probability}%**`;

    console.log('Final:', team1Probability, '% vs', team2Probability, '%');

    return new Response(
      JSON.stringify({
        team1Probability,
        team2Probability,
        analysis: report,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-prediction:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate prediction' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
