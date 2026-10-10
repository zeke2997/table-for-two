import { HttpError, json, readJson } from "../../../lib/http.js";
import { LIMITS, dishInput, dishRow } from "../../../lib/validate.js";

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM dishes ORDER BY created_at DESC"
  ).all();
  return json(results.map(dishRow));
}

export async function onRequestPost({ request, env }) {
  const data = dishInput(await readJson(request));
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM dishes").first();
  if (n >= LIMITS.maxDishes) throw new HttpError(409, `菜谱已达上限 ${LIMITS.maxDishes} 道`);

  data.id = crypto.randomUUID();
  const cols = Object.keys(data);
  const row = await env.DB.prepare(
    `INSERT INTO dishes (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")}) RETURNING *`
  ).bind(...cols.map((c) => data[c])).first();
  return json(dishRow(row), 201);
}
