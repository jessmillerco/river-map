export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const { offerPromise, thisBank, otherBank, stones } = body;

  if (!offerPromise || !thisBank || !otherBank || !stones || stones.length < 3) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const userMessage = `River Map to analyse:

OFFER PROMISE: ${offerPromise}

THIS BANK: ${thisBank}

OTHER BANK: ${otherBank}

STEPPING STONES (${stones.length}):
${stones.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Return your assessment in the exact JSON format specified.`;

  const systemPrompt = `You are a conversion advisor specialising in the belief journey from cold prospect to paying client. Analyse the River Map below through four lenses:

SPECIFICITY — Is language specific and felt, or vague? Flag expert trap language (speaking from the other bank — using framing a cold person couldn't yet access). The bar: would a cold person read this and think "that is exactly me"? "Feels stuck", "wants freedom", "desires transformation" all fail this test.

SEQUENCE — Does each stone logically earn the next, or are there leaps? Are two beliefs collapsed into one stone?

COMPLETENESS — Does the first stone meet a genuinely cold person? Does the last stone make yes feel inevitable?

ALIGNMENT — Do the banks and stones connect to what the offer actually delivers, or does the other bank describe a vision beyond what the offer provides?

Be honest, specific, and direct. Keep each feedback field to 1-2 sentences. Suggestions must be concrete — a rewrite or a pointed question, not general advice.

Respond in raw JSON only (no markdown, no backticks):
{
  "overall": "2-3 honest sentences: what's working, the biggest gap, what the map reveals about how well this person knows their cold prospect",
  "expertTrapFlags": ["quote or paraphrase the offending phrase — one sentence on why it's from the other bank"],
  "thisBank": {
    "score": "strong | needs-work | gap",
    "feedback": "1-2 sentences",
    "suggestion": "one concrete rewrite or question"
  },
  "otherBank": {
    "score": "strong | needs-work | gap",
    "feedback": "1-2 sentences",
    "suggestion": "one concrete rewrite or question"
  },
  "stones": [
    {
      "num": 1,
      "score": "strong | needs-work | gap | expert-trap | leap",
      "feedback": "1-2 sentences",
      "suggestion": "one concrete suggestion, or null if strong"
    }
  ],
  "missingStones": "specific description of what belief is missing and where it belongs in the sequence — or null",
  "philosophyProofPOVPain": {
    "philosophy": "present | missing | weak",
    "proof": "present | missing | weak",
    "POV": "present | missing | weak",
    "pain": "present | missing | weak",
    "feedback": "one sentence on what is most underleveraged"
  },
  "topPriority": "the single most important fix — specific and actionable in one sentence"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: '{' },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      return res.status(502).json({ error: 'Analysis service unavailable. Please try again.', _debug_status: response.status, _debug_error: errorText });
    }

    const data = await response.json();
    const completion = data.content[0]?.text;

    if (!completion) {
      return res.status(502).json({ error: 'Empty response from analysis service.' });
    }

    const content = '{' + completion;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error('JSON parse failed. Raw content:', content);
      return res.status(502).json({ error: 'Could not parse analysis response. Please try again.', _debug_raw: content.slice(0, 500) });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.', _debug_error: err.message });
  }
}
