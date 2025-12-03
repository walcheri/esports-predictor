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
    
    if (!matchData) {
      throw new Error('Match data is required');
    }

    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!PERPLEXITY_API_KEY) {
      console.error('PERPLEXITY_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Perplexity API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting Perplexity prediction for:', matchData.team1?.name || matchData.teamA, 'vs', matchData.team2?.name || matchData.teamB);

    const teamA = matchData.team1?.name || matchData.teamA || 'Team A';
    const teamB = matchData.team2?.name || matchData.teamB || 'Team B';
    const game = matchData.game || 'Unknown';
    const tournament = matchData.tournament || 'Unknown';

    // Prepare PandaScore stats JSON
    const statsJson = JSON.stringify({
      matchId: matchData.id,
      teams: { team1: matchData.team1, team2: matchData.team2 },
      headToHead: matchData.headToHead,
      mapWinrates: matchData.mapWinrates,
      team1Recent: matchData.team1Recent,
      team2Recent: matchData.team2Recent,
      startTime: matchData.startTime,
    }, null, 2);

    // Step 1: Web search for extended real-time data (rosters, H2H, player styles from HLTV/Liquipedia)
    const searchPrompt = `Найди максимально свежие данные по матчу ${teamA} vs ${teamB} (${game}, ${tournament}):

1. Полные составы команд с ролями, KDA и рейтингом игроков (за последние 3-6 месяцев)
2. Стили игры каждого игрока на ключевых картах (например: 'nafany на Dust2: агрессивные entry 72% success rate')
3. Head-to-Head последние 10 матчей (таблица с датами, счётами, картами)
4. Winrate команд на картах (например: Ancient 65%, Mirage 58%)
5. Форма команд (последние 5 игр с метриками KDA, gold diff)
6. Ключевые дуэли игроков (например: 'electronic vs zywOo AWP duels 65% win')
7. Тактические особенности (CT-hold, aggro-T, default plays)

Источники: HLTV.org, Liquipedia.net, GosuGamers, VLR.gg (для Valorant), Dotabuff (для Dota 2).

Верни структурированные данные.`;

    console.log('Step 1: Fetching extended web data via Perplexity sonar-pro...');
    
    const searchResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{ role: 'user', content: searchPrompt }],
        max_tokens: 2500,
        temperature: 0.2,
        return_related_questions: false,
      }),
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Perplexity search API error:', searchResponse.status, errorText);
      if (searchResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Превышен лимит запросов Perplexity. Попробуйте позже.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Perplexity search API error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const extendedStatsRaw = searchData.choices?.[0]?.message?.content || '';
    
    console.log('Step 1 complete. Extended data length:', extendedStatsRaw.length, 'chars');

    // Step 2: Deep analysis with all data
    const analysisPrompt = `Ты — легендарный аналитик ${game} (уровень SPUNJ + Thoorin для CS2, Tsunami/Cap для Dota 2, LS/Caedrel для LoL). 

Сделай **УЛЬТРА-ДЕТАЛЬНЫЙ** прогноз-отчёт на русском языке (минимум 1500 слов, НЕ укорачивай!) — убедительный, с драматургией, фактами и экспертным доверием.

## Матч
**${teamA}** vs **${teamB}**
- Турнир: ${tournament}
- Время: ${matchData.startTime || 'TBD'}
- Формат: ${matchData.format || 'Bo3'}
- Игра: ${game}

## Данные из PandaScore API
${statsJson}

## Данные из веб-поиска (HLTV, Liquipedia, VLR, Dotabuff)
${extendedStatsRaw}

---

## СТРУКТУРА ОТЧЁТА (все пункты подробно, с примерами и аналогиями):

### 1. 🎮 Составы и стиль игроков
Для каждого игрока: роль, возраст (если известен), KDA/рейтинг (HLTV 1.15 или Dotabuff/VLR), уникальный стиль игры на картах.
Пример: *"nafany на Dust2: агрессивные rushes на B-site с 72% success rate, но слаб в eco-раундах — всего 45% win в pistol rounds"*

### 2. 📊 Head-to-Head таблица
Последние 10 матчей между командами:
| Дата | Турнир | Счёт | Карты | Ключевой момент |

### 3. 🔥 Форма и психология команд
- Последние 5 матчей каждой команды с результатами
- Психологическое состояние (тильт, замены в составе, мотивация)
- Метрики: gold diff, KDA trends, comeback %
Пример: *"Fnatic после скандала с тренером — мотивация x2, играют на эмоциях"*

### 4. 🗺️ Карты: микро и макро анализ
- Winrate команд на каждой карте пула
- Ключевые дуэли (например: *"electronic vs zywOo на Mirage AWP duels — 65% в пользу electronic"*)
- Тактические особенности (CT-hold, aggro-T, default plays)

### 5. 🎭 Сюжетные линии матча
- Реванж? Драма между игроками? История противостояния?
- MVP-предикт с обоснованием
Пример: *"bodyy vs VINI — IGL-battle за контроль темпа игры"*

### 6. 🚫 Пики/Баны и стратегии
- Что скорее всего забанят?
- Пермапики команд
- Возможные сюрпризы в драфте
Пример: *"Fnatic 100% забанят Nuke из-за слабого lurker'а TeSeS"*

### 7. 🎯 ФИНАЛЬНЫЙ ПРОГНОЗ
**${teamA}: XX%** vs **${teamB}: YY%**
- Обоснование: H2H статистика + стиль на ключевых картах + форма
- Предполагаемый счёт (например: 2-1)
- Ключевые факторы победы

---

**ВАЖНО:**
- Пиши как профессиональный аналитик-комментатор, но с юмором и эмоциями: "это будет эпик!"
- Используй эмодзи для визуального разделения секций
- Markdown форматирование: **жирный** для ключевых моментов, *курсив* для примеров
- Таблицы для H2H
- Списки для составов и статистики
- Не менее 1500 слов!
- В конце ОБЯЗАТЕЛЬНО укажи проценты для каждой команды в формате "**${teamA}: XX%** | **${teamB}: YY%**"`;

    console.log('Step 2: Generating deep analysis via Perplexity sonar-pro...');

    const analysisResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{ role: 'user', content: analysisPrompt }],
        max_tokens: 4000,
        temperature: 0.7,
        return_related_questions: false,
      }),
    });

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      console.error('Perplexity analysis API error:', analysisResponse.status, errorText);
      if (analysisResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Превышен лимит запросов Perplexity. Попробуйте позже.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (analysisResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Требуется оплата Perplexity API.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Perplexity analysis API error: ${analysisResponse.status}`);
    }

    const analysisData = await analysisResponse.json();
    const report = analysisData.choices?.[0]?.message?.content || '';

    console.log('Step 2 complete. Report length:', report.length, 'chars');

    // Extract probabilities from the report
    const probMatches = report.match(/(\d{1,3})%/g) || [];
    let team1Probability = 50;
    let team2Probability = 50;

    // Look for patterns like "Team: XX%" or just percentages that sum close to 100
    if (probMatches.length >= 2) {
      const probs = probMatches.map((p: string) => parseInt(p.replace('%', ''))).filter((p: number) => p > 0 && p <= 100);
      // Find two consecutive reasonable probabilities that sum close to 100
      for (let i = 0; i < probs.length - 1; i++) {
        const sum = probs[i] + probs[i + 1];
        if (sum >= 95 && sum <= 105) {
          team1Probability = probs[i];
          team2Probability = probs[i + 1];
          break;
        }
      }
    }

    // Normalize probabilities to sum to 100
    const total = team1Probability + team2Probability;
    if (total !== 100 && total > 0) {
      team1Probability = Math.round((team1Probability / total) * 100);
      team2Probability = 100 - team1Probability;
    }

    console.log('Probabilities extracted:', team1Probability, '% vs', team2Probability, '%');
    console.log('Prediction generated successfully');

    return new Response(
      JSON.stringify({
        team1Probability,
        team2Probability,
        analysis: report,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in generate-prediction:', error);
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate prediction' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
