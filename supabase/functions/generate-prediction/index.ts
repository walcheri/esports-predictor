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

async function searchWithPerplexity(
  teamA: string, teamB: string, game: string, config: typeof gameConfig[string], apiKey: string
): Promise<string> {
  const searchPrompt = `Найди САМЫЕ АКТУАЛЬНЫЕ составы команд "${teamA}" и "${teamB}" для ${game} на март 2026 года.
Источники: HLTV.org, cybersport.ru, liquipedia.net, gosugamers.com, VLR.gg, Dotabuff.

Для каждого игрока укажи: ник, роль (${config.roles.join('/')}), рейтинг/KDA, стиль игры.
Также найди последние 10 личных встреч (H2H) этих команд с датами, счётом и турниром.

Верни структурированный текст:
**${teamA}:**
- nick (Role) — rating X.XX, стиль
...

**${teamB}:**
- nick (Role) — rating X.XX, стиль
...

**H2H (последние 10 встреч):**
- дата: ${teamA} X — Y ${teamB} (турнир, карта/формат)
...

ВАЖНО: Используй ТОЛЬКО реальные данные. НЕ выдумывай ники или результаты.`;

  try {
    const response = await fetch('https://api.artemox.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{ role: 'user', content: searchPrompt }],
        max_tokens: 3000,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Perplexity search failed:', response.status, errText);
      return 'Веб-поиск не удался — используй свои знания о текущих составах и H2H.';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Данные не найдены — используй свои знания.';
  } catch (e) {
    console.error('Perplexity search error:', e);
    return 'Веб-поиск не удался — используй свои знания.';
  }
}

async function generateAnalysis(
  teamA: string, teamB: string, game: string, config: typeof gameConfig[string],
  tournament: string, format: string, startTime: string,
  searchData: string, matchData: Record<string, unknown>, apiKey: string
): Promise<string> {
  const mapStats = matchData.mapWinrates
    ? JSON.stringify(matchData.mapWinrates, null, 2)
    : 'Сгенерируй реалистичные проценты на основе данных из поиска';
  const team1Recent = matchData.team1Recent && (matchData.team1Recent as unknown[]).length > 0
    ? JSON.stringify(matchData.team1Recent, null, 2)
    : 'Используй данные из веб-поиска';
  const team2Recent = matchData.team2Recent && (matchData.team2Recent as unknown[]).length > 0
    ? JSON.stringify(matchData.team2Recent, null, 2)
    : 'Используй данные из веб-поиска';

  const systemPrompt = `Ты — лучший в мире русскоязычный аналитик по ${game} (стиль: launders + YNk + Thorin).

КРИТИЧЕСКИ ВАЖНО:
- Пиши ТОЛЬКО про ${game}. НЕ СМЕШИВАЙ данные с другими играми.
- Если это ${game}, используй ТОЛЬКО терминологию ${game}: ${config.terms}.
- НЕ упоминай механики, героев, агентов или карты из других игр.

Пиши подробно, убедительно, с драматургией и абзацами. Объём — минимум 2000 слов.
Никогда не пиши "допустим", "предположим", "Игрок 1/2", "данных нет".
Всегда используй реальные ники игроков из предоставленных данных.
Источники: ${config.sources}.`;

  const userPrompt = `Сделай детальный анализ матча **${teamA}** vs **${teamB}** (${game}, ${tournament}, ${format}, ${startTime}).

## АКТУАЛЬНЫЕ ДАННЫЕ ИЗ ВЕБ-ПОИСКА (sonar-pro):
${searchData}

## Дополнительные данные:
- Карты/статистика: ${mapStats}
- Последние матчи ${teamA}: ${team1Recent}
- Последние матчи ${teamB}: ${team2Recent}

## ОБЯЗАТЕЛЬНАЯ СТРУКТУРА ОТЧЁТА (каждый раздел — минимум 300 слов):

## 📊 Составы команд и ключевые игроки
(Каждый игрок: ник, роль (${config.roles.join('/')}), рейтинг/KDA, стиль игры. Используй данные из веб-поиска.)
В начале блока укажи: "📊 Составы просканированы с ${config.sources} на март 2026"

## ⚔️ История личных встреч
(Минимум 5-10 встреч с датами и счётом, текстом — НЕ таблицей. Используй H2H из веб-поиска.)

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

  const response = await fetch('https://api.artemox.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar-pro',
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
    console.error('Perplexity analysis error:', response.status, errorText);

    if (response.status === 429) {
      throw new Error('RATE_LIMIT');
    }
    if (response.status === 400 && errorText.toLowerCase().includes('budget')) {
      throw new Error('BUDGET_EXCEEDED');
    }
    throw new Error(`Perplexity error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { matchData } = await req.json();
    if (!matchData) throw new Error('Match data is required');

    const ARTEMOX_API_KEY = Deno.env.get('ARTEMOX_API_KEY');
    if (!ARTEMOX_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Artemox API key not configured' }),
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

    console.log('=== Stage 1: Web Search (sonar-pro) ===', teamA, 'vs', teamB, '|', game);
    const searchData = await searchWithPerplexity(teamA, teamB, game, config, ARTEMOX_API_KEY);
    console.log('Search data length:', searchData.length);

    console.log('=== Stage 2: Analysis (sonar-pro) ===');
    const rawReport = await generateAnalysis(
      teamA, teamB, game, config, tournament, format, startTime,
      searchData, matchData, ARTEMOX_API_KEY
    );

    if (!rawReport) throw new Error('Пустой ответ от Perplexity');

    // Clean up
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

    report += `\n\n---\n\n**ФИНАЛЬНЫЙ ПРОГНОЗ ДЛЯ ДИАГРАММЫ:**\n**${teamA} — ${team1Probability}% | ${teamB} — ${team2Probability}%**`;

    console.log('Final:', team1Probability, '% vs', team2Probability, '%');

    return new Response(
      JSON.stringify({ team1Probability, team2Probability, analysis: report }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-prediction:', error);

    const message = error instanceof Error ? error.message : 'Failed to generate prediction';

    if (message === 'RATE_LIMIT') {
      return new Response(
        JSON.stringify({ error: 'Превышен лимит запросов. Попробуйте через минуту.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (message === 'BUDGET_EXCEEDED') {
      return new Response(
        JSON.stringify({ error: 'Бюджет API исчерпан. Попробуйте позже.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
