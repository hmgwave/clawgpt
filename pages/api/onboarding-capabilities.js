const fallbackCapabilities = [
  'Turn the bottleneck you named into a practical operating rhythm that keeps the right people and priorities visible.',
  'Hold the context around what you are building so decisions, follow-ups, and constraints do not keep scattering.',
  'Translate your six-month vision into focused next moves that protect your energy and make progress easier to sustain.',
];

function normalizeCapabilities(value) {
  if (!Array.isArray(value)) return null;

  const capabilities = value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);

  return capabilities.length === 3 ? capabilities : null;
}

function parseClaudeText(text) {
  try {
    const parsed = JSON.parse(text);
    return normalizeCapabilities(parsed.capabilities);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const answers = Array.isArray(req.body?.answers) ? req.body.answers.map((answer) => String(answer || '').trim()) : [];
  if (answers.length !== 4 || answers.some((answer) => !answer)) {
    return res.status(400).json({ error: 'Four answers are required.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ capabilities: fallbackCapabilities });
  }

  const prompt = `You are creating onboarding capability statements for Aisymetry, a personal AI agent.

Use the user's answers to write exactly three specific capability statements. Each statement should be one sentence, concrete, personalized, and written in second person or implied second person. Do not use red imagery. Do not use em dashes. Return only JSON in this shape:
{"capabilities":["statement one","statement two","statement three"]}

Answer 1, what they are building or running:
${answers[0]}

Answer 2, who depends on them:
${answers[1]}

Answer 3, where they are stuck:
${answers[2]}

Answer 4, what should be different in six months:
${answers[3]}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
        max_tokens: 500,
        temperature: 0.6,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      return res.status(200).json({ capabilities: fallbackCapabilities });
    }

    const payload = await response.json();
    const text = payload?.content
      ?.map((block) => (block?.type === 'text' ? block.text : ''))
      .join('')
      .trim();
    const capabilities = parseClaudeText(text);

    return res.status(200).json({ capabilities: capabilities || fallbackCapabilities });
  } catch {
    return res.status(200).json({ capabilities: fallbackCapabilities });
  }
}
