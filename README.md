# MirageOS（仓库代号 AgenticOS）

> 桌面是真的，其余都是梦。

一个跑在浏览器里的仿 macOS"幻觉操作系统"。每次开机，AI 根据当日 **GitHub Trending** 真实趋势信号，梦出一个平行世界：10 个虚构中文应用落在桌面、专属壁纸与主题、一个可以用地址栏无限下钻的假浏览器。点开应用，AI 现场把它画出来——游戏真能玩、工具真能用。跨开机一切重梦，唯一的残像存在"梦境回放"里。

## 运行

```bash
# 1) 配好 .env（API_BASE_URL / API_KEY / MODEL），默认监听 127.0.0.1:8787
cd server && node server.js
# 2) 打开 http://127.0.0.1:8787
```

- 零依赖，Node 18+。
- 密钥只存在于服务端 `.env`，前端拿不到。

## 操作

- **双击桌面图标**打开应用；右键图标可"重梦"。
- **Alt+点击 Dock 图标**强制重梦该应用。
- **潮眼/浏览器**：地址栏输任何假网址，回车，看 AI 把下一个站画出来。
- **想象搜索 Ctrl+K**：输入任何东西，现场梦见一个应用。
- **F4** 启动台 · **Ctrl+↑** 调度中心 · **菜单栏 🎞** 梦境回放（历史开机的桌面残像）。

## 结构

```
server/server.js   # 静态服务 + /api/messages SSE 流式代理 + /api/trending(GitHub Trending RSS)
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
