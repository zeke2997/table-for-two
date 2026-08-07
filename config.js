// ============================================================
// 应用配置 —— 这是你唯一需要手动修改的文件
// ============================================================
//
// 【本地模式】下面两项留空时，数据只存在当前手机/浏览器里，
//   适合自己先体验。两个人的数据不互通！
//
// 【联网模式】注册 Supabase 后（见 README.md 第 2 步），
//   把项目的 URL 和 anon key 填进来，数据就存在云端，
//   你和女朋友看到的是同一份菜单和订单。
//
window.APP_CONFIG = {
  // Supabase 项目地址，形如 "https://xxxx.supabase.co"
  SUPABASE_URL: "https://novamdtefpfmfszbjhuy.supabase.co",

  // Supabase 的 anon public key（一长串字母数字）
  SUPABASE_ANON_KEY: "sb_publishable_B3jpTuAxB4JVsMLppl4wDA_zNfqt9Gb",

  // 进入口令：设置后，打开网页需要先输入口令（防止链接被陌生人打开）。
  // 留空 "" 则不需要口令。
  PASSCODE: "",

  // 两个角色的显示名称，随便改
  CHEF_NAME: "主厨",
  GUEST_NAME: "贵宾",

  // 默认的菜品分类（管理页添加菜时也可以现场新建分类）
  DEFAULT_CATEGORIES: ["荤菜", "素菜", "汤羹", "主食", "甜品"],
};
