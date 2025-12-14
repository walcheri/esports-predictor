import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Check if game is CS2 or Dota 2 (eligible for GRID)
function isGRIDEligible(game: string): boolean {
  const gameLower = game?.toLowerCase() || '';
  return gameLower.includes('counter-strike') || 
         gameLower.includes('cs2') || 
         gameLower.includes('cs:go') ||
         gameLower.includes('dota');
}

// Fetch roster data from GRID API for CS2/Dota 2
async function fetchGRIDRosters(
  team1Name: string, 
  team2Name: string, 
  game: string,
  GRID_API_KEY: string
): Promise<{
  team1Players: any[];
  team2Players: any[];
  source: 'grid' | null;
}> {
  try {
    const gridGame = game.toLowerCase().includes('dota') ? 'dota2' : 'counterstrike';
    
    console.log(`Fetching rosters from GRID for ${team1Name} vs ${team2Name} (${gridGame})...`);
    
    // Use REST API to search for teams
    const searchTeam = async (teamName: string) => {
      const url = `https://api.grid.gg/central-data/graphql`;
      
      const query = `
        query SearchTeam($name: String!, $game: String!) {
          teams(
            first: 5
            filter: {
              name: { contains: $name }
              gameSlug: { eq: $game }
            }
          ) {
            edges {
              node {
                id
                name
                players {
                  id
                  nickname
                  role
                  firstName
                  lastName
                }
              }
            }
          }
        }
      `;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': GRID_API_KEY,
        },
        body: JSON.stringify({
          query,
          variables: { name: teamName, game: gridGame }
        }),
      });
      
      if (!response.ok) {
        console.log(`GRID team search failed for ${teamName}:`, response.status);
        return null;
      }
      
      const data = await response.json();
      if (data.errors) {
        console.log('GRID GraphQL errors:', data.errors);
        return null;
      }
      
      const teams = data.data?.teams?.edges || [];
      if (teams.length > 0) {
        return teams[0].node;
      }
      return null;
    };
    
    // Search both teams in parallel
    const [team1Data, team2Data] = await Promise.all([
      searchTeam(team1Name),
      searchTeam(team2Name),
    ]);
    
    const transformPlayers = (team: any) => {
      if (!team?.players?.length) return [];
      return team.players.map((p: any) => ({
        name: p.nickname || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unknown',
        role: p.role || 'Player',
        image: '',
        source: 'grid',
      }));
    };
    
    const team1Players = transformPlayers(team1Data);
    const team2Players = transformPlayers(team2Data);
    
    console.log(`GRID rosters: ${team1Name} (${team1Players.length} players), ${team2Name} (${team2Players.length} players)`);
    
    if (team1Players.length > 0 || team2Players.length > 0) {
      return { team1Players, team2Players, source: 'grid' };
    }
    
    return { team1Players: [], team2Players: [], source: null };
  } catch (error) {
    console.log('Error fetching GRID rosters:', error);
    return { team1Players: [], team2Players: [], source: null };
  }
}

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

// Get game slug for sources
function getGameSources(game: string): string {
  const gameLower = game?.toLowerCase() || '';
  if (gameLower.includes('valorant')) return 'VLR.gg, Liquipedia Valorant';
  if (gameLower.includes('dota')) return 'Dotabuff.com, Liquipedia Dota 2';
  if (gameLower.includes('lol') || gameLower.includes('league')) return 'OP.GG, Leaguepedia';
  return 'HLTV.org, Liquipedia CS'; // CS2 default
}

