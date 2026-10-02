# MirageOS（仓库代号 AgenticOS）

> 桌面是真的，其余都是梦。

一个跑在浏览器里的仿 macOS"幻觉操作系统"。每次开机，AI 根据当日 **GitHub Trending** 真实趋势信号，梦出一个平行世界：10 个虚构中文应用落在桌面、专属壁纸与主题、一个可以用地址栏无限下钻的假浏览器。软件分两层：**基础软件先就位**——计算器、记事本、时钟常驻 Dock，它们同样由 AI 现场梦出，但规格固定、按真实系统软件的标准制作（记事本的笔记存 localStorage，是全系统唯一跨开机留存的东西）；**然后才是**随当日信号发散的「今日应用」。点开应用，AI 现场把它画出来——游戏真能玩、工具真能用。Dock 上还常驻一个**应用集市 🛍**——全系统唯一外壳不由 AI 绘制的原生应用：App Store 式固定界面（侧栏分类 / 今日主打 / 商品卡片），但货架上每一款商品都由 AI 依今日世界上架，点开才梦出真身。跨开机一切重梦，唯一的残像存在"梦境回放"里。

## 运行

```bash
# 1) 配好 .env（API_BASE_URL / API_KEY / MODEL），默认监听 127.0.0.1:8787
cd server && node server.js
# 2) 打开 http://127.0.0.1:8787
```

- 零依赖，Node 18+。
- 密钥只存在于服务端 `.env`，前端拿不到。

## 部署（Cloudflare Workers）

线上版本 = `web/` 静态资源（Workers Static Assets）+ `worker/index.js`（`server.js` 的边缘移植：SSE 代理 + 热点抓取）。

```bash
npm install                # 安装 wrangler（仅部署工具）
npx wrangler login         # 首次登录（浏览器授权）
# 密钥三件套（生产走 Secret，不落仓库；本地调试写入 .dev.vars）
npx wrangler secret put API_BASE_URL && npx wrangler secret put API_KEY && npx wrangler secret put MODEL
npx wrangler deploy        # 部署 / 更新
```

- 线上地址：<https://mirageos.litneq.workers.dev>
- `wrangler dev` 可本地起 Worker 调试（读取 `.dev.vars`）。
- 与本地版差异：无 `MIRAGE_DEBUG` 落盘日志（可看 `wrangler tail`）；trending 缓存为各隔离实例内存级。

## 操作

- **双击桌面图标**打开应用；右键图标可"重梦"。
- **基础软件**：计算器 / 记事本 / 时钟常驻 Dock（启动台、想象搜索里也有），随开随梦；规格固定，功能如真。
- **应用集市 🛍**：原生固定界面（非 AI 绘制）的应用商店。商品由 AI 依今日世界上架（开机后自动备货）；卡片一点即梦出应用真身，「获取」装入 Dock；搜索框回车现场编一批新商品；「换一批」或 Alt+点击 重新上架。
- **Alt+点击 Dock 图标**强制重梦该应用（集市 = 重新上架）。
- **潮眼/浏览器**：地址栏输任何假网址，回车，看 AI 把下一个站画出来。
- **想象搜索 Ctrl+K**：输入任何东西，现场梦见一个应用。
- **F4** 启动台 · **Ctrl+↑** 调度中心 · **菜单栏 🎞** 梦境回放（历史开机的桌面残像）。

## 结构

```
server/server.js   # 本地静态服务 + /api/messages SSE 流式代理 + /api/trending(GitHub Trending RSS)
worker/index.js    # Cloudflare Worker 版同款 API（配合 wrangler.jsonc 部署）
web/index.html     # 外壳骨架
web/shell.css      # 外壳样式（移植自 wibeos，MIT）
web/shell.js       # 开机管线 / SSE 桥 / 窗口管理 / 补丁协议 / 梦境回放
docs/PLAN.md       # 设计共识（拷问定稿）
docs/research/     # 竞品与热榜源调研
wibeos/            # fork 来源参考（上游 https://github.com/hansstam86/wibeos）
```

## 致谢

- [wibeos](https://github.com/hansstam86/wibeos)（MIT）——外壳、补丁协议、死控件检测的底座。
- [vibeOS](https://vibeos.sh)（Steve Sanderson）——"幻觉 OS"概念的先行演示。
- [GitHubTrendingRSS](https://github.com/mshibanami/GitHubTrendingRSS)——每日趋势信号源。
