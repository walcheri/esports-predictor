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
    const { game, date, status } = await req.json();
    const PANDA_SCORE_TOKEN = Deno.env.get('PANDA_SCORE_TOKEN');
    
    if (!PANDA_SCORE_TOKEN) {
      console.error('PANDA_SCORE_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map game codes/names to PandaScore videogame slugs
    const gameSlugMap: Record<string, string> = {
      // New canonical codes from frontend
      cs2: "csgo",
      dota2: "dota2",
      lol: "league-of-legends",
      valorant: "valorant",
      // Backwards compatibility with older values
      CS2: "csgo",
      "Dota 2": "dota2",
      LoL: "league-of-legends",
      Valorant: "valorant",
    };

    // Calculate time ranges
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
    
    const next48Hours = new Date(now);
    next48Hours.setUTCHours(next48Hours.getUTCHours() + 48);
    
    const weekEnd = new Date(now);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

    // Build PandaScore API URL based on game and status
    let url: string;
    const params = new URLSearchParams();
    
    if (game && game !== 'all') {
      const slug = gameSlugMap[game];
      if (!slug) {
        return new Response(
          JSON.stringify({ error: 'Invalid game selection' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Use game-specific endpoints
      if (status === 'live') {
        url = `https://api.pandascore.co/${slug}/matches/running`;
      } else if (status === 'upcoming') {
        url = `https://api.pandascore.co/${slug}/matches/upcoming`;
      } else {
        url = `https://api.pandascore.co/${slug}/matches`;
      }
    } else {
      // All games - use general endpoint
      url = 'https://api.pandascore.co/matches';
      
      if (status === 'live') {
        params.append('filter[status]', 'running');
      } else if (status === 'upcoming') {
        params.append('filter[status]', 'not_started');
      }
    }
    
    // Add time range filters based on date selection
    if (status !== 'live') {
      if (date === 'today') {
        params.append('range[begin_at]', `${todayStart.toISOString()},${todayEnd.toISOString()}`);
      } else if (date === 'tomorrow') {
        params.append('range[begin_at]', `${tomorrowStart.toISOString()},${tomorrowEnd.toISOString()}`);
      } else if (date === 'week') {
        params.append('range[begin_at]', `${now.toISOString()},${weekEnd.toISOString()}`);
      } else {
        // Default: next 48 hours for upcoming/all
        params.append('range[begin_at]', `${now.toISOString()},${next48Hours.toISOString()}`);
      }
    }
    
    // Sort by begin_at ascending
    params.append('sort', 'begin_at');
    
    // Request more matches to show 20+
    params.append('page[size]', '50');
    
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
      return new Response(
        JSON.stringify({ error: 'Failed to fetch matches', details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`Fetched ${data.length} matches from PandaScore`);

    // Transform data to our format and filter out finished matches
    const matches = data
      .filter((match: any) => {
        const matchStatus = match.status;
        // Only include not_started and running matches
        return matchStatus === 'not_started' || matchStatus === 'running';
      })
      .map((match: any) => {
        // Parse begin_at and convert to Moscow time (UTC+3)
        const beginAt = new Date(match.begin_at || match.scheduled_at);
        const moscowTime = new Date(beginAt.getTime() + (3 * 60 * 60 * 1000)); // Add 3 hours for UTC+3
        
        const day = moscowTime.getUTCDate().toString().padStart(2, '0');
        const month = (moscowTime.getUTCMonth() + 1).toString().padStart(2, '0');
        const hours = moscowTime.getUTCHours().toString().padStart(2, '0');
        const minutes = moscowTime.getUTCMinutes().toString().padStart(2, '0');
        
        return {
          id: match.id.toString(),
          team1: {
            name: match.opponents?.[0]?.opponent?.name || 'Team 1',
            logo: match.opponents?.[0]?.opponent?.image_url || '',
          },
          team2: {
            name: match.opponents?.[1]?.opponent?.name || 'Team 2',
            logo: match.opponents?.[1]?.opponent?.image_url || '',
          },
          tournament: match.league?.name || match.serie?.full_name || 'Unknown Tournament',
          startTime: `${day}.${month} в ${hours}:${minutes}`,
          status: match.status === 'running' ? 'live' : 'upcoming',
          game: match.videogame?.name || 'Unknown',
        };
      });

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
});
