import { HttpError, json } from "../../../lib/http.js";
import { LIMITS } from "../../../lib/validate.js";

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// 上传照片：请求体就是图片本身。前端已压缩到 900px 以内，正常不到 300 KB。
export async function onRequestPost({ request, env }) {
  const type = (request.headers.get("Content-Type") || "").split(";")[0].trim();
  const ext = TYPES[type];
  if (!ext) throw new HttpError(415, "只支持 JPEG、PNG、WebP 图片");

  const body = await request.arrayBuffer();
  if (body.byteLength === 0) throw new HttpError(400, "图片是空的");
  if (body.byteLength > LIMITS.photoBytes) throw new HttpError(413, "图片太大了，请换一张");

  const key = crypto.randomUUID().replace(/-/g, "") + "." + ext;
  await env.PHOTOS.put(key, body, { metadata: { type } });
  return json({ url: `/api/photos/${key}` }, 201);
}
