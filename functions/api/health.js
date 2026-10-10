import { json } from "../../lib/http.js";

// 诊断页用：顺带检查数据库能否查询
export async function onRequestGet({ env }) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS dishes FROM dishes").first();
  return json({ ok: true, dishes: row.dishes });
}
