// 接口端到端测试：先 `npm run dev` 启动本地服务器，再 `npm run test:api`。
// 默认连 http://127.0.0.1:8788，可用 BASE_URL 环境变量改。会在本地数据库里增删数据。
import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8788").replace(/\/+$/, "");

async function api(path, { method = "GET", body, headers = {} } = {}) {
  const isJson = body !== undefined && !(body instanceof Uint8Array);
  const res = await fetch(BASE + "/api" + path, {
    method,
    headers: isJson ? { "Content-Type": "application/json", ...headers } : headers,
    body: isJson ? JSON.stringify(body) : body,
  });
  const text = await res.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch { /* 图片等非 JSON 响应 */ }
  return { status: res.status, data, res };
}

// 最小的合法 JPEG 文件头，够接口识别；内容是否真是图片服务端不解析
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 0xff, 0xd9]);

test("健康检查", async () => {
  const r = await api("/health");
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
});

test("菜谱：新建 → 列表 → 修改 → 删除", async () => {
  const created = await api("/dishes", {
    method: "POST",
    body: { name: "测试菜", category: "素菜", difficulty: 3, favorite: true, available: true },
  });
  assert.equal(created.status, 201);
  const id = created.data.id;
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.equal(created.data.favorite, true);
  assert.equal(created.data.difficulty, 3);

  const list = await api("/dishes");
  assert.ok(list.data.some((d) => d.id === id));

  const patched = await api("/dishes/" + id, { method: "PATCH", body: { available: false } });
  assert.equal(patched.status, 200);
  assert.equal(patched.data.available, false);
  assert.equal(patched.data.name, "测试菜");

  assert.equal((await api("/dishes/" + id, { method: "DELETE" })).status, 200);
  assert.equal((await api("/dishes/" + id, { method: "DELETE" })).status, 404);
  assert.equal((await api("/dishes/" + id, { method: "PATCH", body: { name: "x" } })).status, 404);
});

test("菜谱：非法输入返回 400 和中文说明", async () => {
  const r = await api("/dishes", { method: "POST", body: { name: "" } });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /菜名/);
  const bad = await fetch(BASE + "/api/dishes", { method: "POST", body: "{oops" });
  assert.equal(bad.status, 400);
});

test("照片：上传 → 读取 → 换照片时删掉旧照片 → 删菜时删掉照片", async () => {
  const up = await api("/photos", { method: "POST", body: JPEG, headers: { "Content-Type": "image/jpeg" } });
  assert.equal(up.status, 201);
  const url1 = up.data.url;
  assert.match(url1, /^\/api\/photos\/[0-9a-f]{32}\.jpg$/);

  const got = await fetch(BASE + url1);
  assert.equal(got.status, 200);
  assert.equal(got.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(new Uint8Array(await got.arrayBuffer()), JPEG);

  const dish = (await api("/dishes", { method: "POST", body: { name: "带照片的菜", photo: url1 } })).data;
  const url2 = (await api("/photos", { method: "POST", body: JPEG, headers: { "Content-Type": "image/jpeg" } })).data.url;
  await api("/dishes/" + dish.id, { method: "PATCH", body: { photo: url2 } });
  assert.equal((await fetch(BASE + url1)).status, 404);

  await api("/dishes/" + dish.id, { method: "DELETE" });
  assert.equal((await fetch(BASE + url2)).status, 404);
});

test("照片：拒绝非图片和超大文件", async () => {
  const txt = await api("/photos", { method: "POST", body: new Uint8Array([1, 2, 3]), headers: { "Content-Type": "text/plain" } });
  assert.equal(txt.status, 415);
  const big = new Uint8Array(1024 * 1024 + 1);
  const r = await api("/photos", { method: "POST", body: big, headers: { "Content-Type": "image/jpeg" } });
  assert.equal(r.status, 413);
});

test("订单：下单 → 列表 → 改状态", async () => {
  const o = await api("/orders", {
    method: "POST",
    body: { items: [{ dish_id: "d1", name: "红烧肉", qty: 2 }], note: "少放糖", created_by: "贵宾" },
  });
  assert.equal(o.status, 201);
  assert.equal(o.data.status, "pending");
  assert.deepEqual(o.data.items, [{ dish_id: "d1", name: "红烧肉", qty: 2 }]);

  const list = await api("/orders");
  assert.ok(list.data.some((x) => x.id === o.data.id));

  const p = await api("/orders/" + o.data.id, { method: "PATCH", body: { status: "cooking" } });
  assert.equal(p.data.status, "cooking");
  assert.equal((await api("/orders/" + o.data.id, { method: "PATCH", body: { status: "eaten" } })).status, 400);
});

test("不存在的接口返回 JSON 404", async () => {
  const r = await api("/nope");
  assert.equal(r.status, 404);
  assert.equal(typeof r.data.error, "string");
});
