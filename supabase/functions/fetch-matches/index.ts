import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fetch matches from GRID API for CS2 and Dota 2
// GRID API integration - currently returning to PandaScore as primary
// GRID Open Access API requires specific schema access that may not be available with free keys
async function fetchFromGRID(game: string, GRID_API_KEY: string): Promise<any[] | null> {
  // Temporarily disabled - GRID API schema not accessible with current key
  // Will fallback to PandaScore for now
  console.log(`GRID API temporarily disabled for ${game}, using PandaScore`);
  return null;
}

// Fetch matches from PandaScore (fallback)
async function fetchFromPandaScore(
  game: string | null, 
  status: string | null, 
  date: string | null,
  leagueId: string | null,
  PANDA_SCORE_TOKEN: string
): Promise<any[]> {
  const gameSlugMap: Record<string, string> = {
    cs2: "csgo",
    dota2: "dota2",
    lol: "lol",
    valorant: "valorant",
    CS2: "csgo",
    "Dota 2": "dota2",
    LoL: "lol",
    Valorant: "valorant",
  };

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setUTCHours(23, 59, 59, 999);
  
  const tomorrowStart = new Date(todayEnd);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
  tomorrowStart.setUTCHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setUTCHours(23, 59, 59, 999);
  
  const weekEnd = new Date(now);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  
  const sevenDaysAhead = new Date(now);
  sevenDaysAhead.setUTCDate(sevenDaysAhead.getUTCDate() + 7);

  let url: string;
  const params = new URLSearchParams();
  
  if (game && game !== 'all') {
    const slug = gameSlugMap[game];
    if (!slug) {
      throw new Error('Invalid game selection');
    }
    
    if (status === 'live') {
      url = `https://api.pandascore.co/${slug}/matches/running`;
    } else {
      url = `https://api.pandascore.co/${slug}/matches/upcoming`;
    }
  } else {
    url = 'https://api.pandascore.co/matches';
    
    if (status === 'live') {
      params.append('filter[status]', 'running');
    } else if (status === 'upcoming') {
      params.append('filter[status]', 'not_started');
    }
  }
  
  if (status !== 'live' && status !== 'upcoming' && game && game !== 'all') {
    if (date === 'today') {
      params.append('range[begin_at]', `${todayStart.toISOString()},${todayEnd.toISOString()}`);
    } else if (date === 'tomorrow') {
      params.append('range[begin_at]', `${tomorrowStart.toISOString()},${tomorrowEnd.toISOString()}`);
    } else if (date === 'week') {
      params.append('range[begin_at]', `${now.toISOString()},${weekEnd.toISOString()}`);
    }
  } else if (status !== 'live' && (!game || game === 'all')) {
    if (date === 'today') {
      params.append('range[begin_at]', `${todayStart.toISOString()},${todayEnd.toISOString()}`);
    } else if (date === 'tomorrow') {
      params.append('range[begin_at]', `${tomorrowStart.toISOString()},${tomorrowEnd.toISOString()}`);
    } else if (date === 'week') {
      params.append('range[begin_at]', `${now.toISOString()},${weekEnd.toISOString()}`);
    } else {
      params.append('range[begin_at]', `${now.toISOString()},${sevenDaysAhead.toISOString()}`);
    }
  }
  
  if (leagueId && leagueId !== 'all') {
    params.append('filter[league_id]', leagueId);
  }
  
  params.append('sort', 'begin_at');
  params.append('per_page', '200');
  
  if (params.toString()) {
    url += '?' + params.toString();
  }

  console.log('Fetching matches from PandaScore:', url);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${PANDA_SCORE_TOKEN}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('PandaScore API error:', response.status, errorText);
    throw new Error(`PandaScore error: ${response.status}`);
  }

  const data = await response.json();
  console.log(`Fetched ${data.length} matches from PandaScore`);

  return data
    .filter((match: any) => {
      const matchStatus = match.status;
      return matchStatus === 'not_started' || matchStatus === 'running';
    })
    .map((match: any) => {
      const beginAt = new Date(match.begin_at || match.scheduled_at);
      const moscowTime = new Date(beginAt.getTime() + (3 * 60 * 60 * 1000));
      
      const day = moscowTime.getUTCDate().toString().padStart(2, '0');
      const month = (moscowTime.getUTCMonth() + 1).toString().padStart(2, '0');
      const hours = moscowTime.getUTCHours().toString().padStart(2, '0');
      const minutes = moscowTime.getUTCMinutes().toString().padStart(2, '0');
      
      const team1Name = match.opponents?.[0]?.opponent?.name;
      const team2Name = match.opponents?.[1]?.opponent?.name;
      const team1Logo = match.opponents?.[0]?.opponent?.image_url;
      const team2Logo = match.opponents?.[1]?.opponent?.image_url;
      
      const isQualifier = !team1Name || !team2Name || 
                         team1Name.toLowerCase().includes('tbd') || 
                         team2Name.toLowerCase().includes('tbd');
      
      return {
        id: match.id.toString(),
        team1: {
          name: team1Name || 'Qualifier Team 1',
          logo: team1Logo || '',
        },
        team2: {
          name: team2Name || 'Qualifier Team 2',
          logo: team2Logo || '',
        },
        tournament: match.league?.name || match.serie?.full_name || 'Unknown Tournament',
        startTime: `${day}.${month} в ${hours}:${minutes}`,
        status: match.status === 'running' ? 'live' : 'upcoming',
        game: match.videogame?.name || 'Unknown',
        isQualifier,
        source: 'pandascore',
      };
    });
}

const legacyHandler = async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (Deno.env.get("PREDICTOR_LEGACY_PROVIDERS_ENABLED") !== "true") {
    return Response.json({ error: "LEGACY_PROVIDER_DISABLED" }, { status: 503, headers: corsHeaders });
  }
  try {
    const { game, date, status, leagueId } = await req.json();
    const PANDA_SCORE_TOKEN = Deno.env.get('PANDA_SCORE_TOKEN');
    const GRID_API_KEY = Deno.env.get('GRID_API_KEY');
    
    if (!PANDA_SCORE_TOKEN) {
      console.error('PANDA_SCORE_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let matches: any[] = [];

    // For CS2 and Dota 2, try GRID first
    if ((game === 'cs2' || game === 'dota2') && GRID_API_KEY) {
      console.log(`Trying GRID API for ${game}...`);
      const gridMatches = await fetchFromGRID(game, GRID_API_KEY);
      
      if (gridMatches && gridMatches.length > 0) {
        console.log(`Using GRID data for ${game}: ${gridMatches.length} matches`);
        matches = gridMatches;
      } else {
        console.log(`GRID returned no data, falling back to PandaScore for ${game}`);
        matches = await fetchFromPandaScore(game, status, date, leagueId, PANDA_SCORE_TOKEN);
      }
    } else {
      // For LoL, Valorant, or all games - use PandaScore
      matches = await fetchFromPandaScore(game, status, date, leagueId, PANDA_SCORE_TOKEN);
    }

    // Apply status filter if GRID was used (GRID doesn't filter by live/upcoming as granularly)
    if (status === 'live') {
      matches = matches.filter(m => m.status === 'live');
    } else if (status === 'upcoming') {
      matches = matches.filter(m => m.status === 'upcoming');
    }

    return new Response(
      JSON.stringify({ matches }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-matches function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
 };
// Legacy fan-out stays unreachable until strict, budgeted adapters replace it.
serve((req) => req.method === "OPTIONS"
  ? new Response(null, { headers: corsHeaders })
  : Response.json({ error: "LEGACY_PROVIDER_DISABLED" }, { status: 503, headers: corsHeaders }));
