import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const gameConfig: Record<string, {
  roles: string[],
  terms: string,
  sources: string,
  rosterSource: string,
}> = {
  'valorant': {
    roles: ['Duelist', 'Controller', 'Initiator', 'Sentinel'],
    terms: 'agents, abilities, spike, ults, dash, flash, smokes',
    sources: 'VLR.gg, Liquipedia Valorant',
    rosterSource: 'VLR.gg и Liquipedia Valorant',
  },
  'dota2': {
    roles: ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'],
    terms: 'heroes, lanes, gold diff, GPM, XPM, teamfights, Roshan',
    sources: 'Dotabuff, OpenDota, Liquipedia Dota 2',
    rosterSource: 'Liquipedia Dota 2 и Dotabuff',
  },
  'csgo': {
    roles: ['IGL', 'AWPer', 'Entry Fragger', 'Lurker', 'Support'],
    terms: 'maps, AWP duels, CT/T side, clutches, opening kills, HLTV rating',
    sources: 'HLTV.org, Liquipedia CS',
    rosterSource: 'HLTV.org и Liquipedia CS',
  },
  'lol': {
    roles: ['Top', 'Jungle', 'Mid', 'ADC', 'Support'],
    terms: 'champions, lanes, dragons, Baron, KDA, CS/min, vision score',
    sources: 'OP.GG, Leaguepedia, Games of Legends',
    rosterSource: 'Leaguepedia и OP.GG',
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

async function searchRosters(teamA: string, teamB: string, game: string, config: typeof gameConfig[string], apiKey: string): Promise<string> {
  const searchPrompt = `Найди актуальные составы команд "${teamA}" и "${teamB}" для ${game} на февраль-март 2026 года.
Источники: ${config.rosterSource}, EsportsTransfers.com.
Для каждого игрока укажи: ник, роль (${config.roles.join('/')}), примерный рейтинг/KDA, стиль игры.
Верни структурированный текст (НЕ JSON), например:
**${teamA}:**
- nick1 (${config.roles[0]}) — рейтинг X.XX, агрессивный стиль
...
**${teamB}:**
- nick1 (${config.roles[0]}) — рейтинг X.XX, ...

ВАЖНО: Используй ТОЛЬКО реальные актуальные ники игроков. НЕ выдумывай. Если не знаешь точный состав, укажи последний известный.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: searchPrompt }],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('Roster search failed:', response.status);
      return 'Составы не найдены — используй свои знания о текущих составах.';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Составы не найдены — используй свои знания.';
  } catch (e) {
    console.error('Roster search error:', e);
    return 'Составы не найдены — используй свои знания.';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { matchData } = await req.json();
    if (!matchData) throw new Error('Match data is required');

    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Groq API key not configured' }),
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

    console.log('=== Stage 1: Roster Search ===', teamA, 'vs', teamB, '|', game);

    const rostersText = await searchRosters(teamA, teamB, game, config, GROQ_API_KEY);
    console.log('Rosters fetched, length:', rostersText.length);

    // Prepare match context
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

    console.log('=== Stage 2: Main Analysis ===');

    const systemPrompt = `Ты — лучший в мире русскоязычный аналитик по ${game} (стиль: launders + YNk + Thorin).

КРИТИЧЕСКИ ВАЖНО:
- Пиши ТОЛЬКО про ${game}. НЕ СМЕШИВАЙ данные с другими играми.
- Если это ${game}, используй ТОЛЬКО терминологию ${game}: ${config.terms}.
- НЕ упоминай механики, героев, агентов или карты из других игр.
- Например: если матч по Dota 2, НЕ пиши про карты CS2 (Mirage, Inferno). Если матч по CS2, НЕ пиши про героев Dota.

Пиши подробно, убедительно, с драматургией и абзацами. Объём — минимум 2000 слов.
Никогда не пиши "допустим", "предположим", "Игрок 1/2", "данных нет".
Всегда используй реальные ники игроков.
Источники: ${config.sources}.`;

    const userPrompt = `Сделай детальный анализ матча **${teamA}** vs **${teamB}** (${game}, ${tournament}, ${format}, ${startTime}).

## АКТУАЛЬНЫЕ СОСТАВЫ (из поиска):
${rostersText}

## Дополнительные данные:
- H2H: ${h2h}
- Карты/статистика: ${mapStats}
- Последние матчи ${teamA}: ${team1Recent}
- Последние матчи ${teamB}: ${team2Recent}

## ОБЯЗАТЕЛЬНАЯ СТРУКТУРА ОТЧЁТА (каждый раздел — минимум 300 слов):

## 📊 Составы команд и ключевые игроки
(Каждый игрок: ник, роль (${config.roles.join('/')}), рейтинг/KDA, стиль игры. Используй данные из поиска выше.)
В начале блока укажи: "📊 Составы сканированы с ${config.sources} на март 2026"

## ⚔️ История личных встреч
(Минимум 5-10 встреч с датами и счётом, текстом — НЕ таблицей)

## 🔥 Текущая форма и психология
(Последние 5-7 матчей каждой команды, тренды, тильт/мотивация)

## 🗺️ Разбор по картам
(Winrate на ключевых картах/героях/агентах, дуэли, тактические особенности — ТОЛЬКО для ${game})

## 🎯 Тактика, пики и баны
(Map pool / hero pool / agent pool, perma-bans, ожидаемые стратегии — ТОЛЬКО для ${game})

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
- Финальный прогноз выдели жирным: **${teamA} — XX% | ${teamB} — YY%**

НАПОМИНАНИЕ: Пиши ТОЛЬКО про ${game}! Не упоминай другие игры!`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 8000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Превышен лимит запросов. Попробуйте через минуту.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Groq error: ${response.status}`);
    }

    const data = await response.json();
    const rawReport = data.choices?.[0]?.message?.content || '';
    if (!rawReport) throw new Error('Пустой ответ от Groq');

    // Clean up report
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

    const total = team1Probability + team2Probability;
    if (total !== 100 && total > 0) {
      team1Probability = Math.round((team1Probability / total) * 100);
      team2Probability = 100 - team1Probability;
    }

    report += `\n\n---\n\n**ФИНАЛЬНЫЙ ПРОГНОЗ:**\n**${teamA} — ${team1Probability}% | ${teamB} — ${team2Probability}%**`;

    console.log('Final:', team1Probability, '% vs', team2Probability, '%');

    return new Response(
      JSON.stringify({ team1Probability, team2Probability, analysis: report }),
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
