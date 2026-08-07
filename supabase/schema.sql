-- ============================================================
-- 家的菜单 - Supabase 数据库初始化脚本
-- 使用方法：登录 Supabase 控制台 → 左侧 SQL Editor → 粘贴全部内容 → Run
-- ============================================================

-- 菜谱表
create table if not exists dishes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  photo text,          -- 照片的公开访问地址
  ingredients text,    -- 食材（多行文本）
  steps text,          -- 做法步骤（多行文本）
  notes text,          -- 小贴士
  available boolean default true,  -- false = 今日估清
  difficulty int default 2,        -- 难度星级 1-3（游戏化 UI 用）
  favorite boolean default false,  -- 她最爱标记
  cook_minutes int,                -- 烹饪时长（分钟，可空）
  created_at timestamptz default now()
);

-- 已有旧表时的增量迁移（重复执行无害）
alter table dishes add column if not exists difficulty int default 2;
alter table dishes add column if not exists favorite boolean default false;
alter table dishes add column if not exists cook_minutes int;

-- 订单表
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  items jsonb not null,       -- [{dish_id, name, qty}]
  note text,                  -- 下单留言
  status text default 'pending',  -- pending / cooking / done / cancelled
  created_by text,            -- 下单人显示名
  created_at timestamptz default now()
);

-- 开启行级安全 (RLS)，并允许匿名访问。
-- 说明：这是一个两人私用的应用，靠"不公开链接 + 前端口令"做轻量保护，
-- 数据本身（菜谱/点单）不敏感，所以策略从简。
alter table dishes enable row level security;
alter table orders enable row level security;

create policy "anon_all_dishes" on dishes
  for all using (true) with check (true);

create policy "anon_all_orders" on orders
  for all using (true) with check (true);

-- 图片存储桶（公开读取）
insert into storage.buckets (id, name, public)
values ('dish-photos', 'dish-photos', true)
on conflict (id) do nothing;

create policy "public_read_photos" on storage.objects
  for select using (bucket_id = 'dish-photos');

create policy "anon_upload_photos" on storage.objects
  for insert with check (bucket_id = 'dish-photos');
