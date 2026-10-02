# 中文热榜数据源调研（2026-10-02 实测，v2 备用档案）

MVP 已定：仅用 GitHub Trending RSS 单锚点。以下是未来加中文源时的情报：

- **DailyHotApi**（github.com/imsyy/DailyHotApi）：MIT，4.1k star，45+ 源（微博/知乎/B站/抖音/百度）；但 2026-03-11 后未再提交，微博/百度源失效，抖音/快手修复 PR 未合并。可自建，需容错。
- **ourongxing/newsnow**（github.com/ourongxing/newsnow）：22k star，2026-09-16 仍在提交，最活跃。
- **vikiboss/60s**（github.com/vikiboss/60s）：5.8k star，MIT，Deno/Docker/CF Workers，2026-09-10 提交。
- **60s.viki.moe**（免费公共 API）：/v2/weibo 实测返回 50 条，含知乎/B站/抖音/小红书端点，免鉴权；官方明示每日额度有限、限流严、仅供调试。
- **api.vvhan.com**：2026-10-02 实测连接失败，勿依赖。
- **微博官方**：无公开 API，仅网页端内部接口 weibo.com/ajax/side/hotSearch，随时可能加风控。
- **GitHub Trending RSS**（mshibanami/GitHubTrendingRSS）：实测 feed 日期 2026-10-01，仍在日更。✅ MVP 锚点

建议：v2 时优先自建 newsnow 或 vikiboss/60s，公共 60s.viki.moe 仅做调试。
