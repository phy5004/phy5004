export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 허용됩니다." });
  }

  try {
    const { grade, lengthOpt, obsText } = req.body || {};
    const apiKey = (process.env.GEMINI_API_KEY || "").replace(/['"\s]/g, "");

    if (!apiKey) {
      return res.status(500).json({ error: "Vercel 환경변수 GEMINI_API_KEY가 비어 있습니다." });
    }

    const prompt = `당신은 대한민국 초등학교 교사이자 나이스(NEIS) 생활기록부 기재 요령 전문가입니다.
1. 주어(학생 이름, '이 학생은' 등)를 생략하고 바로 서술어로 시작할 것.
2. standardType과 growthType은 반드시 '~함.', '~임.', '~보임.' 등 개조식 명사형 어미로 종결할 것.
3. 부정적 행동은 교육적 관점의 긍정적 표현으로 순화하고, 사교육/교외수상/질병 언급을 배제할 것.
4. 대상 학년군(${grade}) 수준에 맞는 어휘를 사용할 것.

[학년군]: ${grade}
[희망 분량(1, 2번)]: ${lengthOpt}
[관찰 기록]: ${obsText}

반드시 아래 JSON 형식으로만 답하세요:
{
  "standardType": "나이스 표준형 문구",
  "growthType": "강점·성장 강조형 문구",
  "counselingTip": "학부모 상담 포인트 및 가정 지도 조언 (3~4문장, '~습니다.' 경어체)"
}`;

    const proto = "https:/";
    const host = "generativelanguage" + ".googleapis.com";
    const models = ["gemini-3.8-flash", "gemini-3.8-flash-lite", "gemini-3.5-flash"];

    let data = null;
    let lastError = "";

    for (const model of models) {
      const endpoint = [proto, host, "v1beta", "models", `${model}:generateContent`].join("/");
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: new Array({ parts: new Array({ text: prompt }) }),
          generationConfig: { temperature: 0.7, responseMimeType: "application/json" }
        })
      });

      const rawBody = await response.text();
      try {
        const parsedBody = JSON.parse(rawBody);
        if (response.ok) {
          data = parsedBody;
          break;
        }
        lastError = parsedBody?.error?.message || `API 오류 (${response.status})`;
      } catch (e) {
        lastError = `응답 오류 (${response.status})`;
      }
    }

    if (!data) {
      throw new Error(lastError || "모든 예비 모델이 현재 혼잡합니다. 잠시 후 다시 시도해 주세요.");
    }

    const rawText = data.candidates.at(0).content.parts.at(0).text;
    const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

