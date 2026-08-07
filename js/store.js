// ============================================================
// 数据层：根据 config.js 是否填了 Supabase 信息，
// 自动选择「本地模式」(localStorage) 或「联网模式」(Supabase REST)。
// 联网模式直接用 fetch 调 Supabase 的 REST 接口，不依赖任何外部库
// （微信 WebView 会静默拦截外部 <script>，因此越少外部依赖越稳）。
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

  // ---------------- 联网模式 (Supabase REST，原生 fetch) ----------------
  const SupabaseStore = {
    mode: "cloud",
    url: "",
    key: "",

    init(url, key) {
      this.url = url.replace(/\/+$/, "");
      this.key = key;
    },

    async _req(path, opts) {
      opts = opts || {};
      const headers = Object.assign(
        {
          apikey: this.key,
          Authorization: "Bearer " + this.key,
        },
        opts.headers || {}
      );
      let res;
      try {
        res = await fetch(this.url + path, {
          method: opts.method || "GET",
          headers,
          body: opts.body,
        });
      } catch {
        throw new Error("网络请求失败，请检查网络后重试");
      }
      if (!res.ok) {
        let msg = "HTTP " + res.status;
        try {
          const j = await res.json();
          if (j && j.message) msg = j.message;
        } catch { /* 保留默认 msg */ }
        throw new Error(msg);
      }
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    },

    _jsonOpts(method, obj) {
      return {
        method,
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(obj),
      };
    },

    // 新字段兼容：云端没跑迁移 SQL 时剥掉新字段降级重试
    _stripNewCols(obj) {
      const copy = { ...obj };
      delete copy.difficulty;
      delete copy.favorite;
      delete copy.cook_minutes;
      return copy;
    },

    async listDishes() {
      return this._req("/rest/v1/dishes?select=*&order=created_at.desc");
    },
    async addDish(d) {
      try {
        const rows = await this._req("/rest/v1/dishes", this._jsonOpts("POST", d));
        return rows[0];
      } catch (e) {
        if (/column/i.test(e.message)) {
          const rows = await this._req(
            "/rest/v1/dishes",
            this._jsonOpts("POST", this._stripNewCols(d))
          );
          return rows[0];
        }
        throw e;
      }
    },
    async updateDish(id, patch) {
      const path = "/rest/v1/dishes?id=eq." + encodeURIComponent(id);
      try {
        const rows = await this._req(path, this._jsonOpts("PATCH", patch));
        return rows[0];
      } catch (e) {
        if (/column/i.test(e.message)) {
          const rows = await this._req(
            path,
            this._jsonOpts("PATCH", this._stripNewCols(patch))
          );
          return rows[0];
        }
        throw e;
      }
    },
    async deleteDish(id) {
      await this._req("/rest/v1/dishes?id=eq." + encodeURIComponent(id), {
        method: "DELETE",
      });
    },

    async listOrders() {
      return this._req(
        "/rest/v1/orders?select=*&order=created_at.desc&limit=100"
      );
    },
    async addOrder(o) {
      const rows = await this._req("/rest/v1/orders", this._jsonOpts("POST", o));
      return rows[0];
    },
    async updateOrderStatus(id, status) {
      await this._req(
        "/rest/v1/orders?id=eq." + encodeURIComponent(id),
        this._jsonOpts("PATCH", { status })
      );
    },

    // 图片上传到 Storage，返回公开访问地址
    async uploadPhoto(dataUrl) {
      const blob = await (await fetch(dataUrl)).blob();
      const path = uid() + ".jpg";
      await this._req("/storage/v1/object/dish-photos/" + path, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });
      return this.url + "/storage/v1/object/public/dish-photos/" + path;
    },
  };

  // ---------------- 模式选择 ----------------
  const cfg = window.APP_CONFIG || {};
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
    SupabaseStore.init(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    window.Store = SupabaseStore;
  } else {
    window.Store = LocalStore;
  }
})();
