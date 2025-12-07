import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Game-specific terminology and sources
const gameConfig: Record<string, { 
  roles: string[], 
  terms: string, 
  sources: string,
  mapTerm: string,
  heroTerm: string 
}> = {
  'valorant': {
    roles: ['Duelist', 'Controller', 'Initiator', 'Sentinel'],
    terms: 'agents, abilities, spike, ults, dash, flash, smokes',
    sources: 'VLR.gg, Liquipedia Valorant',
    mapTerm: 'maps',
    heroTerm: 'agents'
  },
  'dota2': {
    roles: ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'],
    terms: 'heroes, lanes, gold diff, GPM, XPM, teamfights, Roshan',
    sources: 'Dotabuff, OpenDota, Liquipedia Dota 2',
    mapTerm: 'patches/meta',
    heroTerm: 'heroes'
  },
  'csgo': {
    roles: ['IGL', 'AWPer', 'Entry Fragger', 'Lurker', 'Support'],
    terms: 'maps, AWP duels, CT/T side, clutches, opening kills, HLTV rating',
    sources: 'HLTV.org, Liquipedia CS',
    mapTerm: 'maps',
    heroTerm: 'weapons/positions'
  },
  'lol': {
    roles: ['Top', 'Jungle', 'Mid', 'ADC', 'Support'],
    terms: 'champions, lanes, dragons, Baron, KDA, CS/min, vision score',
    sources: 'OP.GG, Leaguepedia, Games of Legends',
    mapTerm: 'patches/meta',
    heroTerm: 'champions'
  }
};

function getGameSlug(game: string): string {
  const gameLower = game.toLowerCase();
  if (gameLower.includes('valorant') || gameLower.includes('valo')) return 'valorant';
  if (gameLower.includes('dota')) return 'dota2';
  if (gameLower.includes('cs') || gameLower.includes('counter')) return 'csgo';
  if (gameLower.includes('lol') || gameLower.includes('league')) return 'lol';
  return 'csgo'; // default
}

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
    const game = matchData.game || 'CS2';
    const gameSlug = getGameSlug(game);
    const config = gameConfig[gameSlug];
    const tournament = matchData.tournament || 'Unknown';
    const format = matchData.format || 'Bo3';
    const startTime = matchData.startTime || 'TBD';

    console.log('Starting prediction for:', teamA, 'vs', teamB, '| Game:', game, '| Slug:', gameSlug);

    // STEP 1: Search for real rosters using Artemox (Perplexity-based)
    const ARTEMOX_API_KEY = Deno.env.get('ARTEMOX_API_KEY');
    let extendedRosters = { teamA: [], teamB: [] };
    
    if (ARTEMOX_API_KEY) {
      console.log('Fetching real rosters via Artemox...');
      
      const searchPrompt = `Найди актуальные составы команд для матча ${teamA} vs ${teamB} (${game}, декабрь 2025).

Для каждого игрока укажи:
- Реальный ник (не "Игрок 1")
- Роль: ${config.roles.join(', ')}
- Примерный KDA за последние 3 месяца
- Стиль игры на ${config.mapTerm}/${config.heroTerm}

Источники: ${config.sources}

Ответ ТОЛЬКО в JSON формате (без markdown, без \`\`\`):
{"teamA": [{"name": "реальный_ник", "role": "роль", "kda": 1.2, "style": "описание стиля"}], "teamB": [...]}`;

      try {
        const searchResponse = await fetch('https://api.artemox.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ARTEMOX_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'sonar-pro',
            messages: [{ role: 'user', content: searchPrompt }],
            max_tokens: 2000,
            temperature: 0.3,
          }),
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const searchContent = searchData.choices?.[0]?.message?.content || '';
          console.log('Artemox search response:', searchContent.substring(0, 300));
          
          // Try to parse JSON from response
          try {
            const jsonMatch = searchContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              extendedRosters = JSON.parse(jsonMatch[0]);
              console.log('Parsed rosters:', JSON.stringify(extendedRosters).substring(0, 200));
            }
          } catch (parseError) {
            console.log('Could not parse rosters JSON, using raw data');
          }
        } else {
          console.log('Artemox search failed, continuing without extended rosters');
        }
      } catch (searchError) {
        console.log('Artemox search error:', searchError);
      }
    }

    // Prepare PandaScore stats
    const statsJson = JSON.stringify({
      matchId: matchData.id,
      teams: { team1: matchData.team1, team2: matchData.team2 },
      headToHead: matchData.headToHead,
      mapWinrates: matchData.mapWinrates,
      team1Recent: matchData.team1Recent,
      team2Recent: matchData.team2Recent,
      startTime: matchData.startTime,
    }, null, 2);

    // STEP 2: Generate game-specific analysis
    const rostersInfo = extendedRosters.teamA?.length > 0 
      ? `\n\nРеальные составы (использовать эти ники, НЕ выдумывать!):\n${JSON.stringify(extendedRosters, null, 2)}`
      : '';

    const gameSpecificPrompt = getGameSpecificPrompt(gameSlug, config, teamA, teamB);

    const fullPrompt = `Ты — топовый русскоязычный киберспортивный аналитик по ${game} (стиль: эмоциональный, но профессиональный). 

КРИТИЧЕСКИ ВАЖНО:
- Используй ТОЛЬКО реальные ники игроков из данных ниже
- НИКОГДА не пиши "допустим", "предположим", "Игрок 1/2"
- Если нет данных об игроке — используй информацию из поиска или известных источников
- Адаптируй терминологию под ${game}: ${config.terms}

Матч: ${teamA} vs ${teamB}
Турнир: ${tournament}
Формат: ${format}
Время: ${startTime}

Данные PandaScore: ${statsJson}
${rostersInfo}

${gameSpecificPrompt}

ФОРМАТ:
- Объём: 1500–2500 слов
- Короткие абзацы (3–6 строк)
- **Жирный** для ников и процентов
- *Курсив* для эмоций
- Эмодзи умеренно (🔥⚡👀)
- НЕТ сырых таблиц с |
- НЕТ фраз "к сожалению, данных нет" — всегда анализируй

Финальный прогноз выдели жирным: **${teamA} — XX% | ${teamB} — YY%**`;

    console.log('Sending request to OpenRouter (DeepSeek)...');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://esports-predictor.lovable.app',
        'X-Title': 'Esports Predictor',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat',
        messages: [{ role: 'user', content: fullPrompt }],
        max_tokens: 4000,
        temperature: 0.7,
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
      
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('OpenRouter response received:', JSON.stringify(data).substring(0, 500));
    
    const rawReport = data.choices?.[0]?.message?.content || '';

    if (!rawReport) {
      console.error('Empty response from OpenRouter');
      throw new Error('Пустой ответ от AI модели');
    }

    // Post-processing
    const report = rawReport
      .replace(/\|[^\n]*\|/g, '')
      .replace(/[-|]{4,}/g, '')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/допустим|предположим|Игрок\s*\d/gi, ''); // Remove placeholder phrases

    console.log('Report generated. Length:', report.length, 'chars');

    // Extract probabilities
    const probMatches = report.match(/(\d{1,3})\s*%/g) || [];
    let team1Probability = 55;
    let team2Probability = 45;

    if (probMatches.length >= 2) {
      const probs = probMatches.map((p: string) => parseInt(p.replace(/\s*%/, ''))).filter((p: number) => p > 0 && p <= 100);
      for (let i = 0; i < probs.length - 1; i++) {
        const sum = probs[i] + probs[i + 1];
        if (sum >= 95 && sum <= 105) {
          team1Probability = probs[i];
          team2Probability = probs[i + 1];
          break;
        }
      }
    }

    const total = team1Probability + team2Probability;
    if (total !== 100 && total > 0) {
      team1Probability = Math.round((team1Probability / total) * 100);
      team2Probability = 100 - team1Probability;
    }

    console.log('Probabilities:', team1Probability, '% vs', team2Probability, '%');
    console.log('Prediction generated successfully');

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