// Artemox fallback for incomplete data
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
  
  const searchPrompt = `Найди РЕАЛЬНЫЕ данные для матча ${team1Name} vs ${team2Name} (${game}, ${tournament}, декабрь 2025).

ОБЯЗАТЕЛЬНО найди:
1. Правильные полные названия команд (если одна из них "Team 1" или "TBD" — найди реальное название)
2. Составы обеих команд: реальные ники игроков, роли, KDA
3. H2H (последние 10 встреч): дата, счёт, карта/патч

Источники: ${sources}

Ответ СТРОГО в JSON (без markdown):
{
  "team1": {"name": "Реальное название", "players": [{"name": "ник", "role": "IGL", "kda": "1.15"}]},
  "team2": {"name": "Реальное название", "players": [{"name": "ник", "role": "AWPer", "kda": "1.22"}]},
  "h2h": [{"date": "15.11.2025", "winner": "team_name", "score": "2-1", "map": "Inferno"}]
}`;

  try {
    console.log('Enriching with Artemox for:', team1Name, 'vs', team2Name);
    
    const response = await fetch('https://api.artemox.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ARTEMOX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{ role: 'user', content: searchPrompt }],
        max_tokens: 2000,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.log('Artemox enrichment failed:', response.status, errText);
      return { team1: null, team2: null, h2h: [] };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';
    console.log('Artemox response:', content.substring(0, 300));

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('Parsed Artemox data - Team1:', parsed.team1?.name, 'Team2:', parsed.team2?.name);
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
    const GRID_API_KEY = Deno.env.get('GRID_API_KEY');
    
    if (!PANDA_SCORE_TOKEN) {
      console.error('PANDA_SCORE_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching match details for ID: ${matchId}`);

    // Fetch match details
    const matchResponse = await fetch(`https://api.pandascore.co/matches/${matchId}`, {
      headers: {
        'Authorization': `Bearer ${PANDA_SCORE_TOKEN}`,
        'Accept': 'application/json',
      },
    });

    if (!matchResponse.ok) {
      const errorText = await matchResponse.text();
      console.error('PandaScore API error (match):', matchResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch match details' }),
        { status: matchResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const match = await matchResponse.json();

    // Get team IDs
    const team1Id = match.opponents?.[0]?.opponent?.id;
    const team2Id = match.opponents?.[1]?.opponent?.id;
    const videogameId = match.videogame?.id;
    const gameName = match.videogame?.name || 'Unknown';
    const tournamentName = match.league?.name || match.serie?.full_name || 'Unknown Tournament';

    // Initial team names from PandaScore
    let team1Name = match.opponents?.[0]?.opponent?.name || 'Team 1';
    let team2Name = match.opponents?.[1]?.opponent?.name || 'Team 2';
    let team1Logo = match.opponents?.[0]?.opponent?.image_url || '';
    let team2Logo = match.opponents?.[1]?.opponent?.image_url || '';

    // Date ranges for queries
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Fetch all PandaScore data in parallel
    const [team1Matches, team2Matches, team1Players, team2Players, headToHead] = await Promise.all([
      fetch(`https://api.pandascore.co/teams/${team1Id}/matches?filter[finished]=true&page[size]=5&sort=-scheduled_at`, {
        headers: { 'Authorization': `Bearer ${PANDA_SCORE_TOKEN}`, 'Accept': 'application/json' },
      }).then(r => r.ok ? r.json() : []),
      
      fetch(`https://api.pandascore.co/teams/${team2Id}/matches?filter[finished]=true&page[size]=5&sort=-scheduled_at`, {
        headers: { 'Authorization': `Bearer ${PANDA_SCORE_TOKEN}`, 'Accept': 'application/json' },
      }).then(r => r.ok ? r.json() : []),

      fetch(`https://api.pandascore.co/teams/${team1Id}/players`, {
        headers: { 'Authorization': `Bearer ${PANDA_SCORE_TOKEN}`, 'Accept': 'application/json' },
      }).then(r => r.ok ? r.json() : []),

      fetch(`https://api.pandascore.co/teams/${team2Id}/players`, {
        headers: { 'Authorization': `Bearer ${PANDA_SCORE_TOKEN}`, 'Accept': 'application/json' },
      }).then(r => r.ok ? r.json() : []),

      fetch(`https://api.pandascore.co/matches?filter[opponents_id][]=${team1Id}&filter[opponents_id][]=${team2Id}&range[scheduled_at]=${sixMonthsAgoStr},&filter[finished]=true&page[size]=10&sort=-scheduled_at`, {
        headers: { 'Authorization': `Bearer ${PANDA_SCORE_TOKEN}`, 'Accept': 'application/json' },
      }).then(r => r.ok ? r.json() : []),
    ]);

    console.log(`PandaScore data: ${team1Matches.length} matches team1, ${team2Matches.length} team2, ${headToHead.length} H2H, ${team1Players.length} players1, ${team2Players.length} players2`);

    // Check if we need Artemox fallback
    const needsFallback = 
      isIncompleteTeamName(team1Name) || 
      isIncompleteTeamName(team2Name) || 
      team1Players.length === 0 || 
      team2Players.length === 0 ||
      headToHead.length === 0;

    let artemoxData: {
      team1: { name: string; players: any[] } | null;
      team2: { name: string; players: any[] } | null;
      h2h: any[];
    } = { team1: null, team2: null, h2h: [] };
    
    if (needsFallback && ARTEMOX_API_KEY) {
      console.log('Incomplete PandaScore data, using Artemox fallback...');
      artemoxData = await enrichWithArtemox(team1Name, team2Name, gameName, tournamentName, ARTEMOX_API_KEY);
      
      // Override with Artemox data if available
      if (artemoxData.team1?.name && isIncompleteTeamName(team1Name)) {
        team1Name = artemoxData.team1.name;
        console.log('Updated team1 name from Artemox:', team1Name);
      }
      if (artemoxData.team2?.name && isIncompleteTeamName(team2Name)) {
        team2Name = artemoxData.team2.name;
        console.log('Updated team2 name from Artemox:', team2Name);
      }
    }

    // Merge players from PandaScore and Artemox
    // Try to get roster data from GRID for CS2/Dota 2
    let gridRosters: { team1Players: any[]; team2Players: any[]; source: 'grid' | null } = {
      team1Players: [],
      team2Players: [],
      source: null,
    };
    
    if (isGRIDEligible(gameName) && GRID_API_KEY && (team1Players.length === 0 || team2Players.length === 0)) {
      console.log(`Game ${gameName} is GRID-eligible, fetching rosters from GRID...`);
      gridRosters = await fetchGRIDRosters(team1Name, team2Name, gameName, GRID_API_KEY);
    }

    // Priority: GRID > PandaScore > Artemox
    let mergedTeam1Players: any[] = [];
    let mergedTeam2Players: any[] = [];
    let rostersSource: 'grid' | 'pandascore' | 'artemox' | null = null;
    
    if (gridRosters.source === 'grid' && (gridRosters.team1Players.length > 0 || gridRosters.team2Players.length > 0)) {
      // Use GRID rosters
      mergedTeam1Players = gridRosters.team1Players.length > 0 ? gridRosters.team1Players : [];
      mergedTeam2Players = gridRosters.team2Players.length > 0 ? gridRosters.team2Players : [];
      rostersSource = 'grid';
      console.log('Using GRID rosters');
    } else if (team1Players.length > 0 || team2Players.length > 0) {
      // Use PandaScore rosters
      mergedTeam1Players = team1Players.slice(0, 10).map((p: any) => ({
        name: p.name || `${p.first_name} ${p.last_name}`.trim(),
        role: p.role || 'Player',
        image: p.image_url || '',
      }));
      mergedTeam2Players = team2Players.slice(0, 10).map((p: any) => ({
        name: p.name || `${p.first_name} ${p.last_name}`.trim(),
        role: p.role || 'Player',
        image: p.image_url || '',
      }));
      rostersSource = 'pandascore';
      console.log('Using PandaScore rosters');
    } else if (artemoxData.team1?.players || artemoxData.team2?.players) {
      // Use Artemox rosters as fallback
      mergedTeam1Players = (artemoxData.team1?.players || []).map((p: any) => ({
        name: p.name || p.nick || 'Unknown',
        role: p.role || 'Player',
        image: '',
        kda: p.kda || null,
      }));
      mergedTeam2Players = (artemoxData.team2?.players || []).map((p: any) => ({
        name: p.name || p.nick || 'Unknown',
        role: p.role || 'Player',
        image: '',
        kda: p.kda || null,
      }));
      rostersSource = 'artemox';
      console.log('Using Artemox rosters');
    }

    // Calculate map winrates
    const calculateMapWinrate = (teamId: number, matches: any[]) => {
      const mapMatches = matches.filter((m: any) => {
        const matchDate = new Date(m.scheduled_at || m.begin_at);
        return matchDate >= threeMonthsAgo && m.videogame?.id === videogameId;
      });
      const wins = mapMatches.filter((m: any) => m.winner_id === teamId).length;
      return mapMatches.length > 0 ? Math.round((wins / mapMatches.length) * 100) : 0;
    };

    // Merge H2H from PandaScore and Artemox
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

    // Transform match details
    const matchDetails = {
      id: match.id.toString(),
      team1: {
        name: team1Name,
        logo: team1Logo,
        id: team1Id,
        players: mergedTeam1Players,
      },
      team2: {
        name: team2Name,
        logo: team2Logo,
        id: team2Id,
        players: mergedTeam2Players,
      },
      tournament: tournamentName,
      game: gameName,
      status: match.status === 'running' ? 'live' : 'upcoming',
      startTime: new Date(match.scheduled_at || match.begin_at).toLocaleString('ru-RU'),
      streamUrl: match.streams_list?.[0]?.raw_url || match.official_stream_url || null,
      
      bestOf: match.number_of_games || 1,
      
      headToHead: {
        matches: mergedH2H,
        team1Wins: team1H2HWins,
        team2Wins: team2H2HWins,
      },
      
      mapWinrates: {
        team1: calculateMapWinrate(team1Id, team1Matches),
        team2: calculateMapWinrate(team2Id, team2Matches),
      },
      
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
      
      // Flag for frontend to know data source
      rostersSource,
      enrichedWithArtemox: needsFallback && (artemoxData.team1 !== null || artemoxData.team2 !== null),
    };

    console.log('Final match details:', team1Name, 'vs', team2Name, '| Players:', mergedTeam1Players.length, '/', mergedTeam2Players.length, '| H2H:', mergedH2H.length);

    return new Response(
      JSON.stringify(matchDetails),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-match-details function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
