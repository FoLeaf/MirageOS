<p align="center">
  <img src="assets/readme/hero.svg" width="100%"
       alt="MirageOS：桌面是真的，其余都是梦——AI 依当日 GitHub Trending 现场梦出的浏览器幻觉操作系统">
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-18%2B-339933?logo=nodedotjs&logoColor=white" alt="Node 18+"></a>
  <a href="https://workers.cloudflare.com/"><img src="https://img.shields.io/badge/edge-Cloudflare%20Workers-f6821f" alt="Cloudflare Workers"></a>
  <a href="https://mirageos.litneq.workers.dev"><img src="https://img.shields.io/badge/%E5%9C%A8%E7%BA%BF%E4%BD%93%E9%AA%8C-mirageos-8b5cf6" alt="在线体验"></a>
</p>

MirageOS 是一个跑在浏览器里的仿 macOS「幻觉操作系统」。每次开机，AI 依当日 **GitHub Trending** 真实趋势信号，梦出一个平行世界：一张专属壁纸与主题、10 个落在桌面上的虚构中文应用、一个地址栏可以无限下钻的假浏览器。点开应用，AI 现场把它画出来——游戏真能玩、工具真能用。跨开机一切重梦，唯一的残像存在「梦境回放」里。

## 先看图

<p align="center">
  <img src="docs/screenshots/desktop.webp" width="100%"
       alt="今日桌面：AI 依当日 GitHub Trending 梦出的壁纸、主题与虚构中文应用">
</p>
<p align="center"><i>今日桌面——每天都不一样，由当日真实热点决定</i></p>

| 开机锁屏 | 应用集市（原生壳 · AI 上架） |
|:---:|:---:|
| ![开机锁屏](docs/screenshots/lock.webp) | ![应用集市](docs/screenshots/appstore.webp) |

## 它如何做梦

<p align="center">
  <img src="assets/readme/workflow.svg" width="100%"
       alt="MirageOS 每日循环：热点信号 → 开机成梦 → 现场作画 → 重启归零，次日以新热点重新入梦">
</p>

软件分三层，常驻与发散各司其职：

| 层 | 内容 | 谁来画 |
|---|---|---|
| **基础软件** | 计算器 · 记事本 · 时钟，常驻 Dock（启动台、想象搜索里也有） | AI 现场梦出，但规格固定，按真实系统软件的标准制作 |
| **今日应用** | 随当日热点发散的 10 个虚构应用 | AI 依今日世界自由发挥 |
| **应用集市 🛍** | App Store 式商店：侧栏分类 / 今日主打 / 商品卡片 | 全系统唯一不由 AI 绘制的外壳；货架上每款商品由 AI 依今日世界上架，点开才梦出真身 |

记事本的笔记存在 localStorage 里，是全系统唯一跨开机留存的东西。

<details>
<summary><b>English</b></summary>

MirageOS is a macOS-flavored *hallucination operating system* that runs entirely in the browser. On every boot, an AI dreams up a parallel world seeded by that day's real GitHub Trending signals: a desktop of fictional apps, a matching wallpaper and theme, and a fake browser whose address bar leads ever deeper down the rabbit hole. Click any app and the AI paints it live, streaming into a sandboxed iframe — games actually play, tools actually work. Base apps (calculator, notes, clock) sit in the Dock to fixed, real-system-app specs, and the App Store is the only natively-drawn shell, restocked each day by the AI. Nothing survives a reboot except your notes.

</details>

## 快速开始

```bash
git clone https://github.com/FoLeaf/MirageOS.git
cd MirageOS
cp .env.example .env    # 填入 API_BASE_URL / API_KEY / MODEL
cd server && node server.js
# 打开 http://127.0.0.1:8787
```

- 零依赖，Node 18+；任何兼容 Anthropic `/v1/messages` 协议的端点（官方 API 或中转）均可。
- 密钥只存在于服务端 `.env`，前端拿不到。

### 配置项（`.env`）

