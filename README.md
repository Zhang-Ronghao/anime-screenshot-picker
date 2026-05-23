# Anime Screenshot Picker

一个用于动漫截图出题/题库素材收集的轻量工具。

核心流程：

1. 输入中文番名，使用 Bangumi 搜索动画条目。
2. 从 Bangumi 条目中提取英文名 / 罗马音标题候选。
3. 搜索 FanCaps 的 Anime Results。
4. 按 Episode 展示每集 Top Images。
5. 可展开单集详细截图，并按页加载。
6. 多部动画的已选截图会保留在全局选择篮中。
7. 可复制或导出已选图片 URL。

## 项目结构

```text
anime-screenshot-picker/
├── public/
│   └── index.html          # 前端页面
├── functions/
│   └── proxy.js            # Cloudflare Pages Function，代理 FanCaps HTML 页面
├── package.json
├── wrangler.toml
├── .gitignore
└── README.md
```

## 为什么需要 /proxy

浏览器页面不能直接用 `fetch()` 读取 FanCaps 的 HTML 页面，因为 FanCaps 没有给你的站点开放 CORS。

所以本项目用 Cloudflare Pages Function 提供一个轻量代理：

```text
/proxy?url=https%3A%2F%2Ffancaps.net%2F...
```

注意：只代理 FanCaps 的 HTML 页面，不代理图片。图片仍由用户浏览器直接从 FanCaps/CDN 加载。

## 本地运行

先安装依赖：

```bash
npm install
```

然后运行：

```bash
npm run dev
```

打开终端里显示的本地地址，例如：

```text
http://localhost:8788
```

## 部署到 Cloudflare Pages

### 1. 上传到 GitHub

```bash
git init
git add .
git commit -m "init anime screenshot picker"
git branch -M main
git remote add origin https://github.com/你的用户名/anime-screenshot-picker.git
git push -u origin main
```

### 2. 创建 Cloudflare Pages 项目

1. 进入 Cloudflare Dashboard。
2. 打开 `Workers & Pages`。
3. 点击 `Create application`。
4. 选择 `Pages`。
5. 选择 `Import an existing Git repository`。
6. 选择你的 `anime-screenshot-picker` 仓库。

### 3. 构建设置

由于这是纯静态 HTML + Pages Function，可以这样设置：

```text
Framework preset: None
Build command: 留空
Build output directory: public
Root directory: / 或留空
```

保存并部署。

### 4. 部署完成后测试

打开 Cloudflare Pages 给你的域名：

```text
https://anime-screenshot-picker.pages.dev
```

实际域名以 Cloudflare 分配或你自定义的域名为准。

测试流程：

1. 输入“芙莉莲”。
2. 选择 Bangumi 的《葬送的芙莉莲》。
3. 选择 `Frieren` 或 `Frieren: Beyond Journey's End`。
4. 点击 `搜 FanCaps`。
5. 选择 FanCaps 的 Anime 结果。
6. 勾选截图。
7. 在顶部“已选截图”区域复制或导出 URL。

## 额度与使用建议

这个工具的代理请求主要来自：

- FanCaps 搜索页
- FanCaps 作品页
- FanCaps 单集详细页
- FanCaps `picture.php` 原图解析页

图片本身不走代理。

建议：

- 不要一次性高频刷新。
- 不要批量抓取完整站点。
- 单集详细图按页加载，不一次性加载全部。
- 如果多人使用，保留当前 Worker Cache 策略。

## 安全限制

`functions/proxy.js` 只允许代理 FanCaps 的相关 HTML 页面，避免被当成通用开放代理滥用。

当前允许路径包括：

```text
https://fancaps.net/search.php
https://fancaps.net/anime/showimages.php
https://fancaps.net/anime/episodeimages.php
https://fancaps.net/anime/picture.php
https://fancaps.net/movies/MovieImages.php
https://fancaps.net/movies/picture.php
```

## 备注

这个工具用于降低动漫截图出题的素材收集成本。公开使用时，请注意图片来源、版权风险和目标网站访问频率。
