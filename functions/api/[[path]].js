import { HttpError } from "../../lib/http.js";

// 没有对应路由的 /api 请求，返回 JSON 格式的 404，而不是静态页面
export function onRequest() {
  throw new HttpError(404, "接口不存在");
}
