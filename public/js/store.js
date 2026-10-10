// ============================================================
// 数据层：按 config.js 的 DATA_MODE 选择「联网模式」（调用本站 /api）
// 或「本地模式」（数据只存在当前浏览器的 localStorage）。
// 只用原生 fetch，不依赖任何外部库
// （微信 WebView 加载大体积外部脚本会静默卡死，因此越少外部依赖越稳）。
// ============================================================

(function () {
  "use strict";

  const uid = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // ---------------- 本地模式 ----------------
  const LocalStore = {
    mode: "local",

    _read(key) {
      try {
        return JSON.parse(localStorage.getItem(key)) || [];
      } catch {
        return [];
      }
    },
    _write(key, val) {
      localStorage.setItem(key, JSON.stringify(val));
    },

    async listDishes() {
      return this._read("hm.dishes").sort((a, b) =>
        (b.created_at || "").localeCompare(a.created_at || "")
      );
    },
    async addDish(d) {
      const dishes = this._read("hm.dishes");
      const dish = { ...d, id: uid(), created_at: new Date().toISOString() };
      dishes.push(dish);
      this._write("hm.dishes", dishes);
      return dish;
    },
    async updateDish(id, patch) {
      const dishes = this._read("hm.dishes");
      const i = dishes.findIndex((d) => d.id === id);
      if (i >= 0) {
        dishes[i] = { ...dishes[i], ...patch };
        this._write("hm.dishes", dishes);
        return dishes[i];
      }
      throw new Error("菜品不存在");
    },
    async deleteDish(id) {
      this._write(
        "hm.dishes",
        this._read("hm.dishes").filter((d) => d.id !== id)
      );
    },

    async listOrders() {
      return this._read("hm.orders").sort((a, b) =>
        (b.created_at || "").localeCompare(a.created_at || "")
      );
    },
    async addOrder(o) {
      const orders = this._read("hm.orders");
      const order = {
        ...o,
        id: uid(),
        status: "pending",
        created_at: new Date().toISOString(),
      };
      orders.push(order);
      this._write("hm.orders", orders);
      return order;
    },
    async updateOrderStatus(id, status) {
      const orders = this._read("hm.orders");
      const i = orders.findIndex((o) => o.id === id);
      if (i >= 0) {
        orders[i].status = status;
        this._write("hm.orders", orders);
      }
    },

    async uploadPhoto(dataUrl) {
      return dataUrl;
    },
  };

  // ---------------- 联网模式（调用本站 /api，后端是 Cloudflare Pages Functions + D1） ----------------
  const ApiStore = {
    mode: "cloud",

    async _req(path, opts) {
      opts = opts || {};
      let res;
      try {
        res = await fetch("/api" + path, {
          method: opts.method || "GET",
          headers: opts.headers,
          body: opts.body,
        });
      } catch {
        throw new Error("网络请求失败，请检查网络后重试");
      }
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch { /* 非 JSON 响应，下面按状态码报错 */ }
      if (!res.ok) throw new Error((data && data.error) || "HTTP " + res.status);
      return data;
    },

    _json(method, obj) {
      return {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(obj),
      };
    },

    listDishes() {
      return this._req("/dishes");
    },
    addDish(d) {
      return this._req("/dishes", this._json("POST", d));
    },
    updateDish(id, patch) {
      return this._req("/dishes/" + encodeURIComponent(id), this._json("PATCH", patch));
    },
    async deleteDish(id) {
      await this._req("/dishes/" + encodeURIComponent(id), { method: "DELETE" });
    },

    listOrders() {
      return this._req("/orders");
    },
    addOrder(o) {
      return this._req("/orders", this._json("POST", o));
    },
    async updateOrderStatus(id, status) {
      await this._req("/orders/" + encodeURIComponent(id), this._json("PATCH", { status }));
    },

    // 图片原样上传，返回可直接放进 <img src> 的地址
    async uploadPhoto(dataUrl) {
      const blob = await (await fetch(dataUrl)).blob();
      const r = await this._req("/photos", {
        method: "POST",
        headers: { "Content-Type": blob.type || "image/jpeg" },
        body: blob,
      });
      return r.url;
    },
  };

  // ---------------- 模式选择 ----------------
  const cfg = window.APP_CONFIG || {};
  window.Store = cfg.DATA_MODE === "local" ? LocalStore : ApiStore;
})();
