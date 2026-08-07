# 新手部署教程：注册 Supabase 和 Cloudflare

> 最终目标：拿到 Supabase 的 **Project URL** 和 **anon public key** 两个值填进 `config.js`，
> 然后把项目上传到 Cloudflare Pages，获得一个 `https://xxx.pages.dev` 链接。
> 两个平台都免费，都不需要绑信用卡，不需要买域名，不需要 ICP 备案。

---

## 一、Supabase（数据库）

### 1. 注册账号
- 打开 https://supabase.com → 右上角 **Sign in** → **Sign up now**
- 用 GitHub 账号一键注册，或用邮箱注册（需要去邮箱点验证链接）

### 2. 创建项目
- 点 **New Project**，填写：
  - **Name**：`home-menu`（随意）
  - **Database Password**：点 Generate 自动生成，**存到自己的备忘录**（平时用不到，但别丢；不要发给任何人）
  - **Region**：**Southeast Asia (Singapore)**（离国内最近）
- 点 **Create new project**，等 1~2 分钟

### 3. 初始化数据库
- 左侧 **SQL Editor** → 把本项目 `supabase/schema.sql` 的全部内容粘贴进去 → **Run**
- 看到 `Success. No rows returned` 即成功

### 4. 获取两个关键值 ★
- 左侧齿轮 **Project Settings** → **API**（或 Data API / API Keys）
  - **Project URL**：`https://xxxx.supabase.co`
  - **anon public** key：`eyJ...` 开头的长串（新版界面叫 **Publishable key**，`sb_publishable_...` 开头，等效）
- 把这两个值填进 `config.js`（这两个值是设计为可公开的前端密钥，不算泄密）

⚠️ 同页面的 `service_role` key / Secret key / 数据库密码是**真正的秘密**，永远不要给任何人。

---

## 二、Cloudflare Pages（网页托管）

### 1. 注册账号
- 打开 https://dash.cloudflare.com/sign-up → 邮箱 + 密码 → 收验证邮件确认
- 登录后若引导你「添加域名」，直接跳过，不需要

### 2. 部署
**方式 A（命令行，可让 AI 代劳）**：`npx wrangler login` 授权后 `npx wrangler pages deploy .`

**方式 B（网页拖拽上传）**：
- **Workers & Pages** → **Create** → **Pages** 标签 → **Upload assets**
- Project name 决定网址（如 `our-menu` → `our-menu.pages.dev`），仅限小写字母/数字/横杠
- 把整个 `table-for-two` 文件夹拖进去 → **Deploy site**
- WSL 项目在 Windows 资源管理器中的路径：`\\wsl.localhost\Ubuntu\home\zeke\personal-projects\dianzicaidan`
  （本机的文件夹名沿用了旧名 `dianzicaidan`；新电脑上 `git clone` 下来会是 `table-for-two`）

以后每次改了代码，重复部署一次即可（方式 A 一条命令 / 方式 B 再拖一次）。

---

## 三、上线前检查清单

- [ ] `config.js` 已填 SUPABASE_URL 和 SUPABASE_ANON_KEY
- [ ] `config.js` 已设置 PASSCODE 口令（防陌生人误入）
- [ ] 本地打开页面，右上角「本地模式」标记已消失
- [ ] 添加一道菜 → 换个浏览器/手机打开 → 能看到同一道菜（数据在云端）
- [ ] 部署后用微信打开 `https://xxx.pages.dev` 链接测试
