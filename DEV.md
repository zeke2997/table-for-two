# 开发说明

本文件面向维护者，记录开发流程、必须遵守的约定和踩过的坑。项目介绍、本地开发命令和部署方法见 [README](README.md) 与 [部署教程](docs/deploy.md)。

> **进行中：迁移到 Cloudflare 全家桶（2026-10 开始）**
> 原因：Supabase 免费项目闲置 7 天会自动暂停，网站因此失效。改为 Cloudflare Pages + Pages Functions + D1，
> 免费额度没有闲置暂停的规则。同时把仓库整理成开源项目（仓库已公开，用于求职展示），并加一个
> 由用户自填大模型 API key 的 AI 功能。
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
> - [x] 4. AI 写菜谱：上新菜表单里填菜名，或者只选照片让模型认菜，生成分类、耗时、难度、食材、做法、小贴士并填进表单。
>   用户在「AI 设置」里自填 OpenAI 兼容接口，只存在浏览器 localStorage；请求经 `/api/ai/recipe` 转发（避开跨域），
>   服务端代码在 `lib/ai.js`。模型不支持图片、照片认不出、密钥错误等情况都有对应提示。
>   已用真实 DeepSeek 验证：按菜名生成约 2 秒，番茄炒蛋照片能认对。
> - [ ] 5. 开源整理：README（截图、架构图、AI 协作开发）、部署教程 `docs/deploy.md`、MIT 许可证、
>   GitHub Actions 自动测试、本文件改写、删除 `supabase/`、“她最爱”改为“TA 最爱”。
>   线上 22 道菜原本只有照片，已用 AI 写菜谱接口（DeepSeek，菜名加照片）补全食材、做法、小贴士和耗时，逐道人工核对后写入；分类和难度未改动。待办：`CLAUDE.md` 改写（需用户审核内容）。
> - [ ] 6. 上线验收（电脑和微信）并推送


## 仓库与线上

- 仓库：https://github.com/zeke2997/table-for-two ，单人开发，直接在 `main` 上提交。仓库同时用作多台电脑之间的中转站。
- 线上：https://zeke-shitang.pages.dev ，Cloudflare Pages 项目 `zeke-shitang`。
- Cloudflare 资源：D1 数据库 `table-for-two`，KV 命名空间 `table-for-two-photos`（绑定名 `PHOTOS`），ID 写在 `wrangler.toml`。

## 换电脑后恢复环境

1. `git clone` 后在仓库里设置提交身份 `git config user.name` 和 `git config user.email`。首次推送时用 GitHub 个人访问令牌认证。
2. 安装 Node.js 20 以上版本，执行 `npm install`。
3. Cloudflare 认证二选一。一是执行 `npx wrangler login`；二是使用 API 令牌，令牌权限见部署教程。本机的令牌存在 `~/.config/table-for-two/cloudflare.env`，使用前执行 `set -a; . ~/.config/table-for-two/cloudflare.env; set +a`。令牌不进仓库，换电脑需要重新创建。
4. `npm run db:migrate:local` 初始化本地数据库，然后 `npm run dev` 确认能打开。

## 日常流程

```bash
git pull                   # 开工前先同步
npm run dev                # 本地联调，数据在 .wrangler/，不影响线上
npm test                   # 改了 lib/ 或接口要跑
npm run test:api           # 需要 npm run dev 正在运行
git add -A && git commit -m "改了什么" && git push
npm run deploy             # 上线，部署的是当前工作目录的 public/ 和 functions/
```

先推送再部署，部署出问题时代码已经安全保存在 GitHub 上。

## 必须遵守的约定

### 版本号三处同步

改了 `public/css/` 或 `public/js/` 下的文件，要把下面三处一起改成新日期（例如 `20261011`），否则手机上加载的还是旧缓存：

| 文件 | 位置 |
|---|---|
| `public/index.html` | 4 处 `?v=`（style.css、config.js、store.js、app.js） |
| `public/index.html` | `window.HTML_VERSION` |
| `public/js/app.js` | `APP_VERSION` |

程序会比对 `HTML_VERSION` 和 `APP_VERSION`，不一致时自动强制刷新。临时绕过缓存可以在网址后加 `?fresh=1`。

### 微信兼容

2026 年 7 月出过一次事故：微信内置浏览器加载大体积脚本时会静默卡住，不报错，并且会堵住后面所有脚本，整页失灵。因此：

- 不引入大体积的第三方 JS 库，数据层 `public/js/store.js` 只用原生 fetch；
- `public/index.html` 内联了“抢救加载器”，4 秒内没有看到 `window.__APP_READY` 就用 XHR 拉取脚本文本执行。**新增 JS 文件必须加进这条加载链**；
- 线上诊断页 `/debug`，微信打开网址时会自动附加 `?wx_header=1` 参数。

### 接口

- 接口对所有人开放读写，所有输入都要经过 `lib/validate.js` 或 `lib/ai.js` 校验，新增字段要同时补上校验和单元测试。
- 出错时抛出 `HttpError(状态码, 中文说明)`，`functions/api/_middleware.js` 统一转成 `{ error }` 返回，前端直接展示给用户。

### 数据库改结构

1. 在 `migrations/` 新建下一个编号的 SQL 文件，例如 `0002_add_xxx.sql`；
2. `npm run db:migrate:local`，本地验证；
3. `npm run db:migrate:remote`，再部署代码。
