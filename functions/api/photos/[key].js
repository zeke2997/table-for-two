import { HttpError } from "../../../lib/http.js";

// 照片文件名是随机生成的、内容不会变，所以让浏览器长期缓存，减少 KV 读取次数。
export async function onRequestGet({ env, params }) {
  const { value, metadata } = await env.PHOTOS.getWithMetadata(params.key, "stream");
  if (!value) throw new HttpError(404, "照片不存在");
  return new Response(value, {
    headers: {
      "Content-Type": (metadata && metadata.type) || "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
