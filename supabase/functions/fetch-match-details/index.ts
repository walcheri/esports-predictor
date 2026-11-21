import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { resolveRoster } from "../_shared/rosters/resolver.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Check if team name is incomplete/placeholder
function isIncompleteTeamName(name: string | null | undefined): boolean {
  if (!name) return true;
  const lowerName = name.toLowerCase().trim();
  return (
    lowerName === 'team 1' ||
    lowerName === 'team 2' ||
    lowerName === 'tbd' ||
    lowerName === 'qualifier' ||
    lowerName.startsWith('team ') ||
    lowerName.includes('qualifier') ||
    lowerName.includes('winner of') ||
    lowerName.includes('loser of')
  );
}

// Расширенный список источников (включая русскоязычные сайты)
function getGameSources(game: string): string {
  const gameLower = game?.toLowerCase() || '';
  if (gameLower.includes('valorant')) return 'VLR.gg, Liquipedia Valorant, cybersport.ru, esports.ru';
  if (gameLower.includes('dota')) return 'Dotabuff.com, Liquipedia Dota 2, cybersport.ru, esports.ru';
  if (gameLower.includes('lol') || gameLower.includes('league')) return 'OP.GG, Leaguepedia, cybersport.ru, esports.ru';
  return 'HLTV.org, cybersport.ru, esports.ru, Liquipedia CS'; // CS2 по умолчанию
}

