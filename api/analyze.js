export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 허용됩니다." });
  }

  try {
    const { grade, lengthOpt, obsText } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Vercel 환경변수에 GEMINI_API_KEY가 등록되지 않았습니다." });
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

    const domain = "https://googleapis.com";
    const path = "/v1beta/models/gemini-2.5-flash:generateContent?key=";
    const url = domain + path + encodeURIComponent(apiKey);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: new Array({ parts: new Array({ text: prompt }) }),
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || "Gemini API 호출 오류" });
    }

    const rawText = data.candidates.at(0).content.parts.at(0).text;
    const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: "서버 오류: " + err.message });
  }
}

