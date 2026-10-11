// 一键准备 Cloudflare 资源：npm run setup -- <项目名>
//
// 按项目名在你的 Cloudflare 账号里查找 Pages 项目、D1 数据库（同名）和 KV 命名空间（<项目名>-photos），
// 没有就新建，然后按 wrangler.example.toml 生成 wrangler.toml 并建好数据表。
// 可以重复运行：资源已存在时只读取编号，不会重复创建，也不会动已有数据。
// 换电脑后运行一次就能恢复配置；同一账号下有多个网站时，用它切换当前要部署的网站。

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,56}[a-z0-9])?$/;
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function fail(msg) {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}

// 读取类命令：解析 JSON 输出
function wranglerJson(args) {
  const r = spawnSync(npx, ["wrangler", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (r.status !== 0) fail(`执行 wrangler ${args.join(" ")} 失败：\n${r.stderr || r.stdout}`);
  try {
    return JSON.parse(r.stdout);
  } catch {
    fail(`无法解析 wrangler ${args.join(" ")} 的输出：\n${r.stdout}`);
  }
}

// 写入类命令：直接显示 wrangler 的输出
function wrangler(args) {
  const r = spawnSync(npx, ["wrangler", ...args], { stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) fail(`执行 wrangler ${args.join(" ")} 失败`);
}

const name = process.argv[2];
if (!name || !NAME_RE.test(name)) {
  fail("用法：npm run setup -- <项目名>\n项目名只能包含小写字母、数字和连字符，例如 our-kitchen。它会成为网址 https://<项目名>.pages.dev");
}
const kvTitle = `${name}-photos`;

console.log(`▶ 准备项目 ${name}`);

const findProject = () => wranglerJson(["pages", "project", "list", "--json"]).find((p) => p["Project Name"] === name);
let project = findProject();
if (!project) {
  console.log("  新建 Pages 项目…");
  wrangler(["pages", "project", "create", name, "--production-branch", "main"]);
  project = findProject() || fail("Pages 项目创建后没有查到，请稍后重试");
}
console.log(`  ✔ Pages 项目：https://${project["Project Domains"].split(",")[0].trim()}`);

const findDb = () => wranglerJson(["d1", "list", "--json"]).find((d) => d.name === name);
let db = findDb();
if (!db) {
  console.log("  新建 D1 数据库…");
  wrangler(["d1", "create", name]);
  db = findDb() || fail("D1 数据库创建后没有查到，请稍后重试");
}
console.log(`  ✔ D1 数据库：${db.name}`);

const findKv = () => wranglerJson(["kv", "namespace", "list"]).find((k) => k.title === kvTitle);
let kv = findKv();
if (!kv) {
  console.log("  新建 KV 命名空间…");
  wrangler(["kv", "namespace", "create", kvTitle]);
  kv = findKv() || fail("KV 命名空间创建后没有查到，请稍后重试");
}
console.log(`  ✔ KV 命名空间：${kv.title}`);

const toml = readFileSync(new URL("../wrangler.example.toml", import.meta.url), "utf8")
  .replace(/^name = ".*"$/m, `name = "${name}"`)
  .replace(/^database_name = ".*"$/m, `database_name = "${name}"`)
  .replace(/^database_id = ".*"$/m, `database_id = "${db.uuid}"`)
  .replace(/^id = ".*"$/m, `id = "${kv.id}"`);
writeFileSync(new URL("../wrangler.toml", import.meta.url), toml);
console.log("  ✔ 已生成 wrangler.toml");

console.log("  建立或更新数据表…");
wrangler(["d1", "migrations", "apply", "DB", "--remote"]);

console.log(`\n完成。运行 npm run deploy 部署到 https://${project["Project Domains"].split(",")[0].trim()}`);
