import { HttpError } from "../../lib/http.js";

// 没有对应路由的 /api 请求统一返回 JSON 格式的 404
export function onRequest() {
  throw new HttpError(404, "接口不存在");
}
