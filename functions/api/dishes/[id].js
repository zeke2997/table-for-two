import { HttpError, json, readJson } from "../../../lib/http.js";
import { dishInput, dishRow } from "../../../lib/validate.js";

export async function onRequestPatch({ request, env, params }) {
  const data = dishInput(await readJson(request), { partial: true });
  const cols = Object.keys(data);
  const old = "photo" in data
    ? await env.DB.prepare("SELECT photo FROM dishes WHERE id = ?").bind(params.id).first()
    : null;
  const row = await env.DB.prepare(
    `UPDATE dishes SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ? RETURNING *`
  ).bind(...cols.map((c) => data[c]), params.id).first();
  if (!row) throw new HttpError(404, "菜品不存在");
  // 换了照片就删掉旧的
  if (old && old.photo && old.photo !== row.photo) {
    await env.PHOTOS.delete(old.photo.split("/").pop());
  }
  return json(dishRow(row));
}

export async function onRequestDelete({ env, params }) {
  const row = await env.DB.prepare("DELETE FROM dishes WHERE id = ? RETURNING photo")
    .bind(params.id).first();
  if (!row) throw new HttpError(404, "菜品不存在");
  // 照片一并删掉，不留孤儿文件
  if (row.photo) await env.PHOTOS.delete(row.photo.split("/").pop());
  return json({ ok: true });
}
