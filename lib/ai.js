// AI 生成菜谱：用户在网页里填写自己的 OpenAI 兼容接口（地址、密钥、模型），
// 由 /api/ai/recipe 转发。浏览器直连很多服务商会被跨域策略拦下，所以经服务端转一手；
// 密钥只在这次请求里使用，不落库、不写日志。
// 请求体由服务端按固定模板组装，转发接口只能用来生成菜谱，被拿去做别的事意义不大。

import { HttpError } from "./http.js";
import { LIMITS } from "./validate.js";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

// 用户填的地址 → 完整的 chat/completions 地址。
// 只允许 https；本机地址允许 http，方便自部署时接本地模型（如 Ollama）。
export function chatEndpoint(baseUrl) {
  if (typeof baseUrl !== "string" || !baseUrl.trim()) throw new HttpError(400, "请先填写接口地址");
  if (baseUrl.length > 300) throw new HttpError(400, "接口地址太长");
  let url;
  try {
    url = new URL(baseUrl.trim());
  } catch {
    throw new HttpError(400, "接口地址格式不对，应以 https:// 开头");
  }
  const local = LOCAL_HOSTS.includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new HttpError(400, "接口地址必须以 https:// 开头");
  }
  if (url.username || url.password) throw new HttpError(400, "接口地址里不能带账号密码");
  url.search = "";
  url.hash = "";
  let path = url.pathname.replace(/\/+$/, "");
  if (!path.endsWith("/chat/completions")) path += "/chat/completions";
  url.pathname = path;
  return url.toString();
}

// 照片以 data URL 传入（前端已压缩到长边 900 像素），这里限制格式和大小
const IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE_CHARS = 1_500_000;

export function aiInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "请求内容格式不对");
  }
  const str = (v) => (typeof v === "string" ? v.trim() : "");
  const name = str(body.name);
  const image = str(body.image) || null;
  if (!name && !image) throw new HttpError(400, "请先填写菜名或选一张菜品照片");
  if (name.length > LIMITS.name) throw new HttpError(400, `菜名不能超过 ${LIMITS.name} 个字`);
  if (image && (image.length > MAX_IMAGE_CHARS || !IMAGE_RE.test(image))) {
    throw new HttpError(400, "照片格式不对或太大");
  }
  const apiKey = str(body.apiKey);
  if (!apiKey) throw new HttpError(400, "请先在 AI 设置里填写 API Key");
  if (apiKey.length > 500) throw new HttpError(400, "API Key 太长");
  const model = str(body.model);
  if (!model) throw new HttpError(400, "请先在 AI 设置里填写模型名称");
  if (model.length > 100) throw new HttpError(400, "模型名称太长");
  const categories = Array.isArray(body.categories)
    ? body.categories.filter((c) => typeof c === "string" && c.trim() && c.length <= LIMITS.category).slice(0, 30)
    : [];
  return { name, image, apiKey, model, categories, endpoint: chatEndpoint(body.baseUrl) };
}

export function buildMessages({ name, image, categories }) {
  const system = [
    "你是一位擅长家常菜的厨师，负责为一道菜写一份简明的家庭菜谱，按两人份计算用量。",
    "用户会给出菜名，或者一张菜品照片，或者两者都有。只有照片时，先认出这是什么菜。",
    "只输出一个 JSON 对象，不要输出 JSON 以外的任何文字。字段如下：",
    "name：菜名，用户给了菜名就照抄，只有照片时填你认出的菜名，认不出来就填空字符串；",
    "category：从用户给出的分类里选一个最合适的，都不合适就填空字符串；",
    "cook_minutes：从备料到出锅的总耗时，整数，单位分钟；",
    "difficulty：难度，1 表示简单，2 表示中等，3 表示较难；",
    "ingredients：字符串数组，每项写一种食材和用量，例如“鸡翅 8 个”；",
    "steps：字符串数组，每项写一个步骤，不要带序号；",
    "notes：一到两句关于火候或口味的提示。",
  ].join("\n");
  const lines = [];
  if (name) lines.push(`菜名：${name}`);
  if (image) lines.push(name ? "附上一张这道菜的照片供参考。" : "请根据照片认出这道菜。");
  lines.push(`可选分类：${categories.length ? categories.join("、") : "无"}`);
  const text = lines.join("\n");
  return [
    { role: "system", content: system },
    {
      role: "user",
      content: image
        ? [{ type: "text", text }, { type: "image_url", image_url: { url: image } }]
        : text,
    },
  ];
}

// 从模型回复中取出 JSON。兼容 ```json 代码块，以及推理模型夹带的 <think> 段落。
export function extractJson(text) {
  if (typeof text !== "string") return null;
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : null;
  } catch {
    return null;
  }
}

// 模型输出不可信：逐个字段检查类型和范围，整理成表单能直接使用的格式。
export function normalizeRecipe(obj, categories) {
  const lines = (v) => {
    if (typeof v === "string") return v.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (Array.isArray(v)) return v.filter((s) => typeof s === "string").map((s) => s.trim()).filter(Boolean);
    return [];
  };
  const clip = (s, max) => (s.length > max ? s.slice(0, max) : s);

  const ingredients = clip(lines(obj.ingredients).join("\n"), LIMITS.longText);
  const steps = clip(
    lines(obj.steps)
      .map((s, i) => `${i + 1}. ${s.replace(/^(\d+[.、．)]|第.+?步[:：]?)\s*/, "")}`)
      .join("\n"),
    LIMITS.longText
  );
  if (!ingredients && !steps) return null;

  const name = typeof obj.name === "string" ? clip(obj.name.trim(), LIMITS.name) : "";
  const minutes = Math.round(Number(obj.cook_minutes));
  const difficulty = Math.round(Number(obj.difficulty));
  const category = typeof obj.category === "string" ? obj.category.trim() : "";
  return {
    name,
    category: categories.includes(category) ? category : null,
    cook_minutes: minutes >= 1 && minutes <= 999 ? minutes : null,
    difficulty: difficulty >= 1 && difficulty <= 3 ? difficulty : null,
    ingredients,
    steps,
    notes: clip(typeof obj.notes === "string" ? obj.notes.trim() : "", LIMITS.notes),
  };
}

// 请求带了照片、服务商却拒绝时，多半是模型不支持图片输入
const NO_VISION_RE = /image|vision|multimodal|multi-modal|多模态|图片|图像/i;
export const NO_VISION_HINT = "如果当前模型不支持识别图片，请在 AI 设置里换一个支持图片输入的模型";
const NO_VISION_MSG = "当前模型不支持识别图片。请在 AI 设置里换一个支持图片输入的模型，或者先不选照片，只填菜名生成";

// 把服务商的出错状态翻译成用户能看懂的提示
export function upstreamError(status, detail, withImage = false) {
  const tail = detail ? `（${String(detail).slice(0, 120)}）` : "";
  if (withImage && [400, 415, 422].includes(status)) {
    if (NO_VISION_RE.test(detail || "")) return NO_VISION_MSG;
    return `请求被大模型服务拒绝${tail}。${NO_VISION_HINT}，或者先不选照片，只填菜名生成`;
  }
  if (status === 401 || status === 403) return `API Key 无效或没有权限${tail}`;
  if (status === 404) return `接口地址或模型名称不对${tail}`;
  if (status === 402 || status === 429) return `请求太频繁或账户余额不足${tail}`;
  return `大模型服务返回错误 ${status}${tail}`;
}
