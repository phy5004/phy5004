export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 허용됩니다." });
  }

  try {
    const { apiKey, grade, lengthOpt, obsText } = req.body || {};

    // 사용자가 화면에 입력한 키를 우선 사용하고, 비어있으면 Vercel 환경변수 사용
    const finalApiKey = (apiKey && apiKey.trim()) || process.env.GEMINI_API_KEY;

    if (!finalApiKey) {
      return res.status(400).json({ error: "Gemini API Key가 입력되지 않았습니다." });
    }

    if (!obsText || !obsText.trim()) {
      return res.status(400).json({ error: "학생 관찰 내용을 입력해 주세요." });
    }

    const fullPrompt = `당신은 대한민국 초등학교 교사이자 나이스(NEIS) 생활기록부 기재 요령 전문가입니다.
[필수 기재 규칙]
1. 주어(학생 이름, '이 학생은' 등)를 생략하고 바로 서술어로 시작할 것.
2. standardType과 growthType은 반드시 '~함.', '~임.', '~보임.' 등 개조식 명사형 어미로 종결할 것.
3. 부정적 행동(산만함, 다툼 등)은 교육적 관점의 긍정적·발전적 표현으로 순화할 것.
4. 사교육 유발 요소, 공인어학시험, 교외 수상, 질병/장애 직접 언급을 배제할 것.
5. 대상 학년군(${grade}) 수준에 맞는 어휘를 사용할 것.

[입력 정보]
- 학년군: ${grade}
- 희망 분량(standardType, growthType 기준): ${lengthOpt}
- 관찰 기록: ${obsText}

반드시 아래 키 이름을 가진 순수 JSON 객체만 출력하세요:
{
  "standardType": "나이스 표준형 (객관적이고 정돈된 생활기록부 표준 문체)",
  "growthType": "강점·성장 강조형 (긍정적 변화와 잠재력을 따뜻하게 부각한 문체)",
  "counselingTip": "학부모 상담 포인트 및 가정 지도 조언 (3~4문장의 부드러운 경어체 ~습니다.)"
}`;

    async function callGemini(modelName) {
      const domain = "https://googleapis.com";
      const path = "/v1beta/models/" + modelName + ":generateContent?key=";
      const url = domain + path + encodeURIComponent(finalApiKey);

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: new Array({ parts: new Array({ text: fullPrompt }) }),
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json"
          }
        })
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error((json && json.error && json.error.message) || `HTTP ${response.status}`);
      }
      return json;
    }

    let data;
    try {
      data = await callGemini("gemini-2.5-flash");
    } catch (firstErr) {
      if (firstErr.message.includes("not found") || firstErr.message.includes("404")) {
        data = await callGemini("gemini-2.0-flash");
      } else {
        throw firstErr;
      }
    }

    const candidate = data?.candidates?.at(0);
    const part = candidate?.content?.parts?.at(0);
    let rawText = part ? part.text : "";

    if (!rawText) {
      throw new Error("AI 응답이 비어 있습니다.");
    }

    rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(rawText);

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message || "서버 내부 오류가 발생했습니다." });
  }
}
