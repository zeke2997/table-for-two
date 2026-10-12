# 部署教程

按照本教程，可以在自己的 Cloudflare 账号下部署一份独立的两人食堂，数据只属于你们两人。全程使用免费额度，不需要绑定信用卡，不需要购买域名，也不需要 ICP 备案。

## 准备工作

1. **Node.js 20 或更高版本**：从 https://nodejs.org 下载长期支持版并安装。安装后在终端执行 `node -v`，能看到版本号即可。
2. **Cloudflare 账号**：在 https://dash.cloudflare.com/sign-up 用邮箱注册。登录后如果提示添加域名，直接跳过。
3. **下载代码并安装依赖**：

   ```bash
   git clone https://github.com/zeke2997/table-for-two.git
   cd table-for-two
   npm install
   ```

## 第一步：授权命令行工具

```bash
npx wrangler login
```

浏览器会打开 Cloudflare 的授权页面，登录并同意授权。之后执行 `npx wrangler whoami`，能看到自己的邮箱就说明授权成功。

也可以使用访问令牌，适合在服务器或自动化环境里部署。在 Cloudflare 控制台右上角头像菜单进入 **My Profile → API Tokens → Create Token**，选择 **Create Custom Token**，添加以下权限：

- Account → Cloudflare Pages：Edit
- Account → D1：Edit
- Account → Workers KV Storage：Edit
- Account → Account Settings：Read
- User → Memberships：Read
- User → User Details：Read

创建后复制令牌，在终端里设置环境变量 `CLOUDFLARE_API_TOKEN`，后续命令会自动使用它。令牌相当于账号密码，不要提交到仓库，也不要发给别人。

## 第二步：创建网站、数据库和照片存储

先想好项目名，它决定网址 `https://项目名.pages.dev`。项目名只能包含小写字母、数字和连字符，例如 `our-kitchen`。然后执行：

```bash
npm run setup -- 你的项目名
```

这条命令会依次完成以下工作：

1. 在你的 Cloudflare 账号里创建同名的 Pages 项目、D1 数据库，以及名为“项目名-photos”的 KV 存储，已经存在的直接沿用；
2. 按 `wrangler.example.toml` 生成 `wrangler.toml`，填好上面三项资源的编号；
3. 在数据库里建好数据表。

命令可以重复运行，不会重复创建资源，也不会改动已有数据。换了电脑或者删掉了 `wrangler.toml`，重新运行一次即可恢复。`wrangler.toml` 只属于你的网站，已经在 `.gitignore` 里排除，不会被提交。

## 第三步：部署

```bash
npm run deploy
```

部署完成后，终端会显示网址，打开就能使用。

## 第四步：个性化设置

用电脑或手机打开网址，以主厨身份进入“管理”页，点“店铺设置”，可以修改店名和两个角色的称呼。设置保存在你的网站数据库里，两个人看到的是同一份。

另外两项设置在 `public/config.js` 里，改完需要重新执行 `npm run deploy`：

- `PASSCODE`：进入口令。设置后，打开网页需要先输入口令，可以防止陌生人误入。
- `DEFAULT_CATEGORIES`：默认的菜品分类。在管理页添加菜品时，也可以现场新建分类。

## 使用 AI 写菜谱

AI 功能连接你自己的大模型账号，费用由该账号结算。

1. 以主厨身份进入“管理”页，点“上新菜”。
2. 点菜名下方的“AI 设置”，填写接口地址、API Key 和模型名称，然后保存。任何兼容 OpenAI 接口的服务都可以使用，例如 DeepSeek（接口地址 `https://api.deepseek.com/v1`）和通义千问（接口地址 `https://dashscope.aliyuncs.com/compatible-mode/v1`）。
3. 填写菜名后点“AI 写菜谱”，生成的内容会填进表单，检查修改后再保存。

如果想只拍一张照片让 AI 认出是什么菜，需要选择支持图片输入的模型。只按菜名生成的话，任何模型都可以。

这些设置保存在当前浏览器里，在其他设备上使用时，在该设备上填写一次即可。

## 上线前检查

- [ ] 用电脑打开网址，添加一道带照片的菜
- [ ] 用另一台手机打开同一网址，能看到这道菜
- [ ] 把网址发到微信，在微信里打开并下一单
- [ ] 主厨在订单页能看到这一单，并且可以接单

## 常见问题

**部署后马上访问出现 522**：新部署的网站需要片刻完成初始化，稍等后刷新即可。

**微信里打开是空白页或提示程序没有加载完整**：先点提示框里的“重新加载”。如果仍然不行，打开 `https://你的项目名.pages.dev/debug`，诊断页会列出各项检测结果。

**`.pages.dev` 网址在某些网络下打不开**：可以在 Cloudflare 控制台给 Pages 项目绑定一个自己的域名。项目托管在境外，绑定域名不需要 ICP 备案。

**以后修改了代码怎么更新**：在项目目录执行 `npm run deploy`。如果数据库结构有变化，先执行 `npm run db:migrate:remote`。

**同一个账号下想部署多个网站**：对每个网站分别运行 `npm run setup -- 项目名`，再执行 `npm run deploy`。setup 每次都会把 `wrangler.toml` 切换到对应的网站，部署前确认终端里显示的是你要部署的那一个。
