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

    // Map game names to PandaScore videogame slugs
    const gameSlugMap: Record<string, string> = {
      'CS2': 'csgo',
      'Dota 2': 'dota2',
      'LoL': 'league-of-legends',
      'Valorant': 'valorant',
    };

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
        params.append('sort', 'scheduled_at');
      }
    } else {
      // All games - use general endpoint
      url = 'https://api.pandascore.co/matches';
      
      if (status === 'live') {
        params.append('filter[status]', 'running');
      } else if (status === 'upcoming') {
        params.append('filter[status]', 'not_started');
      }
      
      params.append('sort', 'scheduled_at');
    }
    
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

    // Transform data to our format
    const matches = data.map((match: any) => ({
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
      startTime: new Date(match.scheduled_at || match.begin_at).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      status: match.status === 'running' ? 'live' : 'upcoming',
      game: match.videogame?.name || 'Unknown',
    }));

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
