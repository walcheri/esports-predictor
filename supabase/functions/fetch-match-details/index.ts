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
    const { matchId } = await req.json();
    const PANDA_SCORE_TOKEN = Deno.env.get('PANDA_SCORE_TOKEN');
    
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

    // Fetch recent matches for both teams in parallel
    const [team1Matches, team2Matches] = await Promise.all([
      fetch(`https://api.pandascore.co/teams/${team1Id}/matches?page[size]=5&sort=-scheduled_at`, {
        headers: {
          'Authorization': `Bearer ${PANDA_SCORE_TOKEN}`,
          'Accept': 'application/json',
        },
      }).then(r => r.ok ? r.json() : []),
      fetch(`https://api.pandascore.co/teams/${team2Id}/matches?page[size]=5&sort=-scheduled_at`, {
        headers: {
          'Authorization': `Bearer ${PANDA_SCORE_TOKEN}`,
          'Accept': 'application/json',
        },
      }).then(r => r.ok ? r.json() : []),
    ]);

    console.log(`Fetched ${team1Matches.length} matches for team 1, ${team2Matches.length} for team 2`);

    // Transform match details
    const matchDetails = {
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
      game: match.videogame?.name || 'Unknown',
      status: match.status === 'running' ? 'live' : 'upcoming',
      startTime: new Date(match.scheduled_at || match.begin_at).toLocaleString('ru-RU'),
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
    };

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
