# 竞品/先行者调研（2026-10-02，侦察兵报告存档）

## 成熟网页桌面 OS（真 OS，无 AI 生成）
- **Puter**（puter.com / github.com/PuterHQ/puter）：开源"互联网 OS"，浏览器桌面+文件系统+应用商店，内置免 key 的 puter.js AI API。
- **OS.js**（os.js.org）：可自托管网页桌面。
- **windows93**（windows93.net）：戏仿 Win95。同类：daedalOS、anuraOS。

## AI 生成 UI
- **v0.dev**：prompt→React 代码，面向开发者。
- **Claude Artifacts**：流式渲染自包含 HTML 应用。
- **WebSim**（websim.com，2024 爆火）：输入任意 URL，Claude 即时"梦出"整站，站内链接点开继续幻觉——与本项目"超链接→AI 重绘下一屏"机制相同。
- **Google《用 Gemini 2.5 Flash-Lite 模拟神经 OS》**（2025）：点击转 JSON→LLM 流式吐 HTML，浏览器原生解析器边收边渲染。

## 最接近的先行者
- **vibeOS**（Steve Sanderson，Microsoft BUILD 2026 演示；vibeos.sh）："Fully Hallucinated OS"，界面与应用全部 LLM 实时生成。
- **wibeos**（github.com/hansstam86/wibeos，MIT）：受 vibeOS 启发的 macOS 风复刻，原生 Swift + 单文件 shell.html，每个应用是 Claude 生成的沙箱 HTML。**本项目 fork 对象**。
- **Pneuma**（pneuma.computer）：LLM 生成 Rust→WASM 程序的原生桌面。

## 结论
"热点驱动桌面、每次开机不同"角度中英文均无先行者。本项目差异点：①GitHub/热点驱动的生成式桌面 ②浏览器即开即用 ③中文平行世界。

## macOS 网页壳备选
- PuruVJ/macos-web（Svelte）、AlexJuca/macos-monterey（React）。
