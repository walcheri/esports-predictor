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
    const { matchData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating AI prediction for match:', matchData.id);

    // Prepare prompt with match statistics
    const prompt = `Ты эксперт по киберспорту. Проанализируй матч ${matchData.game}: ${matchData.team1.name} vs ${matchData.team2.name}.

Вот статистика:
- Турнир: ${matchData.tournament}
- Дата: ${matchData.startTime}

Последние матчи ${matchData.team1.name}:
${matchData.team1Recent.map((m: any) => `${m.date} против ${m.opponent}: ${m.result === 'win' ? 'Победа' : 'Поражение'} (${m.score})`).join('\n')}

Последние матчи ${matchData.team2.name}:
${matchData.team2Recent.map((m: any) => `${m.date} против ${m.opponent}: ${m.result === 'win' ? 'Победа' : 'Поражение'} (${m.score})`).join('\n')}

Дай краткий аналитический отчёт (3-4 абзаца на русском языке) и точные проценты победы для каждой команды.
Формат ответа должен быть JSON:
{
  "team1Probability": <число от 0 до 100>,
  "team2Probability": <число от 0 до 100>,
  "analysis": "<текст аналитического отчёта>"
}`;

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Ты эксперт по анализу киберспортивных матчей. Отвечай только на русском языке в формате JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your Lovable AI workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI generation failed' }),
        { status: aiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    console.log('AI response received:', content.substring(0, 100));

    // Parse JSON from AI response
    let prediction;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || 
                       content.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      prediction = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Fallback: create a basic prediction
      prediction = {
        team1Probability: 50,
        team2Probability: 50,
        analysis: content || 'Не удалось сгенерировать прогноз. Попробуйте снова.',
      };
    }

    // Ensure probabilities sum to 100
    if (prediction.team1Probability + prediction.team2Probability !== 100) {
      const total = prediction.team1Probability + prediction.team2Probability;
      if (total > 0) {
        prediction.team1Probability = Math.round((prediction.team1Probability / total) * 100);
        prediction.team2Probability = 100 - prediction.team1Probability;
      } else {
        prediction.team1Probability = 50;
        prediction.team2Probability = 50;
      }
    }

    console.log('Prediction generated successfully');

    return new Response(
      JSON.stringify(prediction),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-prediction function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
