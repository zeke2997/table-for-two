// ============================================================
// 主逻辑：游戏化 UI（胡闹厨房官方工艺风）
// ============================================================

(function () {
  "use strict";

  // ---------- 缓存自愈 ----------
  // 微信等浏览器可能缓存旧版页面骨架配新版程序（或反之）导致整体失灵。
  // HTML 里内联了 window.HTML_VERSION，与这里比对；不配套就带随机参数
  // 强制绕过缓存重新加载。fresh 参数防止无限重载循环。
  const APP_VERSION = "20260729";
  if (window.HTML_VERSION !== APP_VERSION && !/[?&]fresh=/.test(location.search)) {
    location.replace(location.pathname + "?fresh=" + Date.now());
    return;
  }

  // 兜底：任何未捕获的错误都显示出来（方便远程排查，而不是无声失灵）
  window.addEventListener("error", (e) => {
    if (document.getElementById("fatalBox")) return;
    const box = document.createElement("div");
    box.id = "fatalBox";
    box.style.cssText =
      "position:fixed;left:10px;right:10px;bottom:100px;z-index:99;background:#b93521;color:#fff;" +
      "padding:12px 14px;border-radius:12px;font-size:12px;word-break:break-all;";
    box.innerHTML =
      "程序出错了：" + (e.message || "未知错误") +
      '<br><a href="?fresh=1" style="color:#ffe9b3">👉 点此强制更新</a>';
    document.body.appendChild(box);
  });

  const cfg = window.APP_CONFIG || {};
  const Store = window.Store;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ---------- 全局状态 ----------
  let dishes = [];
  let orders = [];
  let cart = loadCart();
  let currentCategory = "全部";
  let searchTerm = "";
  let editingDishId = null;
  let photoDataUrl = null;
  let formDifficulty = 2;
  let pendingRole = null; // START 屏上选中的角色

  const role = () => localStorage.getItem("hm.role");
  const roleName = () => (role() === "chef" ? cfg.CHEF_NAME : cfg.GUEST_NAME);

  // ---------- 游戏音效（WebAudio 合成，无音频文件） ----------
  const Sound = {
    ctx: null,
    muted: localStorage.getItem("hm.muted") === "1",
    _ctx() {
      if (!this.ctx) {
        try {
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch { /* 不支持就静默 */ }
      }
      return this.ctx;
    },
    _tone(freq, start, dur, type, vol) {
      const ctx = this._ctx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol || 0.04, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.02);
    },
    play(name) {
      if (this.muted) return;
      try {
        if (name === "click") this._tone(660, 0, 0.06);
        if (name === "pop") { this._tone(880, 0, 0.07); this._tone(1320, 0.05, 0.06); }
        if (name === "success") { this._tone(523, 0, 0.1); this._tone(659, 0.09, 0.1); this._tone(784, 0.18, 0.16); }
        if (name === "fire") { this._tone(392, 0, 0.09); this._tone(523, 0.08, 0.09); this._tone(659, 0.16, 0.12); this._tone(784, 0.26, 0.2); }
        if (name === "error") { this._tone(330, 0, 0.12, "sawtooth", 0.03); this._tone(220, 0.1, 0.18, "sawtooth", 0.03); }
      } catch { /* 静默 */ }
    },
    toggle() {
      this.muted = !this.muted;
      localStorage.setItem("hm.muted", this.muted ? "1" : "0");
      renderSoundToggle();
      if (!this.muted) this.play("pop");
    },
  };
  function renderSoundToggle() {
    const btn = $("#soundToggle");
    btn.textContent = Sound.muted ? "🔇" : "🔊";
    btn.classList.toggle("muted", Sound.muted);
  }
  $("#soundToggle").addEventListener("click", () => Sound.toggle());
  // 全局按钮点击音
  document.addEventListener("click", (e) => {
    if (e.target.closest("button")) Sound.play("click");
  });

  // ---------- 工具 ----------
  function esc(s) {
    const div = document.createElement("div");
    div.textContent = s == null ? "" : String(s);
    return div.innerHTML;
  }

  function toast(msg, isError) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.toggle("toast-error", !!isError);
    el.classList.remove("hidden");
    if (isError) Sound.play("error");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), 2400);
  }

  function fmtTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    if (d.toDateString() === now.toDateString()) return `今天 ${hm}`;
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
  }

  function loadCart() {
    try { return JSON.parse(localStorage.getItem("hm.cart")) || []; } catch { return []; }
  }
  function saveCart(bounce) {
    localStorage.setItem("hm.cart", JSON.stringify(cart));
    renderCartBadge(bounce);
  }

  // 星级 HTML（难度）
  function starsHtml(n, size) {
    n = Math.max(1, Math.min(3, n || 2));
    const s = size || 22;
    let html = "";
    for (let i = 1; i <= 3; i++) {
      html += `<svg width="${s}" height="${s}" viewBox="0 0 22 22"><use href="#${i <= n ? "starF" : "starE"}"/></svg>`;
    }
    return html;
  }

  // 菜品图块：有照片显示照片，否则显示冒热气的炖锅
  function tileHtml(d) {
    const inner = d.photo
      ? `<img src="${esc(d.photo)}" alt="${esc(d.name)}" loading="lazy">`
      : `<span class="pot-wrap"><svg width="70" height="60" viewBox="0 0 72 62"><use href="#pot"/></svg></span>`;
    return `
      <div class="dish-tile">
        ${inner}
        <span class="arc">${starsHtml(d.difficulty, 23)}</span>
        ${d.available === false ? '<span class="soldout-tag">今日估清</span>' : ""}
      </div>`;
  }

  function metaHtml(d) {
    const bits = [];
    if (d.cook_minutes) {
      bits.push(`<svg width="16" height="18" viewBox="0 0 16 18"><use href="#clockIc"/></svg>${d.cook_minutes} 分钟`);
    }
    if (d.category) bits.push(esc(d.category));
    return bits.join(" · ");
  }

  // 图片压缩
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const max = 900;
        let { width: w, height: h } = img;
        if (Math.max(w, h) > max) {
          const scale = max / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("图片读取失败"));
      };
      img.src = url;
    });
  }

  // ---------- 口令屏 ----------
  function checkPasscode() {
    if (!cfg.PASSCODE) return true;
    if (localStorage.getItem("hm.pass") === String(cfg.PASSCODE)) return true;
    $("#passOverlay").classList.remove("hidden");
    return false;
  }
  $("#passSubmit").addEventListener("click", () => {
    const v = $("#passInput").value.trim();
    if (v === String(cfg.PASSCODE)) {
      localStorage.setItem("hm.pass", v);
      $("#passOverlay").classList.add("hidden");
      Sound.play("success");
      ensureRole();
    } else {
      $("#passError").classList.remove("hidden");
      Sound.play("error");
    }
  });
  $("#passInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#passSubmit").click();
  });

  // ---------- START 开场屏 ----------
  function ensureRole() {
    if (role()) { applyRole(); return; }
    $("#roleOverlay").classList.remove("hidden");
  }

  $$("#roleOverlay .char-card").forEach((card) =>
    card.addEventListener("click", () => {
      pendingRole = card.dataset.role;
      $$("#roleOverlay .char-card").forEach((c) =>
        c.classList.toggle("selected", c === card)
      );
      $("#startBtn").disabled = false;
      Sound.play("pop");
    })
  );

  $("#startBtn").addEventListener("click", () => {
    if (!pendingRole) return;
    localStorage.setItem("hm.role", pendingRole);
    $("#roleOverlay").classList.add("hidden");
    Sound.play("fire");
    applyRole();
    toast(`${roleName()} 已就位，开始点菜吧！`);
  });

  function applyRole() {
    $("#roleSwitch").textContent = `${role() === "chef" ? "👨‍🍳" : "🍽️"} ${roleName()}`;
    const isChef = role() === "chef";
    $("#manageTab").classList.toggle("hidden", !isChef);
    if (!isChef && !$("#page-manage").classList.contains("hidden")) {
      switchPage("menu");
    }
  }

  $("#roleSwitch").addEventListener("click", () => {
    if (confirm("要换角色吗？（会回到开始画面）")) {
      localStorage.removeItem("hm.role");
      pendingRole = null;
      $("#startBtn").disabled = true;
      $$("#roleOverlay .char-card").forEach((c) => c.classList.remove("selected"));
      ensureRole();
    }
  });

  // ---------- 页面切换 ----------
  function switchPage(name) {
    $$(".page").forEach((p) => p.classList.add("hidden"));
    $(`#page-${name}`).classList.remove("hidden");
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.page === name));
    if (name === "orders") refreshOrders();
    if (name === "cart") renderCart();
    if (name === "manage") renderManage();
  }
  $$(".tab").forEach((t) => t.addEventListener("click", () => switchPage(t.dataset.page)));

  // ---------- 菜单页 ----------
  async function refreshDishes() {
    try {
      dishes = await Store.listDishes();
    } catch (e) {
      toast("加载菜单失败：" + e.message, true);
      dishes = [];
    }
    renderCategoryChips();
    renderDishList();
  }

  function allCategories() {
    const set = new Set(cfg.DEFAULT_CATEGORIES || []);
    dishes.forEach((d) => d.category && set.add(d.category));
    return Array.from(set);
  }

  function renderCategoryChips() {
    const cats = ["全部", ...allCategories()];
    if (!cats.includes(currentCategory)) currentCategory = "全部";
    $("#categoryChips").innerHTML = cats
      .map((c) => `<button class="chip ${c === currentCategory ? "chip-active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`)
      .join("");
    $$("#categoryChips .chip").forEach((chip) =>
      chip.addEventListener("click", () => {
        currentCategory = chip.dataset.cat;
        renderCategoryChips();
        renderDishList();
      })
    );
  }

  function visibleDishes() {
    return dishes.filter((d) => {
      if (currentCategory !== "全部" && d.category !== currentCategory) return false;
      if (searchTerm) {
        const hay = `${d.name || ""} ${d.ingredients || ""}`.toLowerCase();
        if (!hay.includes(searchTerm.toLowerCase())) return false;
      }
      return true;
    });
  }

  function cartQty(dishId) {
    const item = cart.find((c) => c.dish_id === dishId);
    return item ? item.qty : 0;
  }

  function renderDishList() {
    const list = visibleDishes();
    $("#menuEmpty").classList.toggle("hidden", dishes.length > 0);
    $("#dishList").innerHTML = list
      .map((d) => {
        const qty = cartQty(d.id);
        const soldOut = d.available === false;
        const tags = [];
        if (d.favorite) tags.push('<span class="tag">❤️ 她最爱</span>');
        return `
        <div class="dish-card ${soldOut ? "sold-out" : ""}" data-id="${esc(d.id)}">
          ${tileHtml(d)}
          <div class="dish-info">
            <div class="dish-name">${esc(d.name)}</div>
            <div class="dish-meta">${metaHtml(d)}</div>
            ${tags.join("")}
          </div>
          <div class="dish-actions">
            ${
              soldOut
                ? ""
                : qty > 0
                  ? `<div class="qty-group">
                       <button class="qty-btn" data-act="minus">−</button>
                       <span class="qty-num">${qty}</span>
                       <button class="qty-btn plus" data-act="plus">＋</button>
                     </div>`
                  : `<button class="play-btn" data-act="plus" aria-label="加入点单">
                       <svg width="22" height="22" viewBox="0 0 22 22"><use href="#playTri"/></svg>
                     </button>`
            }
          </div>
        </div>`;
      })
      .join("");

    $$("#dishList .dish-card").forEach((card) => {
      const id = card.dataset.id;
      card.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-act]");
        if (btn) {
          changeCart(id, btn.dataset.act === "plus" ? 1 : -1);
          e.stopPropagation();
          return;
        }
        openDishModal(id);
      });
    });
  }

  $("#searchInput").addEventListener("input", (e) => {
    searchTerm = e.target.value.trim();
    renderDishList();
  });

  function changeCart(dishId, delta) {
    const dish = dishes.find((d) => d.id === dishId);
    if (!dish) return;
    let item = cart.find((c) => c.dish_id === dishId);
    if (!item && delta > 0) {
      item = { dish_id: dishId, name: dish.name, qty: 0 };
      cart.push(item);
    }
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) cart = cart.filter((c) => c !== item);
    if (delta > 0) Sound.play("pop");
    saveCart(delta > 0);
    renderDishList();
  }

  function renderCartBadge(bounce) {
    const total = cart.reduce((s, c) => s + c.qty, 0);
    const b = $("#cartBadge");
    b.textContent = total;
    b.classList.toggle("hidden", total === 0);
    if (bounce && total > 0) {
      b.classList.remove("bounce");
      void b.offsetWidth; // 重启动画
      b.classList.add("bounce");
    }
  }

  // ---------- 菜品详情（菜谱卡） ----------
  function openDishModal(id) {
    const d = dishes.find((x) => x.id === id);
    if (!d) return;
    const qty = cartQty(id);
    const soldOut = d.available === false;
    $("#dishModalBody").innerHTML = `
      <div class="modal-tab">菜 谱 卡</div>
      <h3>${esc(d.name)} ${d.favorite ? "❤️" : ""}</h3>
      <div class="dish-meta">${metaHtml(d)}</div>
      <div class="detail-stars">${starsHtml(d.difficulty, 24)}</div>
      ${d.photo ? `<img class="detail-photo" src="${esc(d.photo)}" alt="${esc(d.name)}">` : ""}
      ${d.ingredients ? `<h4>🧺 备料清单</h4><p class="pre">${esc(d.ingredients)}</p>` : ""}
      ${d.steps ? `<h4>📜 通关攻略</h4><p class="pre">${esc(d.steps)}</p>` : ""}
      ${d.notes ? `<h4>💡 主厨贴士</h4><p class="pre">${esc(d.notes)}</p>` : ""}
      <div class="form-actions">
        <button class="btn btn-wood" data-close>关闭</button>
        ${
          soldOut
            ? ""
            : `<button class="btn btn-go" id="modalAdd">${qty > 0 ? `已点 ${qty} 份 · 再来一份` : "🛒 加入点单"}</button>`
        }
      </div>`;
    $("#dishModal").classList.remove("hidden");
    const addBtn = $("#modalAdd");
    if (addBtn)
      addBtn.addEventListener("click", () => {
        changeCart(id, +1);
        closeModals();
        toast(`已加入点单：${d.name}`);
      });
  }

  function closeModals() {
    $$(".modal").forEach((m) => m.classList.add("hidden"));
  }
  // 事件委托：关闭按钮有的是动态生成的
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeModals();
  });

  // ---------- 点单篮 ----------
  function renderCart() {
    const empty = cart.length === 0;
    $("#cartEmpty").classList.toggle("hidden", !empty);
    $("#cartFooter").classList.toggle("hidden", empty);
    $("#cartList").innerHTML = cart
      .map(
        (c) => `
      <div class="cart-item" data-id="${esc(c.dish_id)}">
        <span class="cart-name">${esc(c.name)}</span>
        <div class="qty-group">
          <button class="qty-btn" data-act="minus">−</button>
          <span class="qty-num">${c.qty}</span>
          <button class="qty-btn plus" data-act="plus">＋</button>
        </div>
      </div>`
      )
      .join("");
    $$("#cartList .cart-item").forEach((row) => {
      row.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-act]");
        if (!btn) return;
        changeCart(row.dataset.id, btn.dataset.act === "plus" ? 1 : -1);
        renderCart();
      });
    });
  }

  function showStamp() {
    const el = $("#stampOverlay");
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 1600);
  }

  $("#submitOrder").addEventListener("click", async () => {
    if (cart.length === 0) return;
    const btn = $("#submitOrder");
    btn.disabled = true;
    try {
      await Store.addOrder({
        items: cart.map((c) => ({ dish_id: c.dish_id, name: c.name, qty: c.qty })),
        note: $("#orderNote").value.trim(),
        created_by: roleName(),
      });
      cart = [];
      saveCart();
      $("#orderNote").value = "";
      renderCart();
      Sound.play("fire");
      showStamp();
      setTimeout(() => switchPage("orders"), 900);
    } catch (e) {
      toast("下单失败：" + e.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- 订单页 ----------
  const STATUS_LABEL = {
    pending: { text: "🕐 等待接单", cls: "st-pending" },
    cooking: { text: "🔥 烹饪中", cls: "st-cooking" },
    done: { text: "⭐ 已上菜", cls: "st-done" },
    cancelled: { text: "💤 已取消", cls: "st-cancelled" },
  };

  async function refreshOrders() {
    try {
      orders = await Store.listOrders();
    } catch (e) {
      toast("加载订单失败：" + e.message, true);
      orders = [];
    }
    renderOrders();
  }

  function renderOrders() {
    $("#ordersEmpty").classList.toggle("hidden", orders.length > 0);
    const isChef = role() === "chef";
    $("#orderList").innerHTML = orders
      .map((o) => {
        const st = STATUS_LABEL[o.status] || STATUS_LABEL.pending;
        const items = (o.items || []).map((it) => `${esc(it.name)} × ${it.qty}`).join("、");
        const actions = [];
        if (isChef && o.status === "pending") {
          actions.push(
            `<button class="btn btn-small btn-fire" data-st="cooking">接单开火 🔥</button>`,
            `<button class="btn btn-small btn-wood" data-st="cancelled">取消</button>`
          );
        }
        if (isChef && o.status === "cooking") {
          actions.push(`<button class="btn btn-small btn-go" data-st="done">上菜完成 ⭐</button>`);
        }
        return `
        <div class="order-card" data-id="${esc(o.id)}">
          <div class="order-head">
            <span class="order-who">${esc(o.created_by || "")} 的点单</span>
            <span class="status ${st.cls}">${st.text}</span>
          </div>
          <div class="order-items">${items}</div>
          ${o.note ? `<div class="order-note">留言：${esc(o.note)}</div>` : ""}
          <div class="order-foot">
            <span class="order-time">${fmtTime(o.created_at)}</span>
            <span class="order-actions">${actions.join("")}</span>
          </div>
        </div>`;
      })
      .join("");

    $$("#orderList [data-st]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const id = btn.closest(".order-card").dataset.id;
        try {
          await Store.updateOrderStatus(id, btn.dataset.st);
          if (btn.dataset.st === "done") Sound.play("success");
          await refreshOrders();
        } catch (e) {
          toast("操作失败：" + e.message, true);
        }
      })
    );

    const pendingCount = orders.filter((o) => o.status === "pending").length;
    const b = $("#orderBadge");
    b.textContent = pendingCount;
    b.classList.toggle("hidden", pendingCount === 0);
  }

  $("#refreshOrders").addEventListener("click", refreshOrders);

  // ---------- 管理页 ----------
  function renderManage() {
    $("#manageEmpty").classList.toggle("hidden", dishes.length > 0);
    $("#manageList").innerHTML = dishes
      .map(
        (d) => `
      <div class="manage-item" data-id="${esc(d.id)}">
        <div class="manage-thumb">${
          d.photo
            ? `<img src="${esc(d.photo)}" alt="">`
            : `<span class="pot-mini"><svg width="44" height="38" viewBox="0 0 72 62"><use href="#pot"/></svg></span>`
        }</div>
        <div class="manage-info">
          <div class="dish-name" style="font-size:1.05rem">${esc(d.name)} ${d.favorite ? "❤️" : ""}</div>
          <div class="dish-meta">${metaHtml(d)}</div>
        </div>
        <div class="manage-actions">
          <button class="btn btn-small btn-wood" data-act="avail">${d.available === false ? "恢复供应" : "标记估清"}</button>
          <button class="btn btn-small btn-wood" data-act="edit">编辑</button>
          <button class="btn btn-small btn-fire" data-act="del">删除</button>
        </div>
      </div>`
      )
      .join("");

    $$("#manageList [data-act]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const id = btn.closest(".manage-item").dataset.id;
        const dish = dishes.find((d) => d.id === id);
        const act = btn.dataset.act;
        try {
          if (act === "del") {
            if (!confirm(`确定把「${dish.name}」下架删除吗？`)) return;
            await Store.deleteDish(id);
            await refreshDishes();
            renderManage();
            toast("已删除");
          } else if (act === "avail") {
            await Store.updateDish(id, { available: dish.available === false });
            await refreshDishes();
            renderManage();
          } else if (act === "edit") {
            openEditModal(dish);
          }
        } catch (e) {
          toast("操作失败：" + e.message, true);
        }
      })
    );
  }

  // ---------- 添加/编辑菜品 ----------
  function fillCategorySelect(selected) {
    const cats = allCategories();
    $("#fCategory").innerHTML =
      cats
        .map((c) => `<option value="${esc(c)}" ${c === selected ? "selected" : ""}>${esc(c)}</option>`)
        .join("") + `<option value="__new__">＋ 新建分类…</option>`;
    $("#fCategoryNew").classList.add("hidden");
  }
  $("#fCategory").addEventListener("change", (e) => {
    $("#fCategoryNew").classList.toggle("hidden", e.target.value !== "__new__");
  });

  function renderDiffPicker() {
    $$("#diffPicker button").forEach((b) => {
      const on = Number(b.dataset.d) <= formDifficulty;
      b.innerHTML = `<svg width="26" height="26" viewBox="0 0 22 22"><use href="#${on ? "starF" : "starE"}"/></svg>`;
    });
  }
  $$("#diffPicker button").forEach((b) =>
    b.addEventListener("click", () => {
      formDifficulty = Number(b.dataset.d);
      renderDiffPicker();
      Sound.play("pop");
    })
  );

  function openEditModal(dish) {
    editingDishId = dish ? dish.id : null;
    photoDataUrl = null;
    formDifficulty = dish ? dish.difficulty || 2 : 2;
    $("#editTitle").textContent = dish ? "编辑菜谱" : "上新菜";
    $("#fName").value = dish ? dish.name : "";
    fillCategorySelect(dish ? dish.category : undefined);
    $("#fMinutes").value = dish && dish.cook_minutes ? dish.cook_minutes : "";
    $("#fFavorite").checked = dish ? !!dish.favorite : false;
    $("#fIngredients").value = dish ? dish.ingredients || "" : "";
    $("#fSteps").value = dish ? dish.steps || "" : "";
    $("#fNotes").value = dish ? dish.notes || "" : "";
    $("#fPhoto").value = "";
    $("#photoUploadTitle").textContent = dish && dish.photo ? "换一张菜品照" : "先来一张菜品照";
    renderDiffPicker();
    const pv = $("#photoPreview");
    if (dish && dish.photo) {
      pv.innerHTML = `<img src="${esc(dish.photo)}" alt="预览">`;
      pv.classList.remove("hidden");
    } else {
      pv.innerHTML = "";
      pv.classList.add("hidden");
    }
    $("#editModal").classList.remove("hidden");
  }

  $("#addDishBtn").addEventListener("click", () => openEditModal(null));

  $("#fPhoto").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      photoDataUrl = await compressImage(file);
      const pv = $("#photoPreview");
      pv.innerHTML = `<img src="${photoDataUrl}" alt="预览">`;
      pv.classList.remove("hidden");
      $("#photoUploadTitle").textContent = "再换一张菜品照";
    } catch (err) {
      toast(err.message, true);
    }
  });

  $("#dishForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#saveDish");
    btn.disabled = true;
    try {
      let category = $("#fCategory").value;
      if (category === "__new__") {
        category = $("#fCategoryNew").value.trim() || "其他";
      }
      const minutes = parseInt($("#fMinutes").value, 10);
      const patch = {
        name: $("#fName").value.trim(),
        category,
        difficulty: formDifficulty,
        favorite: $("#fFavorite").checked,
        cook_minutes: isNaN(minutes) ? null : minutes,
        ingredients: $("#fIngredients").value.trim(),
        steps: $("#fSteps").value.trim(),
        notes: $("#fNotes").value.trim(),
      };
      if (!patch.name) {
        toast("菜名不能为空", true);
        return;
      }
      if (photoDataUrl) {
        patch.photo = await Store.uploadPhoto(photoDataUrl);
      }
      if (editingDishId) {
        await Store.updateDish(editingDishId, patch);
        toast("已保存修改");
      } else {
        patch.available = true;
        await Store.addDish(patch);
        Sound.play("success");
        toast(`新菜上架：${patch.name} 🎉`);
      }
      closeModals();
      await refreshDishes();
      renderManage();
    } catch (err) {
      toast("保存失败：" + err.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- 启动 ----------
  async function init() {
    window.__APP_READY = true; // 告知加载看门狗：程序已跑起来
    if (Store.mode === "local") {
      $("#modeBadge").classList.remove("hidden");
    }
    renderSoundToggle();
    if (checkPasscode()) ensureRole();
    renderCartBadge();
    await refreshDishes();
    refreshOrders();
  }

  init();
})();