// Artemox — теперь с акцентом на точный парсинг указанных сайтов
async function enrichWithArtemox(
  team1Name: string,
  team2Name: string,
  game: string,
  tournament: string,
  ARTEMOX_API_KEY: string
): Promise<{
  team1: { name: string; players: any[] } | null;
  team2: { name: string; players: any[] } | null;
  h2h: any[];
}> {
  const sources = getGameSources(game);
  const currentDate = new Date().toLocaleString('ru-RU', { year: 'numeric', month: 'long' });

  const searchPrompt = `Найди РЕАЛЬНЫЕ и АКТУАЛЬНЫЕ данные для матча ${team1Name} vs ${team2Name} (${game}, ${tournament}, ${currentDate}).

ОБЯЗАТЕЛЬНО проверь следующие источники и возьми оттуда самые свежие составы:
• HLTV.org (для CS2 — основной источник)
• cybersport.ru
• esports.ru
• Liquipedia / Dotabuff / VLR.gg / OP.GG / Leaguepedia (в зависимости от игры)

Требуется:
1. Правильные полные названия команд
2. Текущие составы обеих команд: никнеймы игроков + роли (IGL, AWPer, Entry и т.д.)
3. H2H (последние 8–10 встреч): дата, победитель, счёт, карты

Ответ СТРОГО в JSON (без markdown, без пояснений):
{
  "team1": {"name": "Реальное название", "players": [{"name": "ник", "role": "IGL", "kda": "1.15"}]},
  "team2": {"name": "Реальное название", "players": [{"name": "ник", "role": "AWPer", "kda": "1.22"}]},
  "h2h": [{"date": "15.03.2026", "winner": "team_name", "score": "2-1", "map": "Inferno"}]
}`;

  try {
    console.log('Enriching with Artemox (расширенные источники):', team1Name, 'vs', team2Name);

    const response = await fetch('https://api.artemox.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ARTEMOX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{ role: 'user', content: searchPrompt }],
        max_tokens: 2500,
        temperature: 0.1,           // ниже температура = более точный и «сухой» ответ
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.log('Artemox failed:', response.status, errText);
      return { team1: null, team2: null, h2h: [] };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';
    console.log('Artemox raw response (first 400 chars):', content.substring(0, 400));

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('✅ Artemox parsed Team1:', parsed.team1?.name, 'Team2:', parsed.team2?.name);
      return {
        team1: parsed.team1 || null,
        team2: parsed.team2 || null,
        h2h: parsed.h2h || [],
      };
    }
  } catch (error) {
    console.log('Artemox enrichment error:', error);
  }

  return { team1: null, team2: null, h2h: [] };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { matchId } = await req.json();
    const PANDA_SCORE_TOKEN = Deno.env.get('PANDA_SCORE_TOKEN');
    const ARTEMOX_API_KEY = Deno.env.get('ARTEMOX_API_KEY');

    if (!PANDA_SCORE_TOKEN) {
      console.error('PANDA_SCORE_TOKEN not configured');
      return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Fetching match details for ID: ${matchId}`);

    // Получаем только базовую информацию матча из PandaScore
    const matchResponse = await fetch(`https://api.pandascore.co/matches/${matchId}`, {
      headers: { 'Authorization': `Bearer ${PANDA_SCORE_TOKEN}`, 'Accept': 'application/json' },
    });

    if (!matchResponse.ok) {
      const errorText = await matchResponse.text();
      console.error('PandaScore API error:', matchResponse.status, errorText);
      return new Response(JSON.stringify({ error: 'Failed to fetch match details' }), { status: matchResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const match = await matchResponse.json();

    const team1Id = match.opponents?.[0]?.opponent?.id;
    const team2Id = match.opponents?.[1]?.opponent?.id;
    const videogameId = match.videogame?.id;
    const gameName = match.videogame?.name || 'Unknown';
    const tournamentName = match.league?.name || match.serie?.full_name || 'Unknown Tournament';

    let team1Name = match.opponents?.[0]?.opponent?.name || 'Team 1';
    let team2Name = match.opponents?.[1]?.opponent?.name || 'Team 2';
    let team1Logo = match.opponents?.[0]?.opponent?.image_url || '';
    let team2Logo = match.opponents?.[1]?.opponent?.image_url || '';

    // PandaScore только для матчей, H2H и статистики (ростеры отключены)
    const [team1Matches, team2Matches, headToHead] = await Promise.all([
      fetch(`https://api.pandascore.co/teams/${team1Id}/matches?filter[finished]=true&page[size]=5&sort=-scheduled_at`, { headers: { 'Authorization': `Bearer ${PANDA_SCORE_TOKEN}` } }).then(r => r.ok ? r.json() : []),
      fetch(`https://api.pandascore.co/teams/${team2Id}/matches?filter[finished]=true&page[size]=5&sort=-scheduled_at`, { headers: { 'Authorization': `Bearer ${PANDA_SCORE_TOKEN}` } }).then(r => r.ok ? r.json() : []),
      fetch(`https://api.pandascore.co/matches?filter[opponents_id][]=${team1Id}&filter[opponents_id][]=${team2Id}&range[scheduled_at]=${new Date(Date.now() - 6*30*24*60*60*1000).toISOString().split('T')[0]},&filter[finished]=true&page[size]=10&sort=-scheduled_at`, { headers: { 'Authorization': `Bearer ${PANDA_SCORE_TOKEN}` } }).then(r => r.ok ? r.json() : []),
    ]);

    // === РОСТЕРЫ ТОЛЬКО ЧЕРЕЗ ПАРСИНГ + ARTEMOX ===
    const [team1Resolved, team2Resolved] = await Promise.all([
      resolveRoster({ gameName, teamName: team1Name }),
      resolveRoster({ gameName, teamName: team2Name }),
    ]);

    const scrapingFailed = team1Resolved.players.length === 0 || team2Resolved.players.length === 0;

    const needsFallback =
      isIncompleteTeamName(team1Name) ||
      isIncompleteTeamName(team2Name) ||
      headToHead.length === 0 ||
      scrapingFailed;

    let artemoxData = { team1: null as any, team2: null as any, h2h: [] as any[] };

    if (needsFallback && ARTEMOX_API_KEY) {
      console.log('Скрапер не дал ростеры → запускаем Artemox с расширенными источниками (HLTV, cybersport.ru, esports.ru)...');
      artemoxData = await enrichWithArtemox(team1Name, team2Name, gameName, tournamentName, ARTEMOX_API_KEY);

      if (artemoxData.team1?.name && isIncompleteTeamName(team1Name)) team1Name = artemoxData.team1.name;
      if (artemoxData.team2?.name && isIncompleteTeamName(team2Name)) team2Name = artemoxData.team2.name;
    }

    // Слияние ростеров
    const mergePlayers = (resolved: any[], artemoxPlayers?: any[]) => {
      if (resolved.length > 0) return resolved;
      if (artemoxPlayers?.length) {
        return artemoxPlayers.map((p: any) => ({
          name: p.name || 'Unknown',
          role: p.role || 'Player',
          image: '',
        }));
      }
      return [];
    };

    const mergedTeam1Players = mergePlayers(team1Resolved.players, artemoxData.team1?.players);
    const mergedTeam2Players = mergePlayers(team2Resolved.players, artemoxData.team2?.players);

    const getRosterSource = (resolved: any, artemoxPlayers?: any[]) => {
      if (resolved.players.length > 0) return resolved.source || 'scraper';
      if (artemoxPlayers?.length) return 'artemox (HLTV + cybersport.ru + esports.ru)';
      return 'none';
    };

    const rostersSource = getRosterSource(team1Resolved, artemoxData.team1?.players) === getRosterSource(team2Resolved, artemoxData.team2?.players)
      ? getRosterSource(team1Resolved, artemoxData.team1?.players)
      : 'mixed';

    // Остальная логика (H2H, винрейты, недавние матчи) без изменений
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const calculateMapWinrate = (teamId: number, matches: any[]) => {
      const mapMatches = matches.filter((m: any) => {
        const matchDate = new Date(m.scheduled_at || m.begin_at);
        return matchDate >= threeMonthsAgo && m.videogame?.id === videogameId;
      });
      const wins = mapMatches.filter((m: any) => m.winner_id === teamId).length;
      return mapMatches.length > 0 ? Math.round((wins / mapMatches.length) * 100) : 0;
    };

    const pandaScoreH2H = headToHead.slice(0, 10).map((m: any) => ({
      date: new Date(m.scheduled_at || m.begin_at).toLocaleDateString('ru-RU'),
      winner: m.winner_id === team1Id ? team1Name : team2Name,
      score: m.results?.map((r: any) => r.score).join('-') || 'N/A',
    }));

    const mergedH2H = pandaScoreH2H.length > 0 ? pandaScoreH2H : artemoxData.h2h;

    const team1H2HWins = headToHead.length > 0
      ? headToHead.filter((m: any) => m.winner_id === team1Id).length
      : artemoxData.h2h.filter((m: any) => m.winner?.toLowerCase().includes(team1Name.toLowerCase().split(' ')[0])).length;

    const team2H2HWins = headToHead.length > 0
      ? headToHead.filter((m: any) => m.winner_id === team2Id).length
      : artemoxData.h2h.filter((m: any) => m.winner?.toLowerCase().includes(team2Name.toLowerCase().split(' ')[0])).length;

    const matchDetails = {
      id: match.id.toString(),
      team1: { name: team1Name, logo: team1Logo, id: team1Id, players: mergedTeam1Players },
      team2: { name: team2Name, logo: team2Logo, id: team2Id, players: mergedTeam2Players },
      tournament: tournamentName,
      game: gameName,
      status: match.status === 'running' ? 'live' : 'upcoming',
      startTime: new Date(match.scheduled_at || match.begin_at).toLocaleString('ru-RU'),
      streamUrl: match.streams_list?.[0]?.raw_url || match.official_stream_url || null,
      bestOf: match.number_of_games || 1,
      headToHead: { matches: mergedH2H, team1Wins: team1H2HWins, team2Wins: team2H2HWins },
      mapWinrates: { team1: calculateMapWinrate(team1Id, team1Matches), team2: calculateMapWinrate(team2Id, team2Matches) },
      team1Recent: team1Matches.slice(0, 5).map((m: any) => ({
        date: new Date(m.scheduled_at || m.begin_at).toLocaleDateString('ru-RU'),
        opponent: m.opponents?.find((o: any) => o.opponent.id !== team1Id)?.opponent?.name || 'Unknown',
        result: m.winner_id === team1Id ? 'win' : 'loss',
        score: m.results?.map((r: any) => r.score).join('-') || 'N/A',
      })),
      team2Recent: team2Matches.slice(0, 5).map((m: any) => ({
        date: new Date(m.scheduled_at || m.begin_at).toLocaleDateString('ru-RU'),
        opponent: m.opponents?.find((o: any) => o.opponent.id !== team2Id)?.opponent?.name || 'Unknown',
        result: m.winner_id === team2Id ? 'win' : 'loss',
        score: m.results?.map((r: any) => r.score).join('-') || 'N/A',
      })),
      rostersSource,
      enrichedWithArtemox: needsFallback && (artemoxData.team1 !== null || artemoxData.team2 !== null),
    };

    console.log('✅ Final match details:', team1Name, 'vs', team2Name,
      '| Players:', mergedTeam1Players.length, '/', mergedTeam2Players.length,
      '| Rosters source:', rostersSource);

    return new Response(JSON.stringify(matchDetails), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in fetch-match-details function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});