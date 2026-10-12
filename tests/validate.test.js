import { test } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../lib/http.js";
import { dishInput, orderInput, statusInput, settingsInput, dishRow, orderRow } from "../lib/validate.js";

const rejects = (fn, re) =>
  assert.throws(fn, (e) => e instanceof HttpError && e.status === 400 && re.test(e.message));

test("新建菜谱：只保留白名单字段，布尔值转成 0/1", () => {
  const out = dishInput({
    name: "  番茄炒蛋 ",
    category: "素菜",
    favorite: true,
    available: false,
    difficulty: 1,
    cook_minutes: 15,
    id: "attacker-chosen-id",
    created_at: "1970-01-01",
  });
  assert.deepEqual(out, {
    name: "番茄炒蛋",
    category: "素菜",
    favorite: 1,
    available: 0,
    difficulty: 1,
    cook_minutes: 15,
  });
});

test("新建菜谱：菜名必填、有长度上限", () => {
  rejects(() => dishInput({}), /菜名/);
  rejects(() => dishInput({ name: "   " }), /菜名/);
  rejects(() => dishInput({ name: "菜".repeat(51) }), /50/);
});

test("菜谱数值字段要在合理范围内", () => {
  rejects(() => dishInput({ name: "a", difficulty: 4 }), /难度/);
  rejects(() => dishInput({ name: "a", difficulty: "2" }), /难度/);
  rejects(() => dishInput({ name: "a", cook_minutes: -1 }), /烹饪时长/);
  assert.equal(dishInput({ name: "a", cook_minutes: null }).cook_minutes, null);
  assert.equal(dishInput({ name: "a", difficulty: null }).difficulty, 2);
});

test("照片只接受本站上传接口返回的地址", () => {
  assert.equal(
    dishInput({ name: "a", photo: "/api/photos/0123456789abcdef.jpg" }).photo,
    "/api/photos/0123456789abcdef.jpg"
  );
  assert.equal(dishInput({ name: "a", photo: "" }).photo, null);
  rejects(() => dishInput({ name: "a", photo: "https://evil.example/x.jpg" }), /照片/);
  rejects(() => dishInput({ name: "a", photo: "/api/photos/../secret" }), /照片/);
});

test("修改菜谱：只处理传入的字段，空修改报错", () => {
  assert.deepEqual(dishInput({ available: true }, { partial: true }), { available: 1 });
  rejects(() => dishInput({}, { partial: true }), /没有可修改/);
  rejects(() => dishInput({ name: "" }, { partial: true }), /菜名/);
});

test("下单：至少一道菜，份数默认 1，菜品多余字段丢弃", () => {
  const o = orderInput({
    items: [{ dish_id: "d1", name: "红烧肉", qty: 2, price: 999 }, { dish_id: "d2", name: "米饭" }],
    note: "少放盐",
    created_by: "贵宾",
  });
  assert.deepEqual(JSON.parse(o.items), [
    { dish_id: "d1", name: "红烧肉", qty: 2 },
    { dish_id: "d2", name: "米饭", qty: 1 },
  ]);
  assert.equal(o.note, "少放盐");
  rejects(() => orderInput({ items: [] }), /至少/);
  rejects(() => orderInput({ items: [{ dish_id: "d1", name: "x", qty: 100 }] }), /份数/);
});

test("订单状态只能是四种之一", () => {
  assert.equal(statusInput({ status: "done" }), "done");
  rejects(() => statusInput({ status: "eaten" }), /状态/);
});

test("店铺设置：只接受店名和两个称呼，不能为空、不能太长", () => {
  assert.deepEqual(settingsInput({ app_name: " 我们的小厨房 ", chef_name: "大厨", other: "x" }), {
    app_name: "我们的小厨房",
    chef_name: "大厨",
  });
  rejects(() => settingsInput({}), /没有可修改/);
  rejects(() => settingsInput({ app_name: "  " }), /店名/);
  rejects(() => settingsInput({ guest_name: "很长很长很长的称呼" }), /8/);
});

test("数据库行还原成前端需要的类型", () => {
  assert.deepEqual(dishRow({ id: "x", available: 1, favorite: 0 }), {
    id: "x",
    available: true,
    favorite: false,
  });
  assert.deepEqual(orderRow({ id: "o", items: '[{"name":"a","qty":1}]' }).items, [
    { name: "a", qty: 1 },
  ]);
  assert.deepEqual(orderRow({ id: "o", items: "坏数据" }).items, []);
});
