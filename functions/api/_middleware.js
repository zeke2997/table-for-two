import { HttpError, json } from "../../lib/http.js";

// 所有 /api 请求的统一出口：校验错误返回 4xx，其余异常记日志后返回 500。
export async function onRequest({ next }) {
  try {
    return await next();
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error(err);
    return json({ error: "服务器出错了，请稍后再试" }, 500);
  }
}
