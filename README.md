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

自动出题支持两种图片来源：

- `FanCaps 截图库`：从已匹配的 FanCaps 截图池中随机抽题。
- `Bangumi 封面图`：从看过人数 ≥ 100 的 Bangumi 动画候选池中随机抽条目，再调用 Bangumi API 获取 `images.large` 原图封面。

两种来源共用年份范围、Bangumi 看过人数、Bangumi 用户看过列表筛选逻辑。题目数量固定最多 20 道。

## 项目结构

```text
anime-screenshot-picker/
├── public/
│   └── index.html          # 前端页面
├── functions/
│   └── proxy.js            # Cloudflare Pages Function，代理 FanCaps 页面和图片下载
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

注意：代理只开放必要的 FanCaps 页面、FanCaps 图片和 Bangumi 封面图片路径，避免被当成通用开放代理滥用。普通浏览时图片仍由用户浏览器直接从原站加载；打包 ZIP 时会通过代理读取图片。

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

## 按 Bangumi 条目 ID 获取封面

Bangumi dump 的 `subject.jsonlines` 不包含封面文件名或 CDN hash，因此不能只靠 dump 从 `245665` 推导出 `9d/d1/245665_5an54.jpg`。本项目提供了一个小工具，通过 Bangumi API 获取封面链接：

```bash
npm run bgm-cover -- 245665
```

默认输出 `common` 尺寸，也就是 `/r/400/`：

```text
245665  鬼灭之刃  https://lain.bgm.tv/r/400/pic/cover/l/9d/d1/245665_5an54.jpg
```

获取原图链接：

```bash
npm run bgm-cover -- 245665 --size large
```

输出全部尺寸：

```bash
npm run bgm-cover -- 245665 --all
```

也可以传入本地 dump 文件，用它校验或补充条目名；封面链接仍来自 Bangumi API：

```bash
npm run bgm-cover -- 245665 --dump "C:\Users\Hu_care\Downloads\dump-2026-05-19.210434Z\subject.jsonlines"
```

如果更新了 Bangumi dump，可以重新生成自动出题用的封面候选池：

```bash
npm run build-bgm-anime -- "C:\Users\Hu_care\Downloads\dump-2026-05-19.210434Z\subject.jsonlines"
```

生成脚本默认只保留 Bangumi 看过人数 ≥ 100 的动画；如需调整，可设置 `BGM_MIN_DONE`。

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
- FanCaps 图片和 Bangumi 封面图片的 ZIP 打包下载

普通浏览图片不走代理；打包 ZIP 下载时图片会走代理。

建议：

- 不要一次性高频刷新。
- 不要批量抓取完整站点。
- 单集详细图按页加载，不一次性加载全部。
- 如果多人使用，保留当前 Worker Cache 策略。

## 安全限制

`functions/proxy.js` 只允许代理 FanCaps 的相关页面/图片和 Bangumi 封面图片，避免被当成通用开放代理滥用。

当前允许路径包括：

```text
https://fancaps.net/search.php
https://fancaps.net/anime/showimages.php
https://fancaps.net/anime/episodeimages.php
https://fancaps.net/anime/picture.php
https://fancaps.net/movies/MovieImages.php
https://fancaps.net/movies/picture.php
https://cdni.fancaps.net/file/fancaps-animeimages/...
https://lain.bgm.tv/pic/cover/...
https://lain.bgm.tv/r/.../pic/cover/...
```

## 备注

这个工具用于降低动漫截图出题的素材收集成本。公开使用时，请注意图片来源、版权风险和目标网站访问频率。
