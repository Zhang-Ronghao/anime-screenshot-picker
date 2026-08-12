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

自动出题支持三种图片来源：

- `FanCaps 截图库`：从已匹配的 FanCaps 截图池中随机抽题。
- `Bangumi 封面图`：从看过人数 ≥ 100 的 Bangumi 动画候选池中随机抽条目，再调用 Bangumi API 获取 `images.large` 原图封面。
- `马赛克人物题`：随机抽取动画，通过 Bangumi 角色接口筛选 `relation === "主角"` 的角色，默认采用第一位有原图的主角，并在浏览器本地生成三档马赛克加原图的 16:9 合成图。

三种来源共用年份范围、Bangumi 看过人数、Bangumi 用户看过列表筛选逻辑。题目数量固定最多 20 道。马赛克人物题提供全局强度调整，使用白色背景，主要通过图片 ZIP 下载后上传游戏。

“马赛克人物题”的手动出题模式提供完整的本地工作区：支持多图上传、拖放或粘贴，六档及自定义强度、单图覆盖、白底去除与恢复、逐张下载和 ZIP 批量下载。图片只在浏览器本地处理。

## 项目结构

```text
anime-screenshot-picker/
├── public/
│   └── index.html          # 前端页面
├── functions/
│   ├── bangumi.js          # Cloudflare Pages Function，代理 Bangumi API
│   └── proxy.js            # Cloudflare Pages Function，代理 FanCaps 页面和图片下载、Bangumi 封面展示
├── package.json
├── wrangler.toml
├── .gitignore
└── README.md
```

## 为什么需要 /bangumi 和 /proxy

浏览器页面不能直接用 `fetch()` 读取 FanCaps 的 HTML 页面，因为 FanCaps 没有给你的站点开放 CORS。

Bangumi API 和封面图片在部分网络环境也可能无法由用户浏览器稳定直连，所以本项目用 Cloudflare Pages Functions 提供两个受限代理：

```text
/bangumi?path=%2Fv0%2Fsubjects%2F245665
```

`/bangumi` 只允许必要的 Bangumi API 路径，包括动画条目、条目角色、搜索和用户收藏列表。自动封面及人物出题读取数据时会走这个后端代理；角色响应会被裁剪为 ID、名称、关系和图片字段。

```text
/proxy?url=https%3A%2F%2Ffancaps.net%2F...
```

`/proxy` 只开放必要的 FanCaps 页面、FanCaps 图片、Bangumi 封面和角色图片路径，避免被当成通用开放代理滥用。Bangumi 图片在页面展示、浏览器合成和 ZIP 打包下载时都会通过 `/proxy` 读取。

## 马赛克人物题画板

输出固定为 `1440 × 810`，宽度平均分为 9 列：

- 第 1–2 列：最强马赛克。
- 第 3–4 列：中等马赛克。
- 第 5–6 列：最弱马赛克。
- 第 7 列：白色留空。
- 第 8–9 列：人物原图。

人物图在每个两列区域中按 `contain` 等比缩放并居中，四周保留少量白边，不裁剪、不越界。全局强度滑块位于题单草稿标题下方，会保持当前人物不变，同时调整三档像素块大小并重新生成全部人物题。合成结果是页面内临时 Blob，因此不导出远程 URL 题单；请下载 ZIP 后选择游戏的“上传图片”流程。人物题 ZIP 只有在全部图片打包成功后才会下载，文件名按人物名、动画名的顺序命名，并使用 UTF-8 编码；导出时会为缺少中文名的角色按需读取 Bangumi 人物详情，并优先采用简体中文名。

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

不要用 `python -m http.server public` 或直接打开 HTML 测 Bangumi 封面功能；纯静态预览不会运行 `functions/bangumi.js` 和 `functions/proxy.js`。

## 部署

必须从仓库根目录部署，让 Cloudflare Pages 同时看到 `public/` 和 `functions/`：

```bash
npm run deploy
```

不要只上传 `public` 文件夹，也不要把 Cloudflare Pages 的 Root directory 配成 `public`。`functions/` 必须位于 Pages 项目根目录，否则 `/bangumi` 会 404，前端就无法走后端代理。

部署后先访问下面的地址自检：

```text
https://你的域名/bangumi?path=%2Fv0%2Fsubjects%2F245665
```

正常应返回 Bangumi 条目 JSON。如果返回 404，说明 Functions 没部署进去或项目根目录配置不对。

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

`functions/proxy.js` 只允许代理 FanCaps 的相关页面/图片和 Bangumi 封面、角色图片，避免被当成通用开放代理滥用。

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
https://lain.bgm.tv/pic/crt/...
https://lain.bgm.tv/r/.../pic/crt/...
```

## 备注

这个工具用于降低动漫截图出题的素材收集成本。公开使用时，请注意图片来源、版权风险和目标网站访问频率。