function getGameSpecificPrompt(gameSlug: string, config: typeof gameConfig[string], teamA: string, teamB: string): string {
  switch (gameSlug) {
    case 'valorant':
      return `## Структура для VALORANT:

## Составы и агенты
(Каждый игрок: ник, роль (${config.roles.join('/')}), signature agents, стиль — например: "**yay** (Duelist) — Jett/Chamber main, aggressive OP, 285 ACS на Haven")

## История встреч
(H2H: даты, счёт, карты, ключевые раунды — текстом, не таблицей)

## Форма команд
(Последние 5 матчей, психология, тильт/мотивация)

## Разбор по картам
(Haven, Bind, Ascent и т.д. — winrate, agent compositions, ключевые дуэли: "**TenZ** vs **Derke** на mid Haven — 65% trade rate")

## Тактика и пики агентов
(Ожидаемые compositions, баны карт, сюрпризы)

## Прогноз
(**${teamA} — XX% | ${teamB} — YY%** с обоснованием)`;

    case 'dota2':
      return `## Структура для DOTA 2:

## Составы и роли
(Каждый игрок: ник, позиция (${config.roles.join('/')}), signature heroes, стиль — например: "**Collapse** (Offlane) — Mars/Axe player, aggressive initiator, 7.2 KDA на Mars")

## История встреч
(H2H: даты, счёт, драфты, ключевые тимфайты — текстом)

## Форма команд
(Последние 5 матчей, gold diff, early/late game strength)

## Мета и герои
(Текущий патч, signature picks, comfort heroes каждого игрока)

## Драфт-анализ
(Ожидаемые first picks/bans, flex picks, cheese strats)

## Прогноз
(**${teamA} — XX% | ${teamB} — YY%** с обоснованием)`;

    case 'lol':
      return `## Структура для LEAGUE OF LEGENDS:

## Составы и роли
(Каждый игрок: ник, позиция (${config.roles.join('/')}), signature champions, стиль — например: "**Faker** (Mid) — Azir/Orianna specialist, 8.1 KDA, 10.2 CS/min")

## История встреч
(H2H: даты, счёт, ключевые драфты и objectives)

## Форма команд
(Последние 5 матчей, early game rating, dragon control)

## Мета и чемпионы
(Текущий патч, priority picks, pocket picks)

## Драфт-анализ
(Синергии, counters, flex picks)

## Прогноз
(**${teamA} — XX% | ${teamB} — YY%** с обоснованием)`;

    default: // CS2
      return `## Структура для CS2:

## Составы и роли
(Каждый игрок: ник, роль (${config.roles.join('/')}), стиль — например: "**s1mple** (AWPer) — aggressive AWP, 1.25 HLTV rating, 0.85 opening kills/round на Mirage")

## История встреч
(H2H: даты, счёт, карты, овертаймы — текстом)

## Форма команд
(Последние 5 матчей, психология, буткемпы)

## Разбор по картам
(Mirage, Inferno, Nuke и т.д. — winrate CT/T, ключевые позиции, AWP дуэли)

## Тактика и веты
(Map pool, perma-bans, decider predictions)

## Прогноз
(**${teamA} — XX% | ${teamB} — YY%** с обоснованием)`;
  }
}
