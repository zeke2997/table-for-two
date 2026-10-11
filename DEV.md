# 开发与部署指南（换电脑必看）

> **进行中：迁移到 Cloudflare 全家桶（2026-10 开始）**
> 原因：Supabase 免费项目闲置 7 天会自动暂停，网站因此失效。改为 Cloudflare Pages + Pages Functions + D1，
> 免费额度没有闲置暂停的规则。同时把仓库整理成开源项目（仓库已公开，用于求职展示），并加一个
> 由用户自填大模型 API key 的 AI 功能。下文的 Supabase 相关内容在迁移完成后改写。
>
> - [x] 1. 新电脑环境：Node 装在 `~/.local/opt/node`；wrangler 用 API 令牌认证，令牌存
>   `~/.config/table-for-two/cloudflare.env`（OAuth 登录在本机换取令牌时卡住，未用）。
>   旧 Supabase 项目已恢复上线，数据完好：22 道菜、1 条订单、23 张照片约 2.9 MB。
> - [x] 2. 搭后端：D1 `table-for-two` 存菜谱和订单，KV `table-for-two-photos` 存照片（R2 要在控制台
>   单独开通，未用）；接口在 `functions/api/`，网页移到 `public/`，`npm run dev` 本地联调，
>   `npm test` 单元测试，`npm run test:api` 接口测试。线上 D1 已建表，尚未部署。
> - [x] 3. 已把 Supabase 的 22 道菜、1 条订单、22 张照片导入线上 D1 和 KV，逐条核对一致。照片沿用原文件名，
>   菜谱里的照片地址改成 `/api/photos/<文件名>`。Supabase 存储桶里另有 1 张没有菜引用的照片，未导入。
>   第 6 步上线验收通过之前，Supabase 项目保留作备份，之后再决定删除还是任其暂停。
> - [ ] 4. AI 功能：用户自填 OpenAI 兼容接口，输入菜名生成食材和做法
> - [ ] 5. 开源整理：README、许可证、删 `vendor/supabase.js`、清理 `CLAUDE.md` 私人信息、自动化测试
> - [ ] 6. 上线验收（电脑和微信）并推送

这个仓库当**中转站**用：在一台电脑上改完推上去，换一台电脑拉下来接着改。

- 仓库：https://github.com/zeke2997/table-for-two
- 线上：https://zeke-shitang.pages.dev
- Cloudflare Pages 项目名：`zeke-shitang`（账号 zeke2997@gmail.com）
- Supabase 项目：`novamdtefpfmfszbjhuy`（新加坡区）

---

## 一、仓库里有什么、没有什么

**有**：全部源码、设计稿、`config.js`（Supabase 地址和 publishable key，本来就是公开的前端密钥）、
`supabase/schema.sql` 建表脚本。拉下来就能跑、能部署。

**没有（换电脑要重新弄）**：

| 东西 | 存在哪 | 怎么恢复 |
|---|---|---|
| Cloudflare 部署授权 | `~/.config/.wrangler/config/default.toml` | 跑一次 `wrangler login` |
| GitHub 推送凭据 | 系统钥匙串 / `~/.git-credentials` | 首次 push 时输令牌 |
| Supabase 控制台 | 网页登录 | 用 zeke2997@gmail.com 登录 supabase.com |

> 这三样都是机器本地的，故意不进仓库。丢了不影响代码，重新授权即可。

---

## 二、新电脑上从零恢复

### 1. 装 Git 并拉代码

```bash
git clone https://github.com/zeke2997/table-for-two.git
cd table-for-two
git config user.name "zeke2997"
git config user.email "zeke2997@gmail.com"
```

首次 `git push` 会要求认证：Username 填 `zeke2997`，Password 位置粘贴
**个人访问令牌**（https://github.com/settings/tokens → Generate new token (classic) → 勾 `repo`）。

让它记住，只输一次：

```bash
# Mac
git config --global credential.helper osxkeychain
# Linux / WSL
git config --global credential.helper store
```

### 2. 装 Node 和 wrangler（只有要部署时才需要）

```bash
# 如果新机器没有 node：去 nodejs.org 下 LTS 版，或下独立包解压到 ~/.local/opt/node 并加进 PATH
npm install -g wrangler
wrangler login        # 浏览器弹出 Cloudflare 授权页，用 zeke2997@gmail.com 登录
wrangler whoami       # 确认显示 zeke2997@gmail.com
```

### 3. 验证能跑起来

```bash
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000，右上角没有「本地模式」标记就说明连上生产库了
```

---

## 三、日常流程

```bash
git pull                                   # ① 开工前必做

python3 -m http.server 8000                # ② 本地预览（连的是生产库，注意别乱删菜）

# ③ 改代码 ...（改了 css/js 记得同步版本号，见下）

git add -A && git commit -m "改了什么" && git push    # ④ 存回中转站

wrangler pages deploy . --project-name=zeke-shitang --commit-dirty=true   # ⑤ 上线
```

先 push 再 deploy——万一部署出问题，代码已经安全存在 GitHub 了。

---

## 四、两个必须记住的坑

### 版本号三处同步

改了 `css/style.css` 或 `js/*.js` 之后，必须把下面三处一起改成新日期（如 `20260807`），
否则手机上加载的还是旧缓存：

| 文件 | 位置 |
|---|---|
| `index.html` | 4 处 `?v=20260729`（style.css / config.js / store.js / app.js） |
| `index.html` | `window.HTML_VERSION = "20260729";` |
| `js/app.js` | `const APP_VERSION = "20260729";` |

程序会比对 `HTML_VERSION` 和 `APP_VERSION`，不一致时自动强制刷新。
应急：网址后面加 `?fresh=1`。

### 微信兼容

2026-07 出过事故：微信内置浏览器加载**大体积 JS 会静默卡死**，堵死后续所有脚本。所以：

- 禁止引入大体积第三方 JS 库；数据层 `js/store.js` 用原生 fetch 调 Supabase REST，别改回 supabase-js
- `index.html` 里内联了「抢救加载器」（4 秒没见 `window.__APP_READY` 就用 XHR 拉取代码 eval 执行），
  **新增的 js 文件必须加进这条链**
- 线上诊断页：`/debug`

---

## 五、数据库改结构

`config.js` 里的 key 只能读写数据，**没有 DDL 权限**。加字段/加表要：

1. 把 SQL 追加进 `supabase/schema.sql`（脚本里已有增量迁移写法可参考）
2. 登录 supabase.com → 项目 `novamdtefpfmfszbjhuy` → 左侧 **SQL Editor** → 粘贴执行

`js/store.js` 对 `difficulty` / `favorite` / `cook_minutes` 做了「列不存在就剥离重试」的兼容，
所以漏执行迁移不会直接崩，但新功能会静默失效——排查问题时留意这一点。