| 变量 | 必填 | 说明 |
|---|:---:|---|
| `API_BASE_URL` | ✅ | 兼容 Anthropic 协议的 API 端点 |
| `API_KEY` | ✅ | 端点密钥 |
| `MODEL` | ✅ | 模型名（按端点实际提供的填写） |
| `MODEL_REASONING_EFFORT` | | 思考等级；不支持的端点留空 |
| `GATE_PASSWORD` | | 开机门禁密码，见下 |
| `MIRAGE_DEBUG` | | 调试：把每次生成的原始 SSE 输出记录到 `tmp/mirage-debug.log` |

### 门禁

不设 `GATE_PASSWORD` 即不设防（本机自用最方便）。设置后：打开页面先出锁屏，前端拿输入的口令向 `/api/config` 试锁，通过才开机——**密码只存在服务端**，前端代码与仓库里都不出现任何明文口令。公开部署（见下）强烈建议设置，防止陌生人烧你的 key。

## 部署（Cloudflare Workers）

线上版本 = `web/` 静态资源（Workers Static Assets）+ `worker/index.js`（`server.js` 的边缘移植：SSE 代理 + 热点抓取）。

```bash
npm install               # 安装 wrangler（仅部署工具）
npx wrangler login        # 首次登录（浏览器授权）
# 密钥四件套（生产走 Secret，不落仓库；本地调试写入 .dev.vars，模板见 .dev.vars.example）
npx wrangler secret put API_BASE_URL
npx wrangler secret put API_KEY
npx wrangler secret put MODEL
npx wrangler secret put GATE_PASSWORD   # 公开部署务必设置，否则门禁默认关闭
npx wrangler deploy       # 部署 / 更新
```

- `wrangler dev` 可本地起 Worker 调试（读取 `.dev.vars`）。
- 与本地版差异：无 `MIRAGE_DEBUG` 落盘日志（可看 `wrangler tail`）；trending 缓存为各隔离实例内存级。

## 操作指南

- **双击桌面图标**打开应用；右键图标可「重梦」。
- **基础软件**：计算器 / 记事本 / 时钟常驻 Dock，随开随梦；规格固定，功能如真。
- **应用集市 🛍**：商品由 AI 依今日世界上架（开机后自动备货）；卡片一点即梦出应用真身，「获取」装入 Dock；搜索框回车现场编一批新商品；「换一批」或 Alt+点击 重新上架。
- **Alt+点击 Dock 图标**强制重梦该应用（集市 = 重新上架）。
- **潮眼/浏览器**：地址栏输任何假网址，回车，看 AI 把下一个站画出来。
- **想象搜索 Ctrl+K**：输入任何东西，现场梦见一个应用。
- **F4** 启动台 · **Ctrl+↑** 调度中心 · **菜单栏 🎞** 梦境回放（历史开机的桌面残像）。

## 仓库结构

```
server/server.js   # 本地静态服务 + /api/messages SSE 流式代理 + /api/trending（GitHub Trending RSS）
worker/index.js    # Cloudflare Worker 版同款 API（配合 wrangler.jsonc 部署）
web/index.html     # 外壳骨架
web/shell.css      # 外壳样式（移植自 wibeos，MIT）
web/shell.js       # 开机管线 / SSE 桥 / 窗口管理 / 补丁协议 / 梦境回放
docs/PLAN.md       # 设计共识（拷问定稿）
docs/research/     # 竞品与热榜源调研
```

更多设计取舍——为什么「延迟即仪式」、反思考提示词的对照实验、原生 / 基础 / 今日三层软件体系——见 [docs/PLAN.md](docs/PLAN.md)。

## 许可 · 致谢

[MIT](LICENSE)。外壳底座移植自 [wibeos](https://github.com/hansstam86/wibeos)（MIT）。

- [wibeos](https://github.com/hansstam86/wibeos)（MIT）——外壳、补丁协议、死控件检测的底座。
- [vibeOS](https://vibeos.sh)（Steve Sanderson）——「幻觉 OS」概念的先行演示。
- [GitHubTrendingRSS](https://github.com/mshibanami/GitHubTrendingRSS)——每日趋势信号源。

欢迎 issue / PR，一起做梦。
