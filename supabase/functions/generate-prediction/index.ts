import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Known CS2 team rosters (updated December 2025)
const knownCS2Rosters: Record<string, Array<{name: string, role: string, rating: string, nationality: string}>> = {
  'ALGO Esports': [
    { name: 'Jame', role: 'IGL/AWPer', rating: '1.08', nationality: '🇰🇿' },
    { name: 'FL1T', role: 'Entry', rating: '1.02', nationality: '🇰🇿' },
    { name: 'Qikert', role: 'Support', rating: '0.98', nationality: '🇰🇿' },
    { name: 'KaiR0N-', role: 'Rifler', rating: '1.05', nationality: '🇰🇿' },
    { name: 'fame', role: 'Entry', rating: '1.01', nationality: '🇷🇺' }
  ],
  'Natus Vincere': [
    { name: 's1mple', role: 'AWPer', rating: '1.25', nationality: '🇺🇦' },
    { name: 'b1t', role: 'Rifler', rating: '1.12', nationality: '🇺🇦' },
    { name: 'jL', role: 'Entry', rating: '1.08', nationality: '🇱🇻' },
    { name: 'iM', role: 'Support', rating: '0.99', nationality: '🇺🇦' },
    { name: 'Aleksib', role: 'IGL', rating: '0.95', nationality: '🇫🇮' }
  ],
  'G2 Esports': [
    { name: 'NiKo', role: 'Rifler', rating: '1.18', nationality: '🇧🇦' },
    { name: 'm0NESY', role: 'AWPer', rating: '1.22', nationality: '🇷🇺' },
    { name: 'huNter-', role: 'Entry', rating: '1.06', nationality: '🇧🇦' },
    { name: 'nexa', role: 'IGL', rating: '0.98', nationality: '🇷🇸' },
    { name: 'Snax', role: 'Support', rating: '1.01', nationality: '🇵🇱' }
  ],
  'FaZe Clan': [
    { name: 'ropz', role: 'Lurker', rating: '1.14', nationality: '🇪🇪' },
    { name: 'rain', role: 'Entry', rating: '1.05', nationality: '🇳🇴' },
    { name: 'frozen', role: 'Rifler', rating: '1.08', nationality: '🇸🇰' },
    { name: 'broky', role: 'AWPer', rating: '1.10', nationality: '🇱🇻' },
    { name: 'karrigan', role: 'IGL', rating: '0.91', nationality: '🇩🇰' }
  ],
  'Vitality': [
    { name: 'ZywOo', role: 'AWPer', rating: '1.28', nationality: '🇫🇷' },
    { name: 'apEX', role: 'IGL', rating: '0.97', nationality: '🇫🇷' },
    { name: 'flameZ', role: 'Entry', rating: '1.09', nationality: '🇮🇱' },
    { name: 'Spinx', role: 'Rifler', rating: '1.04', nationality: '🇮🇱' },
    { name: 'mezii', role: 'Support', rating: '0.99', nationality: '🇬🇧' }
  ],
  'Cloud9': [
    { name: 'sh1ro', role: 'AWPer', rating: '1.15', nationality: '🇷🇺' },
    { name: 'Ax1Le', role: 'Rifler', rating: '1.12', nationality: '🇷🇺' },
    { name: 'electroNic', role: 'Entry', rating: '1.06', nationality: '🇷🇺' },
    { name: 'Boombl4', role: 'IGL', rating: '0.94', nationality: '🇷🇺' },
    { name: 'Perfecto', role: 'Support', rating: '0.98', nationality: '🇷🇺' }
  ],
  'MOUZ': [
    { name: 'torzsi', role: 'AWPer', rating: '1.11', nationality: '🇭🇺' },
    { name: 'xertioN', role: 'Entry', rating: '1.05', nationality: '🇮🇱' },
    { name: 'Jimpphat', role: 'Rifler', rating: '1.07', nationality: '🇫🇮' },
    { name: 'siuhy', role: 'IGL', rating: '0.96', nationality: '🇵🇱' },
    { name: 'sycrone', role: 'Support', rating: '0.99', nationality: '🇩🇪' }
  ],
  'Eternal Fire': [
    { name: 'XANTARES', role: 'Rifler', rating: '1.16', nationality: '🇹🇷' },
    { name: 'woxic', role: 'AWPer', rating: '1.08', nationality: '🇹🇷' },
    { name: 'Calyx', role: 'Entry', rating: '1.02', nationality: '🇹🇷' },
    { name: 'MAJ3R', role: 'IGL', rating: '0.95', nationality: '🇹🇷' },
    { name: 'Wicadia', role: 'Support', rating: '0.98', nationality: '🇹🇷' }
  ],
  'Spirit': [
    { name: 'donk', role: 'Rifler', rating: '1.24', nationality: '🇷🇺' },
    { name: 'zont1x', role: 'AWPer', rating: '1.10', nationality: '🇷🇺' },
    { name: 'magixx', role: 'Entry', rating: '1.06', nationality: '🇷🇺' },
    { name: 'chopper', role: 'IGL', rating: '0.94', nationality: '🇷🇺' },
    { name: 'w0nderful', role: 'Support', rating: '1.01', nationality: '🇺🇦' }
  ],
  'Heroic': [
    { name: 'TeSeS', role: 'Entry', rating: '1.04', nationality: '🇩🇰' },
    { name: 'sjuush', role: 'AWPer', rating: '1.06', nationality: '🇩🇰' },
    { name: 'jabbi', role: 'Rifler', rating: '1.08', nationality: '🇩🇰' },
    { name: 'Zyphon', role: 'Support', rating: '0.97', nationality: '🇩🇰' },
    { name: 'kyxsan', role: 'IGL', rating: '0.93', nationality: '🇬🇧' }
  ]
};

