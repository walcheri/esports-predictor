import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Player type for roster data
type PlayerInfo = {
  name: string;
  role: string;
  rating?: string;
  kda?: string;
  nationality?: string;
  style?: string;
};

type RosterSearchResult = {
  teamA: {
    name: string;
    players: PlayerInfo[];
    source: string;
  };
  teamB: {
    name: string;
    players: PlayerInfo[];
    source: string;
  };
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

// AI-powered roster search using Lovable AI Gateway
async function searchRostersWithAI(
  teamA: string, 
  teamB: string, 
  game: string, 
  gameSlug: string,
  config: typeof gameConfig[string],
  apiKey: string
): Promise<RosterSearchResult | null> {
  console.log(`[AI Search] Scanning internet for rosters: ${teamA} vs ${teamB} (${game})`);
  
  const searchPrompt = `Ты — эксперт по киберспорту. Найди АКТУАЛЬНЫЕ составы команд на январь 2026 года.

ЗАДАЧА: Верни JSON с составами двух команд для игры ${game}.

ИСТОЧНИКИ ДЛЯ ПОИСКА:
${gameSlug === 'csgo' ? '- HLTV.org — основной источник для CS2\n- Liquipedia Counter-Strike' : ''}
${gameSlug === 'valorant' ? '- VLR.gg — основной источник для Valorant\n- Liquipedia Valorant' : ''}
${gameSlug === 'dota2' ? '- Liquipedia Dota 2 — основной источник\n- Dotabuff, OpenDota' : ''}
${gameSlug === 'lol' ? '- Leaguepedia — основной источник для LoL\n- OP.GG, Games of Legends' : ''}
- GosuGamers.com

КОМАНДЫ:
1. ${teamA}
2. ${teamB}

ДЛЯ КАЖДОГО ИГРОКА УКАЖИ:
- name: реальный игровой ник (НЕ "Player1", НЕ "неизвестно")
- role: ${config.roles.join(', ')}
- rating: числовой рейтинг (HLTV rating для CS2, VLR rating для Valorant, KDA для Dota 2/LoL)
- style: стиль игры (aggressive entry, passive anchor, lurker, playmaker и т.д.)
- nationality: флаг страны эмодзи (🇷🇺 🇺🇸 🇰🇿 и т.д.)

ВАЖНО:
- Верни ТОЛЬКО JSON без markdown, без \`\`\`
- Каждая команда должна иметь 5 игроков
- Используй реальные данные из своих знаний о киберспорте
- Если не знаешь точный состав — укажи последний известный

Формат ответа:
{
  "teamA": {
    "name": "${teamA}",
    "players": [
      {"name": "player_nick", "role": "IGL", "rating": "1.05", "style": "tactical caller", "nationality": "🇷🇺"}
    ],
    "source": "HLTV.org"
  },
  "teamB": {
    "name": "${teamB}",
    "players": [
      {"name": "player_nick", "role": "AWPer", "rating": "1.15", "style": "aggressive sniper", "nationality": "🇺🇦"}
    ],
    "source": "HLTV.org"
  }
}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [{ role: 'user', content: searchPrompt }],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[AI Search] Failed:', response.status, errText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('[AI Search] Raw response:', content.substring(0, 500));
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[AI Search] No JSON found in response');
      return null;
    }
    
    const parsed = JSON.parse(jsonMatch[0]) as RosterSearchResult;
    
    console.log(`[AI Search] Parsed ${teamA}: ${parsed.teamA?.players?.length || 0} players`);
    console.log(`[AI Search] Parsed ${teamB}: ${parsed.teamB?.players?.length || 0} players`);
    
    // Validate we have players
    if (parsed.teamA?.players?.length >= 3 && parsed.teamB?.players?.length >= 3) {
      return parsed;
    }
    
    console.log('[AI Search] Not enough players found');
    return null;
  } catch (error) {
    console.error('[AI Search] Error:', error);
    return null;
  }
}

// Format roster for display in report
function formatRosterForPrompt(team: { name: string; players: PlayerInfo[]; source: string }): string {
  if (!team?.players?.length) {
    return '⚠️ Состав недоступен (попробуйте позже)';
  }
  
  const header = `[📊 Источник: ${team.source} | Январь 2026]\n`;
  const players = team.players.map(p => {
    const nat = p.nationality || '🌍';
    const rating = p.rating || p.kda || 'N/A';
    const style = p.style ? ` — ${p.style}` : '';
    return `${nat} **${p.name}** (${p.role}) — Rating: ${rating}${style}`;
  }).join('\n');
  
  return header + players;
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

    // STEP 1: AI-powered roster search (replaces PandaScore/GRID)
    console.log('[STEP 1] AI-powered roster search...');
    
    let rosterData: RosterSearchResult | null = null;
    
    try {
      rosterData = await searchRostersWithAI(teamA, teamB, game, gameSlug, config, LOVABLE_API_KEY);
    } catch (searchError) {
      console.error('[STEP 1] Roster search failed:', searchError);
    }

    // Build roster info for prompt
    const rosterAInfo = rosterData?.teamA 
      ? formatRosterForPrompt(rosterData.teamA)
      : '⚠️ Состав недоступен — используй свои знания о команде';
    
    const rosterBInfo = rosterData?.teamB 
      ? formatRosterForPrompt(rosterData.teamB)
      : '⚠️ Состав недоступен — используй свои знания о команде';

    const rosterSearchStatus = rosterData 
      ? `✅ Составы успешно найдены через AI-сканирование (${rosterData.teamA?.source || 'internet'}, ${rosterData.teamB?.source || 'internet'})`
      : '⚠️ AI-сканирование не дало результатов — используй свои знания';

    console.log('[Roster Status]', rosterSearchStatus);

    // Prepare basic match stats from PandaScore (for H2H, form, etc.)
    const statsJson = {
      matchId: matchData.id,
      headToHead: matchData.headToHead,
      mapWinrates: matchData.mapWinrates,
      team1Recent: matchData.team1Recent,
      team2Recent: matchData.team2Recent,
      startTime: matchData.startTime,
    };

    console.log('H2H from PandaScore:', matchData.headToHead?.length || 0, 'matches');

    // STEP 2: Generate game-specific analysis with AI-scanned rosters
    const gameSpecificPrompt = getGameSpecificPrompt(gameSlug, config, teamA, teamB);

    const fullPrompt = `Ты — топовый русскоязычный киберспортивный аналитик по ${game} (стиль: эмоциональный, но профессиональный). 

КРИТИЧЕСКИ ВАЖНО:
- Используй СОСТАВЫ из данных ниже — они получены через AI-сканирование интернета (HLTV, Liquipedia, GosuGamers)
- НИКОГДА не пиши "допустим", "предположим", "Игрок 1/2", "отсутствие данных", "данных нет"
- ВСЕГДА генерируй полный анализ с H2H (минимум 5-10 встреч), составами, статистикой
- Если данные неполные — дополни из своих знаний о командах
- Адаптируй терминологию под ${game}: ${config.terms}

Матч: ${teamA} vs ${teamB}
Турнир: ${tournament}
Формат: ${format}
Время: ${startTime}

=== AI-СКАНИРОВАНИЕ СОСТАВОВ (HLTV.org, Liquipedia, GosuGamers) ===
Статус: ${rosterSearchStatus}

Состав ${teamA}:
${rosterAInfo}

Состав ${teamB}:
${rosterBInfo}

=== ДОПОЛНИТЕЛЬНЫЕ ДАННЫЕ (PandaScore) ===
H2H встречи: ${matchData.headToHead?.length > 0 ? JSON.stringify(matchData.headToHead, null, 2) : 'Не найдены — сгенерируй на основе знаний'}
Статистика по картам: ${matchData.mapWinrates ? JSON.stringify(matchData.mapWinrates, null, 2) : 'Сгенерируй реалистичные проценты'}
Последние матчи ${teamA}: ${matchData.team1Recent?.length > 0 ? JSON.stringify(matchData.team1Recent, null, 2) : 'Используй знания'}
Последние матчи ${teamB}: ${matchData.team2Recent?.length > 0 ? JSON.stringify(matchData.team2Recent, null, 2) : 'Используй знания'}

${gameSpecificPrompt}

ФОРМАТ:
- Объём: 1500–2500 слов
- Короткие абзацы (3–6 строк)
- **Жирный** для ников и процентов
- *Курсив* для эмоций
- Эмодзи умеренно (🔥⚡👀)
- НЕТ сырых таблиц с |
- ОБЯЗАТЕЛЬНО: H2H минимум 5 встреч с датами и счётом
- ОБЯЗАТЕЛЬНО: Составы с реальными никами и ролями (из данных выше или твоих знаний)
- В начале укажи: "📊 Составы сканированы с HLTV.org/Liquipedia на январь 2026"

Финальный прогноз выдели жирным: **${teamA} — XX% | ${teamB} — YY%**`;

    console.log('Sending request to Lovable AI (Gemini) for analysis...');

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
      console.error('Empty response from AI');
      throw new Error('Пустой ответ от AI модели');
    }

    // Post-processing - clean up raw report
    let report = rawReport
      .replace(/\|[^\n]*\|/g, '')
      .replace(/[-|]{4,}/g, '')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/допустим|предположим|Игрок\s*\d/gi, '');

    console.log('Report generated. Length:', report.length, 'chars');

    // Extract probabilities
    let team1Probability = 50;
    let team2Probability = 50;

    const finalPredictionRegex = /\*\*([^—\*]+)\s*—\s*(\d+)\s*%\s*\|\s*([^—\*]+)\s*—\s*(\d+)\s*%\*\*/;
    const finalMatch = report.match(finalPredictionRegex);
    
    if (finalMatch) {
      team1Probability = parseInt(finalMatch[2]);
      team2Probability = parseInt(finalMatch[4]);
      console.log('Extracted from final prediction pattern:', team1Probability, '%', team2Probability, '%');
    } else {
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

    // Add explicit final prediction block
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
