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
    const { game } = await req.json();
    const PANDA_SCORE_TOKEN = Deno.env.get('PANDA_SCORE_TOKEN');
    
    if (!PANDA_SCORE_TOKEN) {
      console.error('PANDA_SCORE_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!game || game === 'all') {
      return new Response(
        JSON.stringify({ tournaments: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map game codes to PandaScore videogame slugs
    // IMPORTANT: PandaScore uses 'lol' not 'league-of-legends', 'dota2' not 'dota-2'
    const gameSlugMap: Record<string, string> = {
      cs2: "csgo",
      dota2: "dota2",
      lol: "lol",
      valorant: "valorant",
    };

    const slug = gameSlugMap[game];
    if (!slug) {
      return new Response(
        JSON.stringify({ error: 'Invalid game selection' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch leagues/tournaments for this game
    const url = `https://api.pandascore.co/${slug}/leagues?per_page=50&sort=-modified_at`;
    
    console.log('Fetching tournaments from PandaScore:', url);

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
        JSON.stringify({ error: 'Failed to fetch tournaments', details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`Fetched ${data.length} tournaments from PandaScore`);

    // Transform data to our format - take top 15 most recent/active
    const tournaments = data
      .slice(0, 15)
      .map((league: any) => ({
        id: league.id.toString(),
        name: league.name,
        slug: league.slug,
      }));

    return new Response(
      JSON.stringify({ tournaments }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-tournaments function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
