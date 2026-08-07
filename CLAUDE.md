# Zeke 食堂（电子菜单）

两人自用的点菜/菜谱 Web App。主厨（用户 Zeke）记录菜谱，女朋友在线点单。
用户是编程新手——解释问题时用通俗语言，重要操作前说明在做什么。

## 架构

- **纯静态前端**，无构建步骤，改完即可部署。UI 为「胡闹厨房官方工艺」游戏风（勿改回普通网页风）。
- **数据库/存储**：Supabase（新加坡区），项目 `novamdtefpfmfszbjhuy`，凭据在 `config.js`（anon/publishable key，可公开）。表：`dishes`、`orders`；图片存 `dish-photos` 公开桶。RLS 允许匿名读写（两人私用的取舍，见 README 安全性说明）。
- **托管**：Cloudflare Pages 项目 `zeke-shitang` → https://zeke-shitang.pages.dev （账号 zeke2997@gmail.com，wrangler OAuth 凭据在 `~/.config/.wrangler/`）。

## 文件

- `index.html` — 页面 + 全部 SVG 游戏素材（小厨师/炖锅/星星/图标，均为原创手绘，因版权不用官方贴图）
- `css/style.css` — 游戏风样式（按压手感、盖章动画、START 屏）
- `js/app.js` — 业务逻辑 + WebAudio 合成音效（Sound 模块）
- `js/store.js` — 数据层：config 未填 Supabase 时自动 localStorage 本地模式；对 difficulty/favorite/cook_minutes 有"列不存在则剥离重试"兼容
- `vendor/` — supabase-js 与字体（站酷快乐体 + Lilita One，OFL 可商用）本地化，勿改 CDN 引用
- `supabase/schema.sql` — 建表脚本（含增量迁移），需用户在 Supabase 控制台 SQL Editor 手动执行
- `design/` — 定稿设计图与实机截图

## 多机同步（重要）

GitHub 仓库 https://github.com/zeke2997/table-for-two 作为**中转站**，用于在多台电脑之间同步开发
（单人开发，不用分支，直接在 `main` 上做）。

- **每次开工前先 `git pull`**，确认这台机器上是最新代码再动手；
- **每次改动完成后 `git add -A && git commit -m "..." && git push`**，
  别把改动只留在本地——换电脑时找不回来；
- `config.js` 是**受追踪文件**（含生产库地址）。若为了试验把 SUPABASE_* 改空走本地模式，
  提交前务必 `git diff config.js` 确认已改回；
- **凭据不在仓库里**：Cloudflare 的 wrangler OAuth 令牌在 `~/.config/.wrangler/`，
  换电脑要重新 `wrangler login`。换机流程见 `DEV.md`。

## 常用操作

```bash
# 本地预览（注意：config.js 连的是生产库！测试写操作请先复制项目并清空 config 的 SUPABASE_* 走本地模式）
python3 -m http.server 8000

# 部署（在项目根目录执行）
wrangler pages deploy . --project-name=zeke-shitang --commit-dirty=true
# 环境要求：node + wrangler。若本机没有（如刚迁移到新电脑）：
#   下载 Node 独立包解压到 ~/.local/opt/node 并加入 PATH，npm i -g wrangler，
#   然后 wrangler login 走一次 OAuth 授权（Cloudflare 账号 zeke2997@gmail.com）。
```

## 测试

E2E 用 Playwright（chromium headless 缓存在 `~/.cache/ms-playwright`，playwright npm 包需临时安装）。
历史测试脚本在旧会话 scratchpad 中已失效；要点：START 屏需先点角色卡再点 `#startBtn`；`#fFavorite` 是隐藏 checkbox，点 `.fav-label`；START 按钮有 CSS 动画，断言前留缓冲。

## 注意（微信兼容，重要）

- 曾发生微信 XWeb 整页失灵事故（2026-07-22 结案）：**大体积脚本 vendor/supabase.js 被微信卡住不执行且不报错**，堵死后续所有同步脚本；小脚本正常。因此：
  - **禁止引入大体积外部 JS 库**；数据层 `js/store.js` 用原生 fetch 调 Supabase REST，勿改回 supabase-js；
  - `index.html` 内联了「抢救加载器」：4 秒未见 `window.__APP_READY` 就用 XHR 拉取 config.js / js/store.js / js/app.js 文本 eval 执行。**新增 js 文件必须加进抢救链**；
  - 每次改动 css/js：同步递增 `index.html` 的 `?v=`、`window.HTML_VERSION`、`js/app.js` 的 `APP_VERSION` 三处版本号。
- 线上诊断页 `/debug`（关键检测项：外部 script 标签执行）。微信打开 URL 会自动附加 `?wx_header=1` 参数。

## 注意

- 数据库结构变更（加列等）只能由用户在 Supabase 控制台 SQL Editor 执行，anon key 无 DDL 权限。
- 部署后 `*.pages.dev` 首次访问可能短暂 522，重试即可。
- 用户大陆网络实测可访问（2026-07 确认）；若未来访问劣化，方案是加自定义域名（无需备案）。