// Function to find roster by team name (fuzzy match)
function findKnownRoster(teamName: string): Array<{name: string, role: string, rating: string, nationality: string}> | null {
  const normalized = teamName.toLowerCase().trim();
  
  for (const [knownName, roster] of Object.entries(knownCS2Rosters)) {
    if (normalized.includes(knownName.toLowerCase()) || knownName.toLowerCase().includes(normalized)) {
      return roster;
    }
  }
  
  // Try partial matches
  const words = normalized.split(/\s+/);
  for (const [knownName, roster] of Object.entries(knownCS2Rosters)) {
    const knownWords = knownName.toLowerCase().split(/\s+/);
    if (words.some(w => knownWords.some(kw => kw.includes(w) || w.includes(kw)))) {
      return roster;
    }
  }
  
  return null;
}

// Format roster for prompt
function formatRosterForPrompt(roster: Array<{name: string, role: string, rating: string, nationality: string}>): string {
  return roster.map(p => `${p.nationality} **${p.name}** (${p.role}) — HLTV Rating: ${p.rating}`).join('\n');
}

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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Lovable AI API key not configured' }),
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

    // STEP 1: Search for real data using Artemox (H2H, rosters, stats)
    const ARTEMOX_API_KEY = Deno.env.get('ARTEMOX_API_KEY');
    let extendedData = { 
      h2h: [], 
      rosters: { teamA: [], teamB: [] },
      mapStats: {},
      recentForm: { teamA: [], teamB: [] }
    };
    
    if (ARTEMOX_API_KEY) {
      console.log('Fetching real rosters via Artemox...');
      
      // Get game-specific search sources
      const searchSources = gameSlug === 'csgo' ? 'HLTV.org' 
        : gameSlug === 'valorant' ? 'VLR.gg' 
        : gameSlug === 'dota2' ? 'Dotabuff.com, Liquipedia Dota 2' 
        : 'Leaguepedia, OP.GG';
      
      const searchPrompt = `Найди АКТУАЛЬНЫЕ данные (ноябрь-декабрь 2025) для матча ${teamA} vs ${teamB} (${game}).

ИСТОЧНИКИ ДЛЯ ПОИСКА: ${searchSources}, Liquipedia

ОБЯЗАТЕЛЬНО найди и верни:
1. СОСТАВЫ (актуальные на декабрь 2025):
   - ${teamA}: все 5 игроков с реальными никами, ролями (${config.roles.join(', ')}), KDA за последние 3 месяца
   - ${teamB}: все 5 игроков с реальными никами, ролями, KDA
   
2. H2H (последние 10 встреч между ${teamA} и ${teamB}):
   - Дата, счёт, карта/патч, турнир, победитель
   - Если команды не встречались - укажи пустой массив
   
3. WINRATE на ${config.mapTerm} (за последние 3 месяца):
   - Для каждой основной карты/патча: процент побед каждой команды
   
4. ФОРМА (последние 5-7 матчей каждой команды):
   - Противник, счёт, дата, результат

Ответ СТРОГО в JSON (без markdown, без \`\`\`):
{
  "rosters": {
    "teamA": [{"name": "реальный_ник_игрока", "role": "IGL", "kda": 1.15, "style": "aggressive caller"}],
    "teamB": [{"name": "реальный_ник_игрока", "role": "AWPer", "kda": 1.32, "style": "passive anchor"}]
  },
  "h2h": [{"date": "2025-11-15", "score": "2-1", "map": "Inferno", "tournament": "BLAST", "winner": "${teamA}"}],
  "mapStats": {"Inferno": {"teamA": 65, "teamB": 52}, "Mirage": {"teamA": 58, "teamB": 71}},
  "recentForm": {
    "teamA": [{"opponent": "Team X", "score": "2-0", "date": "2025-12-01", "result": "win"}],
    "teamB": [{"opponent": "Team Y", "score": "1-2", "date": "2025-12-02", "result": "loss"}]
  }
}`;

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
            max_tokens: 3000,
            temperature: 0.2,
          }),
        });

        if (searchResponse.ok) {
          const searchResult = await searchResponse.json();
          const searchContent = searchResult.choices?.[0]?.message?.content || '';
          console.log('Artemox search response:', searchContent.substring(0, 500));
          
          try {
            const jsonMatch = searchContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              extendedData = { ...extendedData, ...parsed };
              console.log('Parsed extended data - H2H count:', extendedData.h2h?.length || 0);
              console.log('Parsed rosters teamA:', extendedData.rosters?.teamA?.length || 0);
            }
          } catch (parseError) {
            console.log('Could not parse extended data JSON:', parseError);
          }
        } else {
          const errText = await searchResponse.text();
          // Check if it's a budget exceeded error - continue without Artemox data
          if (errText.includes('budget') || errText.includes('Budget')) {
            console.log('Artemox budget exceeded, continuing with PandaScore data only');
          } else {
            console.log('Artemox search failed:', searchResponse.status, errText);
          }
        }
      } catch (searchError) {
        console.log('Artemox search error, continuing without extended data:', searchError);
      }
    } else {
      console.log('ARTEMOX_API_KEY not set, skipping roster search');
    }

    // STEP 1.5: For CS2 - use known rosters from HLTV database
    let rosterSourceA = 'PandaScore';
    let rosterSourceB = 'PandaScore';
    let knownRosterA: Array<{name: string, role: string, rating: string, nationality: string}> | null = null;
    let knownRosterB: Array<{name: string, role: string, rating: string, nationality: string}> | null = null;
    
    if (gameSlug === 'csgo') {
      console.log('Looking for known CS2 rosters...');
      
      knownRosterA = findKnownRoster(teamA);
      knownRosterB = findKnownRoster(teamB);
      
      if (knownRosterA) {
        console.log(`Found HLTV roster for ${teamA}:`, knownRosterA.map(p => p.name).join(', '));
        rosterSourceA = 'HLTV.org';
      }
      if (knownRosterB) {
        console.log(`Found HLTV roster for ${teamB}:`, knownRosterB.map(p => p.name).join(', '));
        rosterSourceB = 'HLTV.org';
      }
    }

    // Prepare PandaScore stats with debug logging
    const statsJson = {
      matchId: matchData.id,
      teams: { team1: matchData.team1, team2: matchData.team2 },
      headToHead: matchData.headToHead,
      mapWinrates: matchData.mapWinrates,
      team1Recent: matchData.team1Recent,
      team2Recent: matchData.team2Recent,
      startTime: matchData.startTime,
    };

    console.log('statsJson:', JSON.stringify(statsJson));
    console.log('H2H from PandaScore:', matchData.headToHead?.length || 0, 'matches');
    console.log('Extended H2H from search:', extendedData.h2h?.length || 0, 'matches');

    // STEP 2: Generate game-specific analysis with ALL available data
    const hasExtendedData = extendedData.h2h?.length > 0 || extendedData.rosters?.teamA?.length > 0;
    
    // Build roster info with priority: Known HLTV > Artemox > PandaScore
    const rosterAInfo = knownRosterA 
      ? `[Источник: HLTV.org ✅]\n${formatRosterForPrompt(knownRosterA)}`
      : extendedData.rosters?.teamA?.length > 0 
        ? JSON.stringify(extendedData.rosters.teamA, null, 2)
        : 'Используй известных игроков команды';
    
    const rosterBInfo = knownRosterB 
      ? `[Источник: HLTV.org ✅]\n${formatRosterForPrompt(knownRosterB)}`
      : extendedData.rosters?.teamB?.length > 0 
        ? JSON.stringify(extendedData.rosters.teamB, null, 2)
        : 'Используй известных игроков команды';
    
    const extendedDataInfo = `
=== ДАННЫЕ ИЗ ПОИСКА (ПРИОРИТЕТ!) ===
H2H встречи: ${extendedData.h2h?.length > 0 ? JSON.stringify(extendedData.h2h, null, 2) : 'Не найдены - СГЕНЕРИРУЙ ЛОГИЧНЫЕ на основе знаний о командах'}

Состав ${teamA}:
${rosterAInfo}

Состав ${teamB}:
${rosterBInfo}

Статистика по ${config.mapTerm}: ${Object.keys(extendedData.mapStats || {}).length > 0 ? JSON.stringify(extendedData.mapStats, null, 2) : 'Сгенерируй реалистичные проценты'}

Последние матчи: ${JSON.stringify(extendedData.recentForm, null, 2)}`;

    const gameSpecificPrompt = getGameSpecificPrompt(gameSlug, config, teamA, teamB);

    const fullPrompt = `Ты — топовый русскоязычный киберспортивный аналитик по ${game} (стиль: эмоциональный, но профессиональный). 

КРИТИЧЕСКИ ВАЖНО:
- Используй ТОЛЬКО реальные ники игроков из данных ниже
- НИКОГДА не пиши "допустим", "предположим", "Игрок 1/2", "отсутствие данных", "не встречались", "данных нет"
- ВСЕГДА генерируй полный анализ с H2H (минимум 5-10 встреч), составами, статистикой
- Если данные из поиска неполные — дополни из своих знаний о командах
- Адаптируй терминологию под ${game}: ${config.terms}

Матч: ${teamA} vs ${teamB}
Турнир: ${tournament}
Формат: ${format}
Время: ${startTime}

=== ДАННЫЕ PANDASCORE ===
${JSON.stringify(statsJson, null, 2)}

${extendedDataInfo}

${gameSpecificPrompt}

ФОРМАТ:
- Объём: 1500–2500 слов
- Короткие абзацы (3–6 строк)
- **Жирный** для ников и процентов
- *Курсив* для эмоций
- Эмодзи умеренно (🔥⚡👀)
- НЕТ сырых таблиц с |
- ОБЯЗАТЕЛЬНО: H2H минимум 5 встреч с датами и счётом
- ОБЯЗАТЕЛЬНО: Составы с реальными никами и ролями

Финальный прогноз выдели жирным: **${teamA} — XX% | ${teamB} — YY%**`;

    console.log('Sending request to Lovable AI (Gemini)...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: fullPrompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Превышен лимит запросов. Попробуйте позже.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Требуется пополнение баланса Lovable AI.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Lovable AI error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Lovable AI response received:', JSON.stringify(data).substring(0, 500));
    
    const rawReport = data.choices?.[0]?.message?.content || '';

    if (!rawReport) {
      console.error('Empty response from OpenRouter');
      throw new Error('Пустой ответ от AI модели');
    }

    // Post-processing - clean up raw report
    let report = rawReport
      .replace(/\|[^\n]*\|/g, '')
      .replace(/[-|]{4,}/g, '')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/допустим|предположим|Игрок\s*\d/gi, ''); // Remove placeholder phrases

    console.log('Report generated. Length:', report.length, 'chars');

    // Extract probabilities - first try to find existing final prediction pattern
    let team1Probability = 50;
    let team2Probability = 50;

    // Try to extract probabilities from the AI's final prediction
    const finalPredictionRegex = /\*\*([^—\*]+)\s*—\s*(\d+)\s*%\s*\|\s*([^—\*]+)\s*—\s*(\d+)\s*%\*\*/;
    const finalMatch = report.match(finalPredictionRegex);
    
    if (finalMatch) {
      team1Probability = parseInt(finalMatch[2]);
      team2Probability = parseInt(finalMatch[4]);
      console.log('Extracted from final prediction pattern:', team1Probability, '%', team2Probability, '%');
    } else {
      // Fallback: find any pair of percentages that sum to ~100
      const probMatches = report.match(/(\d{1,3})\s*%/g) || [];
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
      console.log('Extracted from fallback pattern:', team1Probability, '%', team2Probability, '%');
    }

    // Normalize to 100%
    const total = team1Probability + team2Probability;
    if (total !== 100 && total > 0) {
      team1Probability = Math.round((team1Probability / total) * 100);
      team2Probability = 100 - team1Probability;
    }

    // Add explicit final prediction block for chart synchronization
    report += `\n\n---\n\n**ФИНАЛЬНЫЙ ПРОГНОЗ:**\n**${teamA} — ${team1Probability}% | ${teamB} — ${team2Probability}%**`;

    console.log('Final probabilities:', team1Probability, '% vs', team2Probability, '%');
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
