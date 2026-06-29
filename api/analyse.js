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

  const userMessage = `Here is the River Map to analyse:

OFFER PROMISE:
${offerPromise}

THIS BANK — where the cold prospect is right now:
${thisBank}

THE OTHER BANK — where they are after working with this person:
${otherBank}

STEPPING STONES — the belief journey (${stones.length} stones):
${stones.map((s, i) => `Stone ${i + 1}: ${s}`).join('\n\n')}

Please analyse this River Map according to your framework and return your assessment in the exact JSON format specified.`;

  const systemPrompt = `You are a strategic copywriting and conversion advisor who specialises in helping service-based business owners understand the belief journey their cold prospect needs to take before they are ready to purchase. You have a deep understanding of behavioural psychology, identity shift, and what makes content and sequences actually convert in the current market.

Your role is to analyse a River Map — a framework that models the belief journey from cold prospect to converted client — and give honest, specific, actionable feedback.

You evaluate through four lenses:

SPECIFICITY — Is the language specific and felt, or vague and lofty? Are they speaking from this bank or from the other bank (the expert trap — using language, outcomes, or framing that only makes sense to someone who has already crossed)? Flag any language that a cold person couldn't yet access or wouldn't recognise as their own.

SEQUENCE — Does each stepping stone logically earn the next? Is the person being asked to leap rather than step anywhere? Are there places where two beliefs are being collapsed into one stone when they actually need to be separate?

COMPLETENESS — Are there missing stones? Does the first stone reflect where a genuinely cold person is standing — not someone who is already aware, already curious, already half-convinced? Does the last stone make saying yes feel inevitable rather than still requiring a leap?

ALIGNMENT — Do the two banks and the stones coherently connect to what the offer actually delivers? Is the other bank the direct result of the offer or an aspirational vision that goes beyond what the offer provides?

The quality standard for specificity is extremely high. Vague language like 'feels stuck', 'wants more freedom', 'ready to step into their potential', 'desires transformation', or 'looking for clarity' is not acceptable. The bar is: would a cold person read this description and think 'that is exactly me, in those exact words'? If not, flag it.

A great river map reads like the person who built it has genuinely sat inside their cold prospect's daily experience — not observed it from the outside or described it from the other bank.

Respond in this exact JSON format with no markdown, no backticks, just raw JSON:
{
  "overall": "3-4 sentences giving an honest overall read — what is working, what the single biggest opportunity is, and what quality of attention this map shows toward the cold person",
  "expertTrapFlags": ["specific phrase or section that is speaking from the other bank, with a one sentence explanation of why"],
  "thisBank": {
    "score": "strong | needs-work | gap",
    "feedback": "specific feedback — is it specific enough, does it name the real fear in the cold person's own language, does it stay on this bank or drift to the other side",
    "suggestion": "one specific rewrite suggestion or question to push the specificity further"
  },
  "otherBank": {
    "score": "strong | needs-work | gap",
    "feedback": "specific feedback — is it the direct result of the offer or an aspirational vision, is it specific and sensory or vague and lofty",
    "suggestion": "one specific rewrite suggestion or question to push the specificity further"
  },
  "stones": [
    {
      "num": 1,
      "score": "strong | needs-work | gap | expert-trap | leap",
      "feedback": "one to two sentences of specific feedback on this stone",
      "suggestion": "one specific suggestion to sharpen this stone if needed, or null if strong"
    }
  ],
  "missingStones": "describe any stones missing from the sequence with enough specificity that the person knows exactly what belief needs to be added and where — or null if the sequence is complete",
  "philosophyProofPOVPain": {
    "philosophy": "present | missing | weak",
    "proof": "present | missing | weak",
    "POV": "present | missing | weak",
    "pain": "present | missing | weak",
    "feedback": "one sentence on what is missing or underleveraged across the map"
  },
  "topPriority": "the single most important thing to fix or sharpen first — specific and actionable"
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
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      return res.status(502).json({ error: 'Analysis service unavailable. Please try again.' });
    }

    const data = await response.json();
    const content = data.content[0]?.text;

    if (!content) {
      return res.status(502).json({ error: 'Empty response from analysis service.' });
    }

    // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    const stripped = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      // Last resort: extract the outermost JSON object
      const match = stripped.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (e) {
          console.error('JSON parse failed. Raw content:', content);
          return res.status(502).json({ error: 'Could not parse analysis response. Please try again.' });
        }
      } else {
        console.error('No JSON object found. Raw content:', content);
        return res.status(502).json({ error: 'Unexpected response format. Please try again.' });
      }
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
