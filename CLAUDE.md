# 两人食堂 · Table for Two（电子菜单模板）

为情侣两人居家做饭设计的点菜与菜谱 Web App。一人当主厨，记录菜谱、处理订单；另一人点菜。
仓库公开，作者用它向招聘方展示与 AI 协作开发的能力，README、页面文案、提交说明等对外文字要保持专业。
用户是编程新手，解释问题时用通俗语言，重要操作前说明在做什么。

## 架构

- 前端 `public/`：原生 HTML/CSS/JS，无构建步骤。UI 为「胡闹厨房官方工艺」游戏风，勿改回普通网页风。
- 后端 `functions/api/`：Cloudflare Pages Functions；校验与 AI 请求逻辑在 `lib/`。
- 数据：D1 `table-for-two` 存菜谱和订单，KV 绑定 `PHOTOS` 存照片，表结构在 `migrations/`。
- 仓库是模板：`wrangler.toml` 不进仓库，用 `npm run setup -- 项目名` 生成并切换要操作的网站。演示网站是 `table-for-two-demo`；作者自用网站的项目名和网址不写进仓库里的任何文件，需要时用 `npx wrangler pages project list` 查看。
- 开发流程、版本号同步、微信兼容、改表结构的步骤都在 `DEV.md`。改 css/js、新增 JS 文件、改表结构之前先读对应小节。

## 硬性约定

- 不引入大体积第三方 JS 库（微信内置浏览器会静默卡住，原因见 DEV.md）；新增 JS 文件必须加进 `index.html` 的抢救加载链。
- 改了 `public/css` 或 `public/js`，同步更新三处版本号。
- 接口对所有人开放读写，新增字段要同时补上校验和单元测试。
- 页面文案面向情侣两人，店名和角色称呼一律从店铺设置读取，不写死性别和名字。
- 仓库里不放任何网站专属的信息，包括资源编号、自用网站的名字和网址、真实数据。

## 本机环境与凭据

- Node 在 `~/.local/opt/node/bin`，非交互 shell 先执行 `export PATH="$HOME/.local/opt/node/bin:$PATH"`。
- Cloudflare 用 API 令牌认证，使用前执行 `set -a; . ~/.config/table-for-two/cloudflare.env; set +a`。
  令牌和 `~/.bashrc` 里的各类 API key 一律不打印、不写进仓库。
- 环境变量里设有 HTTP 代理，访问本地服务要加 `NO_PROXY=127.0.0.1,localhost`。
- 带 `--remote` 的 D1/KV 写操作和部署会影响真实数据和线上网站，执行前先经用户同意。

## 测试

- `npm test` 单元测试；先 `npm run dev`，再 `npm run test:api` 接口测试。GitHub Actions 每次提交自动跑这两项。
- 界面测试用 Python playwright 加 headless chromium（缓存在 `~/.cache/ms-playwright`），脚本放会话 scratchpad，
  用普通 `python3` 运行（加 `-I` 会导致 playwright 导入失败）。要点：START 屏先点角色卡再点 `#startBtn`；
  `#fFavorite` 是隐藏 checkbox，点 `.fav-label`；START 按钮有动画，断言前留缓冲。

## 注意

- 部署后 `*.pages.dev` 首次访问可能短暂 522，重试即可。
- 大陆网络实测可访问（2026-07 确认）；若访问劣化，方案是加自定义域名（无需备案）。
