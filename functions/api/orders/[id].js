import { HttpError, json, readJson } from "../../../lib/http.js";
import { orderRow, statusInput } from "../../../lib/validate.js";

export async function onRequestPatch({ request, env, params }) {
  const status = statusInput(await readJson(request));
  const row = await env.DB.prepare("UPDATE orders SET status = ? WHERE id = ? RETURNING *")
    .bind(status, params.id).first();
  if (!row) throw new HttpError(404, "订单不存在");
  return json(orderRow(row));
}
