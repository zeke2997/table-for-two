-- 店铺设置：店名和两个角色的称呼。每个部署出来的网站各存一份，模板代码里只放默认值。
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
