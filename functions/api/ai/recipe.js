import { HttpError, json, readJson } from "../../../lib/http.js";
import { NO_VISION_HINT, aiInput, buildMessages, extractJson, normalizeRecipe, upstreamError } from "../../../lib/ai.js";

const TIMEOUT_MS = 60_000;

export async function onRequestPost({ request }) {
  const input = aiInput(await readJson(request));

  let res;
  try {
    res = await fetch(input.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        messages: buildMessages(input),
        stream: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err && err.name === "TimeoutError") throw new HttpError(504, "大模型服务超过 60 秒没有响应，请稍后再试");
    throw new HttpError(502, "连不上大模型服务，请检查接口地址");
  }

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch { /* 下面统一处理 */ }

  if (!res.ok) {
    const detail = data && data.error && (data.error.message || data.error);
    throw new HttpError(502, upstreamError(res.status, typeof detail === "string" ? detail : "", !!input.image));
  }

  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  const recipe = extractJson(content);
  const result = recipe && normalizeRecipe(recipe, input.categories);
  // 只给了照片却没认出菜名：可能是照片不清楚，也可能是服务商把模型看不了的图片直接丢掉了
  if (!input.name && !(result && result.name)) {
    const why = recipe && typeof recipe.notes === "string" && recipe.notes.trim() ? `（${recipe.notes.trim().slice(0, 60)}）` : "";
    throw new HttpError(502, `没能从照片认出这道菜${why}。可以换一张清楚些的照片，或者直接填写菜名。${NO_VISION_HINT}`);
  }
  if (!result) throw new HttpError(502, "大模型返回的内容不是菜谱格式，请重试或换一个模型");
  return json(result);
}
