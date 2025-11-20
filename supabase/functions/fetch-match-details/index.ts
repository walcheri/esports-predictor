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
    const videogameId = match.videogame?.id;

    // Date 6 months ago for H2H
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    // Date 3 months ago for map winrate
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];

    // Fetch all data in parallel
    const [team1Matches, team2Matches, team1Players, team2Players, headToHead] = await Promise.all([
      // Recent matches for team 1
      fetch(`https://api.pandascore.co/teams/${team1Id}/matches?filter[finished]=true&page[size]=5&sort=-scheduled_at`, {
        headers: { 'Authorization': `Bearer ${PANDA_SCORE_TOKEN}`, 'Accept': 'application/json' },
      }).then(r => r.ok ? r.json() : []),
      
      // Recent matches for team 2
      fetch(`https://api.pandascore.co/teams/${team2Id}/matches?filter[finished]=true&page[size]=5&sort=-scheduled_at`, {
        headers: { 'Authorization': `Bearer ${PANDA_SCORE_TOKEN}`, 'Accept': 'application/json' },
      }).then(r => r.ok ? r.json() : []),

      // Team 1 players
      fetch(`https://api.pandascore.co/teams/${team1Id}/players`, {
        headers: { 'Authorization': `Bearer ${PANDA_SCORE_TOKEN}`, 'Accept': 'application/json' },
      }).then(r => r.ok ? r.json() : []),

      // Team 2 players
      fetch(`https://api.pandascore.co/teams/${team2Id}/players`, {
        headers: { 'Authorization': `Bearer ${PANDA_SCORE_TOKEN}`, 'Accept': 'application/json' },
      }).then(r => r.ok ? r.json() : []),

      // Head to Head (last 10 matches between these teams in last 6 months)
      fetch(`https://api.pandascore.co/matches?filter[opponents_id][]=${team1Id}&filter[opponents_id][]=${team2Id}&range[scheduled_at]=${sixMonthsAgoStr},&filter[finished]=true&page[size]=10&sort=-scheduled_at`, {
        headers: { 'Authorization': `Bearer ${PANDA_SCORE_TOKEN}`, 'Accept': 'application/json' },
      }).then(r => r.ok ? r.json() : []),
    ]);

    console.log(`Fetched ${team1Matches.length} matches for team 1, ${team2Matches.length} for team 2, ${headToHead.length} H2H matches`);

    // Calculate map winrates for the last 3 months
    const calculateMapWinrate = (teamId: number, matches: any[]) => {
      const mapMatches = matches.filter((m: any) => {
        const matchDate = new Date(m.scheduled_at || m.begin_at);
        return matchDate >= threeMonthsAgo && m.videogame?.id === videogameId;
      });
      const wins = mapMatches.filter((m: any) => m.winner_id === teamId).length;
      return mapMatches.length > 0 ? Math.round((wins / mapMatches.length) * 100) : 0;
    };

    // Calculate H2H record
    const team1H2HWins = headToHead.filter((m: any) => m.winner_id === team1Id).length;
    const team2H2HWins = headToHead.filter((m: any) => m.winner_id === team2Id).length;

    // Transform match details
    const matchDetails = {
      id: match.id.toString(),
      team1: {
        name: match.opponents?.[0]?.opponent?.name || 'Team 1',
        logo: match.opponents?.[0]?.opponent?.image_url || '',
        id: team1Id,
        players: team1Players.slice(0, 10).map((p: any) => ({
          name: p.name || `${p.first_name} ${p.last_name}`.trim(),
          role: p.role || 'Player',
          image: p.image_url || '',
        })),
      },
      team2: {
        name: match.opponents?.[1]?.opponent?.name || 'Team 2',
        logo: match.opponents?.[1]?.opponent?.image_url || '',
        id: team2Id,
        players: team2Players.slice(0, 10).map((p: any) => ({
          name: p.name || `${p.first_name} ${p.last_name}`.trim(),
          role: p.role || 'Player',
          image: p.image_url || '',
        })),
      },
      tournament: match.league?.name || match.serie?.full_name || 'Unknown Tournament',
      game: match.videogame?.name || 'Unknown',
      status: match.status === 'running' ? 'live' : 'upcoming',
      startTime: new Date(match.scheduled_at || match.begin_at).toLocaleString('ru-RU'),
      
      // Map/Game info
      bestOf: match.number_of_games || 1,
      
      // Head to Head
      headToHead: {
        matches: headToHead.slice(0, 10).map((m: any) => ({
          date: new Date(m.scheduled_at || m.begin_at).toLocaleDateString('ru-RU'),
          winner: m.winner_id === team1Id ? match.opponents?.[0]?.opponent?.name : match.opponents?.[1]?.opponent?.name,
          score: m.results?.map((r: any) => r.score).join('-') || 'N/A',
        })),
        team1Wins: team1H2HWins,
        team2Wins: team2H2HWins,
      },
      
      // Map winrates (last 3 months)
      mapWinrates: {
        team1: calculateMapWinrate(team1Id, team1Matches),
        team2: calculateMapWinrate(team2Id, team2Matches),
      },
      
      // Recent matches (last 5)
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
