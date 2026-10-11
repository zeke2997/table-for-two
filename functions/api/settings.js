import { json, readJson } from "../../lib/http.js";
import { settingsInput } from "../../lib/validate.js";

// 没设置过的项不返回，前端用 config.js 里的默认值
async function readAll(env) {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
  return Object.fromEntries(results.map((r) => [r.key, r.value]));
}

export async function onRequestGet({ env }) {
  return json(await readAll(env));
}

export async function onRequestPatch({ request, env }) {
  const data = settingsInput(await readJson(request));
  const stmt = env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  await env.DB.batch(Object.entries(data).map(([k, v]) => stmt.bind(k, v)));
  return json(await readAll(env));
}
