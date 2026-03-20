import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { info, extra } = await req.json();

  const prompt = `Je bent een AI study planner. Maak een concreet studieplan in het Nederlands.

Examens:
${info}

${extra ? `Student zegt: "${extra}"` : ""}

Geef een gedetailleerd plan voor de komende dagen:
- Prioriteer dichtstbijzijnde examens
- Plan moeilijke stof 's ochtends
- Bouw pauzes in (elke 45-60 min)
- Gebruik spaced repetition
- Geef concrete tijdblokken

Wees specifiek, kort en motiverend. Gebruik emoji's.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    const plan = data.content?.map((c: any) => c.text || "").join("") || "Fout bij genereren.";

    return NextResponse.json({ plan });
  } catch (error) {
    return NextResponse.json({ plan: "❌ Er ging iets mis. Probeer opnieuw." }, { status: 500 });
  }
}