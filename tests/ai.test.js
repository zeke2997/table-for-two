import { test } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../lib/http.js";
import { aiInput, buildMessages, chatEndpoint, extractJson, normalizeRecipe, upstreamError } from "../lib/ai.js";

const rejects = (fn, re) =>
  assert.throws(fn, (e) => e instanceof HttpError && e.status === 400 && re.test(e.message));

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const base = { name: "可乐鸡翅", apiKey: "sk-test", model: "m", baseUrl: "https://api.example.com/v1" };

test("接口地址：自动补上 /chat/completions，只允许 https，本机地址可用 http", () => {
  assert.equal(chatEndpoint("https://api.deepseek.com/v1/"), "https://api.deepseek.com/v1/chat/completions");
  assert.equal(chatEndpoint("https://x.com/v1/chat/completions"), "https://x.com/v1/chat/completions");
  assert.equal(chatEndpoint("http://127.0.0.1:11434/v1"), "http://127.0.0.1:11434/v1/chat/completions");
  rejects(() => chatEndpoint("http://api.example.com/v1"), /https/);
  rejects(() => chatEndpoint("ftp://x.com"), /https/);
  rejects(() => chatEndpoint("not a url"), /格式/);
  rejects(() => chatEndpoint("https://user:pw@x.com"), /账号密码/);
  rejects(() => chatEndpoint(""), /接口地址/);
});

test("请求参数：菜名和照片至少有一个，密钥和模型必填", () => {
  assert.equal(aiInput(base).name, "可乐鸡翅");
  assert.equal(aiInput({ ...base, name: "", image: PNG }).image, PNG);
  rejects(() => aiInput({ ...base, name: "" }), /菜名或/);
  rejects(() => aiInput({ ...base, apiKey: "" }), /API Key/);
  rejects(() => aiInput({ ...base, model: " " }), /模型/);
  rejects(() => aiInput({ ...base, image: "data:text/html;base64,PGgxPg==" }), /照片/);
  rejects(() => aiInput({ ...base, image: "data:image/png;base64," + "A".repeat(1_500_001) }), /照片/);
});

test("组装消息：有照片时按多模态格式发送", () => {
  const textOnly = buildMessages({ name: "番茄炒蛋", image: null, categories: ["素菜"] });
  assert.equal(typeof textOnly[1].content, "string");
  assert.match(textOnly[1].content, /番茄炒蛋/);
  assert.match(textOnly[1].content, /素菜/);

  const withImage = buildMessages({ name: "", image: PNG, categories: [] });
  assert.equal(withImage[1].content[1].type, "image_url");
  assert.equal(withImage[1].content[1].image_url.url, PNG);
  assert.match(withImage[1].content[0].text, /认出/);
});

test("解析回复：兼容代码块和推理模型的思考段落", () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('<think>先想想 {不是答案}</think>{"a":2}'), { a: 2 });
  assert.equal(extractJson("抱歉，我无法回答"), null);
  assert.equal(extractJson("[1,2]"), null);
  assert.equal(extractJson(null), null);
});

test("整理结果：步骤重新编号，越界的数值和不在列表里的分类丢弃", () => {
  const r = normalizeRecipe(
    {
      name: "可乐鸡翅",
      category: "硬菜",
      cook_minutes: "30",
      difficulty: 5,
      ingredients: ["鸡翅 8 个", " 可乐 1 罐 ", 42],
      steps: ["1. 焯水", "第二步：煎至金黄", "倒入可乐收汁"],
      notes: "大火收汁",
    },
    ["荤菜", "素菜"]
  );
  assert.deepEqual(r, {
    name: "可乐鸡翅",
    category: null,
    cook_minutes: 30,
    difficulty: null,
    ingredients: "鸡翅 8 个\n可乐 1 罐",
    steps: "1. 焯水\n2. 煎至金黄\n3. 倒入可乐收汁",
    notes: "大火收汁",
  });
  assert.equal(normalizeRecipe({ category: "荤菜" }, ["荤菜"]), null);
  assert.equal(normalizeRecipe({ steps: "切菜\n炒菜", category: "荤菜" }, ["荤菜"]).category, "荤菜");
});

test("出错提示：带照片被拒时提醒模型可能不支持识别图片", () => {
  assert.match(upstreamError(401, "bad key"), /API Key/);
  assert.match(upstreamError(400, "unknown variant `image_url`, expected `text`", true), /^当前模型不支持识别图片/);
  assert.match(upstreamError(400, "something else", true), /如果当前模型不支持识别图片/);
  assert.match(upstreamError(404, "model gpt-vision not found", true), /模型名称不对/);
  assert.match(upstreamError(400, "image_url", false), /返回错误 400/);
});
