const fallbackCapabilities = [
  {
    headline: "Map The Work",
    body: "I will turn what you are building into a living operating map. Your agent is ready.",
  },
  {
    headline: "Protect The Humans",
    body: "I will keep the people who depend on you visible in every decision. Your agent is ready.",
  },
  {
    headline: "Clear The Friction",
    body: "I will focus first where momentum is slowing down. Your agent is ready.",
  },
];

function normalizeCapabilities(value) {
  if (!Array.isArray(value)) {
    return fallbackCapabilities;
  }

  const normalized = value
    .filter((item) => item && typeof item.headline === "string" && typeof item.body === "string")
    .slice(0, 3)
    .map((item) => ({
      headline: item.headline.slice(0, 80),
      body: item.body.slice(0, 360),
    }));

  return normalized.length === 3 ? normalized : fallbackCapabilities;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ capabilities: fallbackCapabilities });
    return;
  }

  const answers = Array.isArray(request.body?.answers) ? request.body.answers : [];
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    response.status(200).json({ capabilities: fallbackCapabilities, fallback: true });
    return;
  }

  try {
    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system:
          "You are the Aisymetry agent. Based on the four answers provided generate exactly three capability statements personalized to this specific user. Each capability has a short headline in five words or fewer and a body of two sentences maximum. The first sentence names what you will do for them specifically drawn from their answers. The second sentence names the outcome they described in their own language. Write in first person as the agent. Be specific to their answers not generic. Return only a valid JSON array of three objects each with a headline string and a body string. No other text, no markdown, no backticks.",
        messages: [
          {
            role: "user",
            content: answers.map((answer, index) => `Q${index + 1}: ${answer || "No answer provided."}`).join("\n"),
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      response.status(200).json({ capabilities: fallbackCapabilities, fallback: true });
      return;
    }

    const payload = await anthropicResponse.json();
    const text = payload?.content?.find((item) => item?.type === "text")?.text;
    const capabilities = normalizeCapabilities(JSON.parse(text));
    response.status(200).json({ capabilities });
  } catch {
    response.status(200).json({ capabilities: fallbackCapabilities, fallback: true });
  }
}
