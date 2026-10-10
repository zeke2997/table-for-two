// 入参校验与数据库行转换。接口对所有人开放读写，所以服务端必须自己把关：
// 只接受白名单字段、限制长度和取值范围，避免脏数据和超大请求。

import { HttpError } from "./http.js";

export const LIMITS = {
  name: 50,
  category: 20,
  longText: 5000, // 食材、做法
  notes: 1000,
  orderNote: 500,
  createdBy: 20,
  orderItems: 50,
  maxDishes: 500,
  photoBytes: 1024 * 1024,
};

export const ORDER_STATUSES = ["pending", "cooking", "done", "cancelled"];
export const PHOTO_URL_RE = /^\/api\/photos\/[A-Za-z0-9_-]{8,64}\.(jpg|png|webp)$/;

function text(value, field, max, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new HttpError(400, `${field} 不能为空`);
    return null;
  }
  if (typeof value !== "string") throw new HttpError(400, `${field} 必须是文本`);
  const v = value.trim();
  if (required && !v) throw new HttpError(400, `${field} 不能为空`);
  if (v.length > max) throw new HttpError(400, `${field} 不能超过 ${max} 个字`);
  return v;
}

function int(value, field, min, max) {
  if (value === undefined || value === null || value === "") return null;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new HttpError(400, `${field} 必须是 ${min}～${max} 的整数`);
  }
  return value;
}

function bool(value, field) {
  if (typeof value !== "boolean") throw new HttpError(400, `${field} 必须是 true 或 false`);
  return value ? 1 : 0;
}

// 菜谱字段 → 数据库列。partial=true 用于修改，只处理传入的字段。
export function dishInput(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "请求内容格式不对");
  }
  const out = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

  if (!partial || has("name")) out.name = text(body.name, "菜名", LIMITS.name, { required: true });
  if (has("category")) out.category = text(body.category, "分类", LIMITS.category);
  if (has("ingredients")) out.ingredients = text(body.ingredients, "食材", LIMITS.longText);
  if (has("steps")) out.steps = text(body.steps, "做法", LIMITS.longText);
  if (has("notes")) out.notes = text(body.notes, "小贴士", LIMITS.notes);
  if (has("photo")) {
    const p = text(body.photo, "照片", 200);
    if (p && !PHOTO_URL_RE.test(p)) throw new HttpError(400, "照片地址不合法");
    out.photo = p || null;
  }
  if (has("available")) out.available = bool(body.available, "available");
  if (has("favorite")) out.favorite = bool(body.favorite, "favorite");
  if (has("difficulty")) {
    const d = int(body.difficulty, "难度", 1, 3);
    out.difficulty = d === null ? 2 : d;
  }
  if (has("cook_minutes")) out.cook_minutes = int(body.cook_minutes, "烹饪时长", 0, 1440);

  if (partial && Object.keys(out).length === 0) throw new HttpError(400, "没有可修改的字段");
  return out;
}

export function orderInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "请求内容格式不对");
  }
  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, "订单里至少要有一道菜");
  if (items.length > LIMITS.orderItems) throw new HttpError(400, `一单最多 ${LIMITS.orderItems} 道菜`);
  const clean = items.map((it) => {
    if (!it || typeof it !== "object") throw new HttpError(400, "订单菜品格式不对");
    return {
      dish_id: text(it.dish_id, "dish_id", 64, { required: true }),
      name: text(it.name, "菜名", LIMITS.name, { required: true }),
      qty: int(it.qty, "份数", 1, 99) ?? 1,
    };
  });
  return {
    items: JSON.stringify(clean),
    note: text(body.note, "留言", LIMITS.orderNote),
    created_by: text(body.created_by, "下单人", LIMITS.createdBy),
  };
}

export function statusInput(body) {
  const s = body && body.status;
  if (!ORDER_STATUSES.includes(s)) throw new HttpError(400, "订单状态不合法");
  return s;
}

// 数据库行 → 前端对象（SQLite 没有布尔和 JSON 类型，这里还原）
export function dishRow(r) {
  return { ...r, available: r.available === 1, favorite: r.favorite === 1 };
}

export function orderRow(r) {
  let items = [];
  try {
    items = JSON.parse(r.items);
  } catch { /* 坏数据按空订单显示 */ }
  return { ...r, items };
}
