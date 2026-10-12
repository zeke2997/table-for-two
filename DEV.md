# 开发说明

本文件面向维护者，记录开发流程、必须遵守的约定和踩过的坑。项目介绍、本地开发命令和部署方法见 [README](README.md) 与 [部署教程](docs/deploy.md)。

## 仓库与网站

- 仓库：https://github.com/zeke2997/table-for-two ，单人开发，直接在 `main` 上提交。仓库同时用作多台电脑之间的中转站。
- 演示网站：https://table-for-two-demo.pages.dev ，项目名 `table-for-two-demo`，示例数据对所有人开放编辑。
- 作者自用网站：项目名不写进仓库，用 `npx wrangler pages project list` 查看。
- 每个网站的资源都按项目名命名：Pages 项目、D1 数据库同名，KV 命名空间叫“项目名-photos”。
  `npm run setup -- 项目名` 会生成对应的 `wrangler.toml`，之后的 `npm run dev`、`npm run deploy` 和数据库命令都作用于这个网站。

## 换电脑后恢复环境

1. `git clone` 后在仓库里设置提交身份 `git config user.name` 和 `git config user.email`。首次推送时用 GitHub 个人访问令牌认证。
2. 安装 Node.js 20 以上版本，执行 `npm install`。
3. Cloudflare 认证二选一。一是执行 `npx wrangler login`；二是使用 API 令牌，令牌权限见部署教程。本机的令牌存在 `~/.config/table-for-two/cloudflare.env`，使用前执行 `set -a; . ~/.config/table-for-two/cloudflare.env; set +a`。令牌不进仓库，换电脑需要重新创建。
4. `npm run setup -- 项目名` 生成 `wrangler.toml`，再 `npm run db:migrate:local` 初始化本地数据库，然后 `npm run dev` 确认能打开。

## 日常流程

```bash
git pull                   # 开工前先同步
npm run dev                # 本地联调，数据在 .wrangler/，不影响线上
npm test                   # 改了 lib/ 或接口要跑
npm run test:api           # 需要 npm run dev 正在运行
git add -A && git commit -m "改了什么" && git push
npm run setup -- 项目名    # 选择要部署的网站，两个网站都要更新时分别执行
npm run deploy             # 上线，部署的是当前工作目录的 public/ 和 functions/
```

先推送再部署，部署出问题时代码已经安全保存在 GitHub 上。部署前看一眼 setup 输出的网址，确认部署的是哪一个网站。

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

1. 在 `migrations/` 新建下一个编号的 SQL 文件，例如 `0003_add_xxx.sql`；
2. `npm run db:migrate:local`，本地验证；
3. 对每个网站分别 `npm run setup -- 项目名`（会自动执行远程迁移），再部署代码。
