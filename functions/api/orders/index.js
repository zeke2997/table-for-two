import { json, readJson } from "../../../lib/http.js";
import { orderInput, orderRow } from "../../../lib/validate.js";

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM orders ORDER BY created_at DESC LIMIT 100"
  ).all();
  return json(results.map(orderRow));
}

export async function onRequestPost({ request, env }) {
  const o = orderInput(await readJson(request));
  const row = await env.DB.prepare(
    "INSERT INTO orders (id, items, note, created_by) VALUES (?, ?, ?, ?) RETURNING *"
  ).bind(crypto.randomUUID(), o.items, o.note, o.created_by).first();
  return json(orderRow(row), 201);
}
