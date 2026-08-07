# 🍳 Zeke 食堂

线上地址：https://zeke-shitang.pages.dev
代码仓库：https://github.com/zeke2997/table-for-two

> 📖 换电脑后恢复开发环境、日常同步与部署流程，见 [DEV.md](DEV.md)。
> 本文件介绍项目本身，以及从零搭一套属于你自己的流程。

一个两人自用的电子菜单网页应用：主厨记录菜谱，另一半在线点单。

- 纯静态网页，**无构建步骤**，改完代码刷新即生效
- 数据存 [Supabase](https://supabase.com)（免费额度对两人使用绰绰有余）
- 托管在 Cloudflare Pages（免费、自动 HTTPS、送二级域名）
- 未配置数据库时自动进入「本地模式」，数据只存在当前浏览器，方便先体验

## 功能

| 页面 | 功能 |
|---|---|
| 菜单 | 按分类浏览、搜索菜名/食材、查看做法、加入点单 |
| 点单 | 调整份数、给主厨留言、提交订单 |
| 订单 | 查看订单流水；主厨可接单 → 完成/取消 |
| 管理 | （仅主厨可见）添加/编辑/删除菜谱、上传照片、标记"今日估清" |

首次打开会让你选择身份（主厨 / 点菜的），点右上角的身份标签可随时切换。

## 本地试用（第 1 步）

```bash
cd table-for-two
python3 -m http.server 8000
```

浏览器打开 http://localhost:8000 即可。此时是「本地模式」（页面右上角有标记）。

## 接入云端数据库（第 2 步）

1. 打开 https://supabase.com 注册账号（可用 GitHub 或邮箱），免费。
2. 点击 **New Project**，起个名字（如 `home-menu`），Region 选 **Singapore**（离国内最近），数据库密码随便设一个记下来。
3. 等项目创建完成（约 1 分钟），进入左侧 **SQL Editor**，把 `supabase/schema.sql` 的全部内容粘贴进去，点 **Run**。
4. 进入左侧 **Project Settings → API**，复制两个值：
   - `Project URL`（形如 `https://xxxx.supabase.co`）
   - `anon public` key（一长串字符）
5. 填进本项目根目录的 `config.js`，刷新页面——右上角的「本地模式」标记消失，数据就存云端了。

> 顺手在 `config.js` 里把 `PASSCODE` 设置一个口令，防止链接被陌生人误入。

## 部署上线（第 3 步）

用 Cloudflare Pages（免费）：

1. 打开 https://dash.cloudflare.com 注册账号。
2. 左侧 **Workers & Pages → Create → Pages → Upload assets**（直接上传方式，不需要 Git）。
3. 起个项目名（决定你的网址，如 `我们的菜单.pages.dev`），把整个 `table-for-two` 文件夹拖进去上传。
4. 完成后得到 `https://<项目名>.pages.dev` 的链接，发到微信里就能打开。

以后更新代码/改配置，回到 Pages 项目里再上传一次即可。

> 如果 `.pages.dev` 域名在你的网络环境下打不开，备选方案是花几十元/年买个自定义域名绑定上去（海外托管不需要 ICP 备案），或改用 Vercel 部署。

## 安全性说明（请阅读）

这是一个**私用小工具**的安全模型，不是面向公众的产品：

- `config.js` 里的 anon key 本来就是设计为可公开的前端密钥；
- 数据库策略允许匿名读写，意味着**拿到你链接和 key 的人理论上可以改你的菜单**——所以不要把链接发到公开场合；
- `PASSCODE` 口令只是前端的一道软门槛，防误入，不防黑客。

菜谱和点单记录不是敏感数据，这个取舍对两人自用是合理的。如果以后想开放给更多人用，再升级成 Supabase Auth 正式登录即可。

## 文件结构

```
table-for-two/
├── index.html          # 页面结构 + SVG 素材 + 抢救加载器
├── config.js           # ★ 唯一需要你修改的配置文件
├── css/style.css       # 样式
├── js/store.js         # 数据层（原生 fetch 调 Supabase / 本地模式双实现）
├── js/app.js           # 业务逻辑 + 音效
├── vendor/fonts/       # 本地化字体（不依赖 CDN）
├── supabase/schema.sql # 数据库初始化脚本
└── DEV.md              # 开发与部署指南（换电脑必看）
```

> `vendor/supabase.js` 是早期用过的官方 SDK，因体积过大会卡死微信浏览器，**已弃用且没有任何地方引用**，
> 数据层现在是 `js/store.js` 里的原生 fetch 实现。详见 CONTRIBUTING.md 的「微信兼容」一节。
