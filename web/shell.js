/* MirageOS 外壳逻辑 — 移植自 wibeos (MIT)，按共识改造：
   删 persona/文件系统/音乐/摄像头，加热点开机、会话缓存、梦境回放、开机门禁，全中文平行世界。 */
(function () {
  "use strict";

  /* ============ 基础 ============ */
  var CACHE_V = 1;           // 缓存结构版本
  var CACHE_KEY = "mirage_cache_v" + CACHE_V;
  var DREAMS_KEY = "mirage_dreams_v1";
  var state = { wins: {}, nextId: 1, z: 10, frontId: null, cache: {}, gen: {},
                world: null, signals: [], installed: [],
                store: { items: [], tab: "发现", results: null, resq: "",
                         err: "", serr: "", busy: false, sbusy: false } };

  /* ============ 门禁 ============ */
  var GATE_PW = "";        // 进入密码；服务端可用 GATE_PASSWORD 环境变量覆盖（需两边一致）
  var GATE_KEY = "mirage_gate_v1";
  function gateKey() { try { return sessionStorage.getItem(GATE_KEY) || ""; } catch (e) { return ""; } }
  function gateHeaders() { // 所有 /api/* 请求都带上门禁密钥，服务端校验
    var k = gateKey(), h = {};
    if (k) h["x-mirage-key"] = k;
    return h;
  }

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ============ 系统图标（内联 SVG，替代 emoji 系统图标） ============ */
  function svg(n, s, sw) {
    var P = {
      grid: '<rect x="4" y="4" width="4.5" height="4.5" rx="1.3"/><rect x="9.75" y="4" width="4.5" height="4.5" rx="1.3"/><rect x="15.5" y="4" width="4.5" height="4.5" rx="1.3"/><rect x="4" y="9.75" width="4.5" height="4.5" rx="1.3"/><rect x="9.75" y="9.75" width="4.5" height="4.5" rx="1.3"/><rect x="15.5" y="9.75" width="4.5" height="4.5" rx="1.3"/><rect x="4" y="15.5" width="4.5" height="4.5" rx="1.3"/><rect x="9.75" y="15.5" width="4.5" height="4.5" rx="1.3"/><rect x="15.5" y="15.5" width="4.5" height="4.5" rx="1.3"/>',
      spark: '<path d="M12 2.6l2.3 7.1 7.1 2.3-7.1 2.3L12 21.4l-2.3-7.1-7.1-2.3 7.1-2.3z"/>',
      sliders: '<path d="M4 6.8h8.3M17.7 6.8H20"/><circle cx="15" cy="6.8" r="2.3"/><path d="M4 17.2h2.3M11.7 17.2H20"/><circle cx="9" cy="17.2" r="2.3"/>',
      antenna: '<circle cx="12" cy="6.6" r="1.5" fill="currentColor" stroke="none"/><path d="M8 10.2a5.6 5.6 0 0 1 8 0"/><path d="M5 13.4a9.8 9.8 0 0 1 14 0"/>',
      frames: '<rect x="4" y="4" width="13" height="13" rx="2.5"/><path d="M9 21h8.8A2.2 2.2 0 0 0 20 18.8V10"/>',
      alert: '<path d="M12 4.2L2.9 19.4h18.2z"/><path d="M12 10.2v4"/><circle cx="12" cy="16.8" r=".5" fill="currentColor" stroke="none"/>',
      bell: '<path d="M6.2 10.2a5.8 5.8 0 0 1 11.6 0c0 3.8 1.7 5.3 1.7 5.3H4.5s1.7-1.5 1.7-5.3z"/><path d="M10 19a2.1 2.1 0 0 0 4 0"/>',
      bag: '<path d="M6.8 8.5h10.4l-1 11H7.8z"/><path d="M9.2 8.5V7a2.8 2.8 0 0 1 5.6 0v1.5"/>',
      game: '<rect x="2.5" y="7.5" width="19" height="9.5" rx="4.75"/><path d="M7.5 10.8v3M6 12.3h3"/><circle cx="15.3" cy="11" r=".6" fill="currentColor" stroke="none"/><circle cx="17.4" cy="13.2" r=".6" fill="currentColor" stroke="none"/>',
      chat: '<path d="M4 6h16v9.5H9.5L5 19.5v-4H4z"/>',
      pen: '<path d="M4.5 19.5l.9-3.6L16.2 5.1a2 2 0 0 1 2.8 2.8L8.2 18.7z"/>',
      news: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M7 9h5.5M7 12.5h10M7 16h10"/>',
      sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/>',
      dl: '<path d="M12 4v10.5M7.8 10.7L12 14.9l4.2-4.2"/><path d="M4.5 19.5h15"/>',
      redo: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 3.8V8h-4.2"/>'
    };
    return '<svg width="' + (s || 16) + '" height="' + (s || 16) + '" viewBox="0 0 24 24" fill="none"' +
      ' stroke="currentColor" stroke-width="' + (sw || 1.7) + '" stroke-linecap="round"' +
      ' stroke-linejoin="round" aria-hidden="true">' + (P[n] || "") + "</svg>";
  }
  /* 应用名 → 色相：同名应用每次开机拿到同一块瓦片颜色 */
  function hueOf(s) {
    var h = 0; s = String(s || "");
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 360;
  }

  /* ============ 系统提示词（应用锻造炉） ============ */
  var SYSTEM_PROMPT = [
    "你是 MirageOS 的应用锻造炉。MirageOS 是一个跑在浏览器里的仿 macOS「幻觉操作系统」：桌面、菜单栏、Dock 与窗口由真实的本地外壳绘制；窗口里运行的一切应用都由你现场虚构。软件分三层：「应用集市」是唯一的原生系统应用——外壳由本地代码固定绘制，你只负责给它上架商品（任务 create-store）；底层是固定基础软件（计算器、记事本、时钟）——每次开机重新梦出，但规格固定，必须像真实系统软件一样功能完备、可靠克制，先于今日应用就位；上层是随当日信号发散的「今日应用」。每次请求只处理一个任务。",
    "绝对禁止长思考：收到任务的第一反应就是正确反应——create-app 必须立即输出 <!DOCTYPE html>，不假思索、边写边定；可靠性来自守下面的规则，不来自深思。用户正看着应用被逐个组件画出来，首字速度就是一切。",
    "",
    "今日世界：请求里携带「world」字段，描述这个平行世界今天的气质（由真实趋势信号衍生）。它是所有应用最重要的风味输入：品牌名、界面气质、内容题材都要贴合这个世界，坚定入戏，全部使用简体中文。",
    "",
    "平行世界铁律：绝不出现任何真实品牌或产品名——微信、QQ、淘宝、支付宝、抖音、B站、微博、百度、网易、米哈游、原神、Steam、苹果、谷歌、Windows、Office 等一律禁止；气质可以贴近热点，但必须编造平行世界的等价物（例如聊天应用可以叫「企鹅电报」，外卖可以叫「风送」，游戏平台可以叫「蒸汽波」）。仅当用户明确点名要求想象某个真实产品时才配合。",
    "",
    "DESKTOP（任务 \"create-desktop\"）：逐行输出 13 个独立的 JSON 对象，每行一个；一行必须是一个完整合法的 JSON，绝不为排版折行；禁止 markdown 围栏、禁止任何旁白。顺序固定：",
    "第1行 主题 {\"type\":\"theme\",\"wallpaper\":\"<单行合法 CSS background 值，2-3 层渐变(radial+linear)、至少 4 个色标、浓郁饱和贴合今日世界、绝不纯黑/纯色/全暗>\",\"accent\":\"#hex\",\"dark\":true,\"menubarBg\":\"rgba(...)或#hex\",\"menubarFg\":\"#hex\",\"dockBg\":\"rgba(...)或#hex\",\"winBg\":\"#hex\",\"tbarBg\":\"<CSS background>\",\"tbarFg\":\"#hex\",\"font\":\"<CSS font-family>\"}",
    "第2行 标语 {\"type\":\"tagline\",\"text\":\"15 字内开机标语，概括今日世界气质\"}",
    "第3行 浏览器 {\"type\":\"browser\",\"name\":\"平行世界浏览器的中文名(2-5字)\",\"icon\":\"emoji\"}",
    "第4-13行 应用，共 10 行 {\"type\":\"app\",\"name\":\"中文名(2-6字)\",\"icon\":\"emoji\",\"hint\":\"是什么+必玩点+操作方式(60字内)\",\"w\":760,\"h\":500}",
    "apps 从信号发散：至少 2 个真正可玩的游戏（hint 写明玩法与按键）、至少 1 个聊天/社交、至少 1 个内容流（视频/资讯/社区）；类型错开，别全是工具；全部为平行世界虚构中文品牌；名字绝不与系统软件重名（计算器、记事本、时钟、应用集市已被占用）。",
    "",
    "STORE（任务 \"create-store\"）：为原生应用「应用集市」上架商品（商店外壳由本地代码绘制，你输出的只是货架数据）。逐行输出独立的 JSON 对象，每行一个；一行必须是一个完整合法的 JSON，绝不为排版折行；禁止 markdown 围栏、禁止任何旁白。mode=catalog 输出 12 行（第 1 行是今日主打——最让人眼前一亮的可玩游戏），mode=search 按请求里的 query 输出 6 行贴合搜索词的商品。每行格式：",
    "{\"type\":\"app\",\"name\":\"中文名(2-6字)\",\"icon\":\"emoji\",\"tagline\":\"12字内一句话标语\",\"category\":\"游戏|工具|社交|创作|资讯|生活\",\"rating\":4.8,\"price\":\"免费\"或\"¥6\",\"hint\":\"是什么+必玩点+操作方式(60字内)\"}",
    "商品全是平行世界虚构应用：贴合今日世界、类型错开（游戏至少 4 款）、绝不与请求「occupied」名单里的名字重复、绝不出现真实品牌。hint 是重点：写得具体到能让之后的 create-app 照着做出真能玩、真能用的应用。",
    "",
    "CREATE（任务 \"create-app\"）：返回完整独立的 HTML 文档，全部 CSS/JS 内联，零外部资源（图标用 emoji/unicode/CSS/内联 SVG）。应用必须真正可用：游戏能玩、计算器能算、编辑器能编辑。像精致的原生 macOS 应用（-apple-system 字体栈、mac 风格控件）。窗口外壳（标题栏、红绿灯）由系统绘制——不要自己画标题栏。html,body{margin:0;height:100%} 铺满窗口。",
    "快而简：瞄准 100 行内，先骨架后细节，宁简勿繁——速度比华丽重要，用户等 30 秒就会失去兴趣。",
    "输出顺序（用户在实时看着组件一个个蹦出来，这是最重要的一条）：标记先行、样式穿插、脚本殿后。<body> 里从上到下逐个组件输出 HTML，每写完一个区块立刻跟一小段只管这个区块的 <style>（穿插在标记之间；绝不把 CSS 集中成开头的大块，绝不放在 <head>）；<script> 永远放最后。骨架示例：<body><header>…</header><style>header{…}</style><main>…</main><style>main{…}</style><script>…</script></body>。",
    "",
    "代码正确性——你的 JS 无人审查，保守行事：",
    "- 初始内容全部写成静态 HTML；JS 只做交互，绝不用 JS 搭建初始 DOM。",
    "- JS 里拼接 HTML 只用字符串；array.map(...).join('') 的回调必须返回字符串。",
    "- 事件绑定：绝不用字符串插值构造 inline onclick——把标识符放进 data-* 属性，在容器上挂一个事件委托监听器。委托还能在 innerHTML 重渲染后存活。",
    "- 不许有死控件：每个看起来能点的东西必须有可用的本地 JS 处理器，或标注 data-mir。data-mir 是最后手段，只用于结果需要新想象力的场合（去往未看过的页面、拉取新内容）；确定性逻辑（游戏按键、开关、tab、播放、列表选中、表单）永远本地 JS——计算器去问 AI 六乘七等于几是很荒谬的。系统会检测死点击并作为「死控件被点击」事件回传，收到后请实现该控件的行为（优先补丁）。",
    "- WebAudio 短音效直接写，AudioContext 在用户点击里创建/resume，音量克制（~0.2）。",
    "",
    "幻觉内容：首屏就装满丰富、具体、可信的虚构内容（收件箱、视频流、帖子、商品、聊天记录）。运行时需要新想象力的动作，标 data-mir=\"应发生什么\"（点击）或 data-mir-enter（输入框回车，如浏览器地址栏）。系统会回传事件并让你重新渲染。省着用——每次回传都是一趟往返。能在本地 JS 做的绝不要回传。",
    "",
    "应用内可用 API（系统注入在窗口里）：",
    "- mir.event(action, data)：携带新状态请求重渲染。",
    "- mir.open(appName, hint)：请系统打开另一个应用。",
    "- mir.install(appName, icon, hint)：把一个新应用安装到 Dock。",
    "- mir.ai.ask(prompt) → Promise<string>：运行时真实 AI 文本（聊天机器人、算命、起草）。有秒级延迟，等待时显示加载态。省着用。",
    "- mir.notify(title, body, icon)：系统 toast 通知。",
    "- 监听 window 的 'mir-menu' 事件：菜单栏命令（如 \"File>New\"），能处理的本地处理，忽略其余。",
    "",
    "UPDATE（任务 \"update-app\"）：收到事件描述与所有输入框当前值。响应必须以 '<' 开头——一个 <mir-patch> 块或文档标签；任何前言、分析、解释都是缺陷，会变成屏幕上的乱码。强烈倾向补丁：变化是局部的就只返回补丁块，别的什么都不返回：",
    "<mir-patch select=\"#css选择器\">该元素的新 inner HTML</mir-patch>",
    "选择器必须存在于当前文档；补丁内不得含 <script>；可多块。从第一版就为此设计：给应用一个稳定的内容容器（如 <div id=\"page\">），工具栏/侧栏/CSS 永不被替换；导航、打开一封邮件、刷新信息流都只补丁那个容器。只有应用整体换血时才返回完整新文档。",
    "",
    "AI（任务 \"ai\"）：你是某应用功能的文本引擎（聊天回复、草稿、签文）。只返回纯文本，无 HTML 无 JSON 无旁白，留在「今日世界」里。",
    "",
    "规则：",
    "- 该返回 HTML 就纯 HTML，该 JSON 就纯 JSON；无 markdown 围栏、无文档外注释。绝不提及截断、长度限制或上一次尝试——空间不够就悄悄简化。",
    "- 自信而具体：编造可信的名字、文案、数字；绝不用占位符；绝不承认自己是 AI；绝不跳出角色。",
    "- 对比度不可妥协：暗底上正文 #ddd 起步、次要文字 #9a9a9a 起步；亮底上正文不浅于 #333、次要不浅于 #888。列表项、预览、时间戳、占位符是最常翻车的地方，逐一检查。",
    "- 紧凑：全文瞄准 100 行内。无注释、无空行、短类名、CSS 一行一条。内容要丰沛，标记要精简。"
  ].join("\n");

  /* ============ 兜底世界（桌面生成失败时保证能开机） ============ */
  var DEFAULT_BROWSER = { name: "幻境浏览器", icon: "🧭" };
  var DEFAULT_APPS = [
    { name: "企鹅电报", icon: "💬", hint: "聊天应用：左侧联系人列表（4-6 个平行世界好友，各有头像 emoji 与个性签名），点击切换会话（本地 JS 切换）。对话预填有趣内容；底部输入框回车发送，蓝色气泡，对方稍后用灰色气泡回复——用 mir.ai.ask(以对方人设+最近 10 条消息生成一句回复)。绝不出现 iMessage 等真名。", w: 900, h: 580 },
    { name: "蒸汽波", icon: "🎮", hint: "游戏平台商店：首页大图轮播（CSS 渐变假图）+ 折扣区 + 游戏卡片网格（8-10 个平行世界虚构游戏：emoji 封面、名字、标签、原价/折扣价、好评率）。卡片 hover 有动效，点击进入本地渲染的游戏详情页（购买按钮点了变已入库+toast）。全部静态+本地 JS。", w: 980, h: 640 },
    { name: "数字方阵", icon: "🔢", hint: "2048 游戏：canvas 或 DOM 网格实现，方向键/WASD 移动、合并、计分、游戏结束判定与重开按钮，有合并动画更佳。必须真的能玩。", w: 480, h: 620 },
    { name: "沙丘棋局", icon: "♟", hint: "五子棋：15x15 棋盘（canvas 或 grid），玩家执黑点击落子，AI 白子用简单启发式（优先堵活三/冲四）应答，胜负判定+再来一局。必须真的能玩。", w: 620, h: 680 },
    { name: "今日蜃楼", icon: "📰", hint: "资讯流应用：顶部频道 chips（推荐/AI/游戏/生活），信息流 12+ 条虚构新闻卡片（标题、来源（平行世界媒体名）、摘要、emoji 配图、评论数），下拉到底部自动加载更多（本地预置数据）。点击文章本地展开详情页。", w: 900, h: 620 },
    { name: "海市商店", icon: "🛍", hint: "电商应用：分类导航 + 商品网格（虚构商品：emoji 图、名字、销量、价格、满减角标），点击商品进本地详情页（轮播假图、规格选择、加入购物车会真加到角标数量），购物车抽屉可增删、显示总价。", w: 980, h: 640 },
    { name: "星穹电台", icon: "📻", hint: "音乐电台：左侧频道列表（华语幻星/电子沙暴/蜃楼爵士…），主区曲目列表（虚构歌名+歌手+时长），点击播放：用 WebAudio 简单合成一段循环旋律（振荡器+音阶序列即可，点击时创建 AudioContext），播放时有动态频谱或旋转唱片动画，暂停/继续/音量可用。", w: 860, h: 560 },
    { name: "拱猪计划", icon: "🐷", hint: "任务管理工具：今日待办清单（勾选划线+计数环）、四象限便签、右侧一个番茄钟（25 分钟倒计时真的会走，开始/暂停/重置，到点 toast 提醒）。预填有趣的平行世界任务。", w: 880, h: 560 },
    { name: "灵犀便签", icon: "🗒", hint: "便签墙：3-5 张彩色便签（contenteditable 可编辑，输入即存内存），可拖动换位（pointer 事件），新增/删除便签按钮可用，自动保存到页面内状态。", w: 700, h: 520 },
    { name: "幻影格斗", icon: "🥊", hint: "反应对战小游戏：canvas 上玩家（←→移动、空格攻击）对阵简单 AI 敌人（血条、攻击硬直、命中闪红），三局两胜，有开始/结束画面。必须真的能玩。", w: 760, h: 600 }
  ];
  var DEFAULT_WORLD = {
    theme: null, tagline: "信号失联，先落在一座安静的沙丘上",
    browser: DEFAULT_BROWSER, apps: DEFAULT_APPS.slice()
  };

  /* ============ 固定基础软件（系统的地板） ============
     常驻 Dock、开机即就位、先于今日热点应用；和其他应用一样由 AI 现场梦出，
     但规格写死——功能必须像真实系统软件一样完备可靠。 */
  var BASIC_APPS = [
    { name: "计算器", icon: "🧮", w: 300, h: 470, dock: true,
      hint: "「计算器」——系统基础软件，按真实软件的标准制作，仿 macOS 深色计算器：顶部大显示屏（右对齐、细字重、位数多时自动缩小），下方 4×5 键盘（功能键 AC/±/% 浅灰、数字键深灰、运算符列 ÷×−+= 橙色，0 占两格）。立即执行式四则运算（非表达式求值）：连续运算（2+3+4 先算 2+3）、±、%、小数点、除零显示「错误」、千分位逗号分组；待定的运算符按键保持高亮。键盘完整支持：数字、+ − * /、回车=、Esc=AC、退格删末位。全部本地 JS（data-k + 容器事件委托），绝不回传 AI。" },
    { name: "记事本", icon: "🗒", w: 860, h: 560, dock: true,
      hint: "「记事本」——系统基础软件，按真实软件的标准制作，仿 macOS 备忘录（浅色）：顶部工具栏（标题「记事本」+ 笔记数 + ➕ 新建 + 🗑 删除）；左侧 240px 笔记列表（选中项淡黄高亮，每项显示标题=正文首行、M月D日 HH:MM、摘要一行）；右侧编辑区（textarea 无边框，14px/1.7 行距）。数据真实持久化：读写 localStorage 键 mirage_notes_v1，结构 {notes:[{id,body,ts}],cur}，应用每次开机重新梦出但启动时先读出旧笔记；输入防抖 400ms 自动保存，被编辑的笔记浮到列表顶；删除两步确认（第一次点变红「确认删除？」，再点才删，禁用 confirm() 弹窗）。首次使用预置一条欢迎笔记，说明 MirageOS 一切皆梦、唯独这里的笔记跨开机留存。全部本地 JS。" },
    { name: "时钟", icon: "🕐", w: 660, h: 540, dock: true,
      hint: "「时钟」——系统基础软件，按真实软件的标准制作，仿 macOS 深色时钟：顶部三段 tab（世界时钟/秒表/计时器，点击切换）。世界时钟：6 张城市卡（北京/东京/新加坡/伦敦/纽约/旧金山），用 Intl.DateTimeFormat 的 timeZone 选项实时显示各城 HH:MM:SS 与「M月D日 周X」，每秒刷新，北京卡标注「本地」。秒表：大号 00:00.00（百分秒，performance.now() 计时），开始/暂停切换、计次（列表逐趟显示分隔+累计）、重置。计时器：SVG 圆环进度 + 中央 mm:ss，±1分/±10秒 调节（运行中禁用），归零响三声铃（WebAudio 振荡器，AudioContext 在点击「开始」时创建）并 mir.notify('⏰','计时器','时间到了！')。全部本地 JS。" }
  ];

  /* ============ 会话缓存（一次开机一份，重开即忘） ============ */
  function cacheSave() {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(state.cache)); } catch (e) {}
  }
  function cacheLoad() {
    try { state.cache = JSON.parse(sessionStorage.getItem(CACHE_KEY)) || {}; } catch (e) { state.cache = {}; }
    Object.keys(state.cache).forEach(function (k) {
      if (!state.cache[k] || state.cache[k].v !== CACHE_V) delete state.cache[k];
    });
  }
  function cacheKey(app) { return "mir::" + app; }

  /* ============ 主题 ============ */
  var THEME_VARS = {
    wallpaper: "--wp", accent: "--accent", menubarBg: "--mb-bg", menubarFg: "--mb-fg",
    dockBg: "--dock-bg", winBg: "--win-bg", tbarBg: "--tbar-bg", tbarFg: "--tbar-fg", font: "--font"
  };
  function validBg(v) {
    var el = document.createElement("div");
    el.style.background = "";
    el.style.background = v;
    return el.style.background !== "";
  }
  function maxLumOf(v) {
    var colors = String(v).match(/#[0-9a-f]{3,8}|rgba?\([^)]*\)/gi) || [];
    if (!colors.length) return 1;
    var maxL = 0;
    colors.forEach(function (c) {
      var r, g, b;
      if (c[0] === "#") {
        var h = c.slice(1);
        if (h.length === 3 || h.length === 4) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
        r = parseInt(h.slice(0,2),16); g = parseInt(h.slice(2,4),16); b = parseInt(h.slice(4,6),16);
      } else {
        var m = c.match(/[\d.]+/g) || [0,0,0];
        r = +m[0]; g = +m[1]; b = +m[2];
      }
      var l = (0.299*r + 0.587*g + 0.114*b) / 255;
      if (l > maxL) maxL = l;
    });
    return maxL;
  }
  function fallbackWallpaper(accent) {
    accent = accent || "#d98e3f";
    return "radial-gradient(1100px 750px at 75% 18%, color-mix(in srgb, " + accent + " 62%, #ffffff) 0%, transparent 60%)," +
           "radial-gradient(900px 700px at 18% 82%, color-mix(in srgb, " + accent + " 42%, #c9a06a) 0%, transparent 55%)," +
           "linear-gradient(160deg, color-mix(in srgb, " + accent + " 40%, #2a2118) 0%, color-mix(in srgb, " + accent + " 20%, #33302a) 50%, #1c2430 100%)";
  }
  function colorLum(c) {
    var r = 0, g = 0, b = 0, m;
    if (!c) return null;
    if (c[0] === "#") {
      var h = c.slice(1);
      if (h.length === 3 || h.length === 4) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      r = parseInt(h.slice(0,2),16); g = parseInt(h.slice(2,4),16); b = parseInt(h.slice(4,6),16);
    } else if ((m = String(c).match(/rgba?\(([^)]*)\)/))) {
      var p = m[1].split(",");
      r = +p[0]; g = +p[1]; b = +p[2];
    } else return null;
    return (0.299*r + 0.587*g + 0.114*b) / 255;
  }
  function applyTheme(t) {
    if (t && (!t.wallpaper || !validBg(t.wallpaper) || maxLumOf(t.wallpaper) < 0.16)) {
      t.wallpaper = fallbackWallpaper(t.accent);
    }
    if (t) {
      var lb = colorLum(t.menubarBg), lf = colorLum(t.menubarFg);
      if (lb !== null && lf !== null && Math.abs(lb - lf) < 0.3) { delete t.menubarBg; delete t.menubarFg; }
    }
    var r = document.documentElement.style;
    Object.keys(THEME_VARS).forEach(function (k) {
      if (t && typeof t[k] === "string" && t[k].length < 600) r.setProperty(THEME_VARS[k], t[k]);
      else r.removeProperty(THEME_VARS[k]);
    });
    state.theme = (t && t.accent) ? t : null;
  }

  /* ============ 模型请求桥（SSE 流式） ============ */
  function post(obj) {
    if (obj.control) { handleControl(obj); return; }
    var id = obj.id;
    fetch("/api/messages", {
      method: "POST",
      headers: Object.assign({ "content-type": "application/json" }, gateHeaders()),
      body: JSON.stringify({ system: SYSTEM_PROMPT, messages: obj.messages, max: obj.max })
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(("HTTP " + r.status + ": " + t).slice(0, 300)); });
      var reader = r.body.getReader(), dec = new TextDecoder(), buf = "", full = "", trunc = false;
      function step() {
        return reader.read().then(function (x) {
          if (x.done) { mirageDone(id, trunc); return; }
          buf += dec.decode(x.value, { stream: true });
          var lines = buf.split("\n");
          buf = lines.pop();
          for (var i = 0; i < lines.length; i++) {
            var ln = lines[i];
            if (ln.indexOf("data: ") !== 0) continue;
            var o = null;
            try { o = JSON.parse(ln.slice(6)); } catch (e) { continue; }
            if (o.type === "content_block_delta" && o.delta && o.delta.type === "text_delta" && typeof o.delta.text === "string") {
              full += o.delta.text;
              mirageChunk(id, o.delta.text);
            } else if (o.type === "content_block_delta" && o.delta && o.delta.type === "thinking_delta" && typeof o.delta.thinking === "string") {
              mirageThink(id, o.delta.thinking.length);
            } else if (o.type === "message_delta" && o.delta && o.delta.stop_reason === "max_tokens") {
              trunc = true;
            } else if (o.type === "error") {
              throw new Error((o.error && o.error.message) || "stream error");
            }
          }
          return step();
        });
      }
      return step();
    }).catch(function (e) { mirageFail(id, String(e && e.message || e)); });
  }

  function handleControl(obj) {
    switch (obj.control) {
      case "savecache":
        if (obj.app && obj.doc !== undefined) {
          state.cache[obj.app] = { doc: obj.doc, history: obj.history || [], v: CACHE_V };
          cacheSave();
        }
        break;
      case "delcache":
        delete state.cache[obj.app];
        cacheSave();
        break;
      case "quit":
        window.close();
        break;
    }
  }

  /* ============ 输出清洗 ============ */
  function strip(html) {
    var s = String(html);
    var f = s.match(/```(?:json|html)?\s*([\s\S]*?)```/);
    if (f) s = f[1];
    else s = s.replace(/^[\s\S]*?```(?:json|html)?\s*/i, function (m) {
      return m.length < 400 ? "" : m;
    }).replace(/```\s*$/, "");
    var i = s.search(/<!DOCTYPE|<html|<mir-patch|<head[\s>]|<body[\s>]|<style[\s>]|<div[\s>]|\{|\[/i);
    if (i > 0 && i < 400) s = s.slice(i);
    return s;
  }
  function stripDoc(html) {
    var s = strip(html);
    var i = s.search(/<!DOCTYPE|<html[\s>]|<mir-patch|<head[\s>]|<body[\s>]|<style[\s>]|<div[\s>]|<main[\s>]|<section[\s>]/i);
    if (i > 0) s = s.slice(i);
    return s;
  }
  function previewHtml(html) {
    var h = stripDoc(html);
    h = h.replace(/<!DOCTYPE[^>]*>/gi, "")
         .replace(/<\/?(html|head|body)[^>]*>/gi, "")
         .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "")
         .replace(/<meta[^>]*>/gi, "")
         .replace(/<script[\s\S]*?(<\/script>|$)/gi, "")
         .replace(/<[^>]*$/, "");
    var opens = (h.match(/<style/gi) || []).length;
    var closes = (h.match(/<\/style>/gi) || []).length;
    if (opens > closes) h += "</style>";
    return h;
  }
  function parsePatches(text) {
    var t = stripDoc(text).trim();
    if (!/^<mir-patch/i.test(t)) return null;
    var re = /<mir-patch\s+select="([^"]+)"\s*>([\s\S]*?)<\/mir-patch>/gi;
    var out = [], m;
    while ((m = re.exec(t))) out.push({ select: m[1], html: m[2] });
    return out.length ? out : null;
  }

  /* ============ 注入到每个应用的桥脚本 ============ */
  var BRIDGE =
    "<script>(function(){" +
    "function describe(el){var d={tag:el.tagName?el.tagName.toLowerCase():'?'};" +
    "if(el.id)d.id=el.id;" +
    "var t=(el.innerText||el.value||'').trim().slice(0,80);if(t)d.text=t;" +
    "['data-mir','data-mir-enter','placeholder','name','title','aria-label'].forEach(function(a){" +
    "var v=el.getAttribute&&el.getAttribute(a);if(v)d[a]=String(v).slice(0,160);});return d;}" +
    "function inputs(){var o=[];document.querySelectorAll('input,textarea,select,[contenteditable]').forEach(function(i){" +
    "var v=(i.type==='checkbox'||i.type==='radio')?(i.checked?'checked':''):(i.value!==undefined&&i.value!==''?i.value:(i.getAttribute&&i.getAttribute('contenteditable')!==null?i.innerText:''));" +
    "if(v)o.push({el:describe(i),value:String(v).slice(0,500)});});return o;}" +
    "window.__mirAct=0;function bump(){window.__mirAct=Date.now();}" +
    "function fire(action,target){bump();parent.postMessage({mir:'event',detail:{action:action,target:target,inputs:inputs()}},'*');}" +
    "document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-mir]');" +
    "if(!t)return;e.preventDefault();fire(t.getAttribute('data-mir'),describe(t));},true);" +
    "document.addEventListener('keydown',function(e){if(e.key!=='Enter')return;" +
    "var t=e.target.closest&&e.target.closest('[data-mir-enter]');if(!t)return;e.preventDefault();" +
    "fire(t.getAttribute('data-mir-enter'),describe(t));},true);" +
    "window.addEventListener('message',function(e){var d=e.data||{};" +
    "if(d.mir==='menu'){window.dispatchEvent(new CustomEvent('mir-menu',{detail:d.item}));}" +
    "if(d.mir==='patch'){(d.patches||[]).forEach(function(p){" +
    "var el=document.querySelector(p.select);if(el)el.innerHTML=p.html;});}" +
    "if(d.mir==='ai-result'){var q=_aiq[d.reqId];if(q){delete _aiq[d.reqId];" +
    "d.error?q.rej(new Error(d.error)):q.res(d.text);}}});" +
    "window.mir={event:function(a,data){bump();parent.postMessage({mir:'event',detail:{action:a,data:data===undefined?null:data,inputs:inputs()}},'*');}," +
    "open:function(app,hint){parent.postMessage({mir:'open',app:app,hint:hint||''},'*');}," +
    "install:function(app,icon,hint){parent.postMessage({mir:'install',app:app,icon:icon||'✨',hint:hint||''},'*');}};" +
    "var _aiq={},_ain=0;" +
    "window.mir.ai={ask:function(prompt){bump();return new Promise(function(res,rej){" +
    "var id='ai'+(_ain++);_aiq[id]={res:res,rej:rej};" +
    "parent.postMessage({mir:'ai',prompt:String(prompt).slice(0,4000),reqId:id},'*');});}};" +
    "window.mir.notify=function(title,body,icon){parent.postMessage({mir:'notify'," +
    "title:String(title||'').slice(0,80),body:String(body||'').slice(0,200),icon:String(icon||'🔔').slice(0,8)},'*');};" +
    "document.addEventListener('mousedown',function(){parent.postMessage({mir:'focus'},'*');},true);" +
    "window.addEventListener('error',function(e){parent.postMessage({mir:'jserror',message:String(e.message||'script error').slice(0,200)},'*');});" +
    "var _mut=0;new MutationObserver(function(){_mut=Date.now();})" +
    ".observe(document.documentElement,{subtree:true,childList:true,attributes:true,characterData:true});" +
    "document.addEventListener('click',function(e){" +
    "var a=e.target.closest&&e.target.closest('a[href]');if(a){var h=a.getAttribute('href');" +
    "if(h==='#'||/^https?:/i.test(h))e.preventDefault();}},true);" +
    "var _deadHit={};" +
    "document.addEventListener('click',function(e){" +
    "var t=e.target.closest&&e.target.closest(\"button,a,[role='button'],input[type='button'],input[type='submit'],.btn,[onclick]\");" +
    "if(!t)return;" +
    "if(t.closest('[data-mir],[data-mir-enter],[data-btn],[data-key],[data-action],[data-nav],[data-app]'))return;" +
    "var sig=(t.tagName||'')+'|'+(t.id||'')+'|'+(t.textContent||'').slice(0,24);" +
    "if(_deadHit[sig])return;" +
    "var before=Date.now()-1;var desc=describe(t);" +
    "setTimeout(function(){" +
    "if(_mut>before)return;if((window.__mirAct||0)>before)return;" +
    "_deadHit[sig]=1;" +
    "fire('死控件被点击：什么都没发生。实现这个控件的预期行为（优先补丁）并重新渲染出结果。',desc);" +
    "},650);},false);" +
    "var _AC=window.AudioContext||window.webkitAudioContext;" +
    "if(_AC){var _acs=[];var _P=function(){var c=new _AC();_acs.push(c);return c;};" +
    "_P.prototype=_AC.prototype;window.AudioContext=_P;window.webkitAudioContext=_P;" +
    "var _kick=function(){_acs.forEach(function(c){if(c.state==='suspended')c.resume();});};" +
    "document.addEventListener('click',_kick,true);document.addEventListener('keydown',_kick,true);}" +
    "})();<\/script>";

  function withBridge(html) {
    var doc = stripDoc(html);
    var world = "<script>window.__MIR_WORLD=" +
      JSON.stringify(worldDesc()).replace(/<\//g, "<\\/") + ";<\/script>";
    var pop = "<style>" + POP_STYLE + "</style>";
    var m = doc.match(/<body[^>]*>/i);
    if (m) doc = doc.replace(m[0], m[0] + pop + world + BRIDGE);
    else doc = pop + world + BRIDGE + doc;
    return doc;
  }

  function worldDesc() {
    var w = state.world;
    if (!w) return "一个尚未定型的平行世界";
    var names = w.apps.map(function (a) { return a.name; }).join("、");
    return (w.tagline || "") + "；桌面上已有应用：" + names + "；浏览器叫「" + (w.browser && w.browser.name || DEFAULT_BROWSER.name) + "」";
  }

  /* ============ 流式实时绘制：document.write 直灌 iframe ============
     生成期间的 iframe 就是画布：文本流到哪，解析器画到哪（按钮、标题逐个弹出）。
     <script> 被边流边拦截，收尾时统一"通电"注入，避免半成品脚本执行出错。 */
  var POP_STYLE = "@keyframes mirPop{from{opacity:0;transform:translateY(10px) scale(.97)}}*{animation:mirPop .5s cubic-bezier(.2,1.2,.4,1) backwards}";
  var POP_PROLOGUE = '<meta charset="utf-8"><style>' + POP_STYLE +
    "body{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;margin:0}</style>";
  function streamReset(w) {
    w.streamDoc = null;
    var old = w.iframe;
    var nf = document.createElement("iframe");
    nf.setAttribute("sandbox", "allow-scripts allow-same-origin");
    if (old.parentNode) old.parentNode.replaceChild(nf, old);
    w.iframe = nf;
  }
  function startStream(w) {
    streamReset(w);
    try {
      var d = w.iframe.contentDocument;
      d.open();
      d.write(POP_PROLOGUE); // 开场样式：解析器每创建一个元素，就弹一次
      w.streamDoc = d;
    } catch (e) { w.streamDoc = null; }
  }
  function streamFeed(p, delta) {
    var w = p.win;
    if (!w || !w.streamDoc) return;
    p.fbuf = (p.fbuf || "") + delta;
    var buf = p.fbuf, out = "";
    for (;;) {
      if (p.inScript) {
        var end = buf.indexOf("</script");
        if (end < 0) { // 还在脚本里：留住末尾 8 字符防半截闭合标签
          if (buf.length > 8) {
            p.scripts[p.scripts.length - 1] += buf.slice(0, buf.length - 8);
            buf = buf.slice(buf.length - 8);
          }
          break;
        }
        p.scripts[p.scripts.length - 1] += buf.slice(0, end);
        var gt = buf.indexOf(">", end);
        if (gt < 0) { buf = buf.slice(end); break; }
        buf = buf.slice(gt + 1);
        p.inScript = false;
        continue;
      }
      var s = buf.indexOf("<script");
      if (s < 0) { // 留住末尾可能是 "<scri" 开头的半截标签
        var hold = 0;
        for (var i = buf.length - 1; i >= 0 && buf.length - i <= 8; i--) {
          if (buf.charAt(i) === "<") { hold = buf.length - i; break; }
        }
        out += buf.slice(0, buf.length - hold);
        buf = buf.slice(buf.length - hold);
        break;
      }
      out += buf.slice(0, s);
      var gt2 = buf.indexOf(">", s);
      if (gt2 < 0) { buf = buf.slice(s); break; }
      buf = buf.slice(gt2 + 1);
      p.inScript = true;
      p.scripts.push("");
      continue;
    }
    p.fbuf = buf;
    if (!p.wrote) { // 跳过正文前的一切旁白/围栏
      var m = out.indexOf("<");
      if (m < 0) out = "";
      else { out = out.slice(m); p.wrote = true; }
    }
    if (out) { try { w.streamDoc.write(out); } catch (e) { w.streamDoc = null; } }
  }
  function injectScript(d, code) {
    var s = d.createElement("script");
    s.textContent = String(code).replace(/^\s*<script[^>]*>/i, "").replace(/<\/script>\s*$/i, "");
    d.body.appendChild(s);
  }
  function finishStream(p) { // 收尾：关流 + 通电（桥 + 被拦截的脚本按原顺序执行）
    var w = p.win;
    if (!w || !w.streamDoc) return;
    var d = w.streamDoc;
    if (p.fbuf && !p.inScript) { try { d.write(p.fbuf); } catch (e) {} }
    p.fbuf = "";
    try { d.close(); } catch (e) {}
    try {
      injectScript(d, BRIDGE);
      (p.scripts || []).forEach(function (s) { if (s && s.trim()) injectScript(d, s); });
    } catch (e) {}
    w.streamDoc = null;
  }

  /* ============ 应用生命周期 ============ */
  function findSpec(name) {
    var all = sysApps().concat((state.world && state.world.apps) || [], state.installed);
    for (var i = 0; i < all.length; i++) if (all[i].name === name) return all[i];
    return null;
  }
  function createMsg(app, hint) {
    return {
      role: "user",
      content: JSON.stringify({
        task: "create-app", app: app, hint: hint || "",
        world: worldDesc(),
        theme: state.theme ? { accent: state.theme.accent, dark: !!(state.theme && state.theme.dark) } : null,
        time: new Date().toString()
      })
    };
  }
  function findGen(app) {
    var ids = Object.keys(state.gen);
    for (var i = 0; i < ids.length; i++) if (state.gen[ids[i]].app === app) return state.gen[ids[i]];
    return null;
  }
  function startCreate(w) {
    var p = findGen(w.app);
    if (!p) {
      p = { id: "g" + (state.nextId++), app: w.app, ck: cacheKey(w.app), buf: "", win: null, raf: null,
            fbuf: "", inScript: false, wrote: false, scripts: [],
            history: [createMsg(w.app, w.hint)] };
      state.gen[p.id] = p;
      post({ id: p.id, messages: p.history, max: 14000 });
    }
    p.win = w;
    w.el.classList.add("generating");
    startStream(w);
    if (p.buf) { // 挂到进行中的生成：已收内容做无脚本快照灌入（罕见路径）
      var snap = p.buf.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<script[\s\S]*$/i, "");
      var sm = snap.indexOf("<");
      if (sm > 0) snap = snap.slice(sm);
      try { if (w.streamDoc) w.streamDoc.write(snap); } catch (e) {}
    }
  }
  function openApp(app, icon, hint, force) {
    var spec0 = findSpec(app);
    if (spec0 && spec0.native === "appstore") { openAppstore(force); return; } // 原生应用走自己的路
    var existing = Object.values(state.wins).find(function (w) { return w.app === app; });
    if (existing) {
      if (force) { existing.hint = hint || existing.hint; regen(existing); }
      else if (existing.el.classList.contains("mini")) restore(existing);
      else bringFront(existing);
      return;
    }
    var spec = findSpec(app) || {};
    var w = createWindow(app, icon || spec.icon || "✨", { w: spec.w, h: spec.h });
    w.hint = hint || spec.hint || "";
    if (force) {
      delete state.cache[cacheKey(app)];
      var p0 = findGen(app);
      if (p0) { p0.win = null; delete state.gen[p0.id]; }
    }
    var cached = state.cache[cacheKey(app)];
    if (cached) {
      w.history = (cached.history || []).slice();
      w.iframe.srcdoc = withBridge(cached.doc);
      return;
    }
    startCreate(w);
  }
  function updateApp(w, detail) {
    if (w.native) return; // 原生窗口不走 AI 更新回路
    if (w.el.classList.contains("generating") || w.el.classList.contains("updating")) return;
    if (w.history.length && w.history[w.history.length - 1].role === "user") w.history.pop();
    detail.time = new Date().toString();
    w.history.push({ role: "user", content: JSON.stringify({ task: "update-app", world: worldDesc(), event: detail }) });
    trimHistory(w);
    w.el.classList.add("updating");
    sendGen(w);
  }
  function regen(w) {
    if (w.native === "appstore") { storeRedream(); return; } // 重梦 = 重新上架一批商品
    delete state.cache[cacheKey(w.app)];
    var p = findGen(w.app);
    if (p) { p.win = null; delete state.gen[p.id]; }
    w.history = [];
    streamReset(w);
    w.el.classList.remove("updating", "failed", "glitched");
    startCreate(w);
  }
  function sendGen(w) {
    w.buf = "";
    post({ id: w.id, messages: w.history, max: 6000 });
  }
  function trimHistory(w) {
    if (w.history.length > 6) w.history = w.history.slice(0, 2).concat(w.history.slice(-4));
  }
  function mount(w, html) {
    var raw = stripDoc(html);
    w.iframe.srcdoc = withBridge(raw);
    state.cache[cacheKey(w.app)] = { doc: raw, history: w.history.slice(), v: CACHE_V };
    cacheSave();
  }

  /* ============ 生成结果回调（对应 wibeos 的 wibeos.*） ============ */
  function mirageThink(id, n) { // GLM 的思考阶段可视化：让等待本身成为仪式
    var p = state.gen[id] || state.wins[id];
    if (p && p.kind === "store") { storeThink(p, n); return; }
    if (!p || !p.win) return;
    p.think = (p.think || 0) + n;
    var pill = p.win.el.querySelector(".genpill");
    if (pill && !p.textStarted) pill.textContent = "梦的思绪 " + p.think + " 字…";
  }

  function mirageChunk(id, t) {
    var p = state.gen[id];
    if (p) {
      if (p.kind === "desktop") { desktopChunk(p, t); return; }
      if (p.kind === "store") { storeChunk(p, t); return; }
      if (!p.textStarted && p.win) {
        p.textStarted = true;
      }
      p.buf += t;
      streamFeed(p, t);
      if (p.win && p.buf.length) { // 生成进度实时可见：组件数 + 字数
        var pill1 = p.win.el.querySelector(".genpill");
        if (pill1) {
          var vis = 0;
          try { var bd = p.win.iframe.contentDocument && p.win.iframe.contentDocument.body; if (bd) vis = bd.querySelectorAll("*:not(style):not(script)").length; } catch (e) {}
          pill1.textContent = "正在梦见 · " + vis + " 个组件 · " + (p.buf.length > 999 ? (p.buf.length / 1000).toFixed(1) + "k" : p.buf.length) + " 字";
        }
      }
      return;
    }
    var w = state.wins[id];
    if (w) w.buf += t;
  }

  function mirageDone(id, trunc) {
    var p = state.gen[id];
    if (p && p.kind === "desktop") { desktopFinish(p, trunc); return; }
    if (p && p.kind === "store") { delete state.gen[id]; storeEnd(p, trunc, null); return; }
    if (p && p.kind === "ai") {
      delete state.gen[id];
      var wv = state.wins[p.winId];
      if (wv && wv.iframe.contentWindow) {
        wv.iframe.contentWindow.postMessage({ mir: "ai-result", reqId: p.reqId, text: strip(p.buf).trim() }, "*");
      }
      return;
    }
    if (p) {
      if (trunc && !p.truncRetry) {
        p.truncRetry = true;
        p.buf = "";
        p.fbuf = ""; p.inScript = false; p.wrote = false; p.scripts = [];
        if (p.win) startStream(p.win);
        post({ id: p.id, messages: p.history, max: 16000 });
        return;
      }
      delete state.gen[id];
      if (trunc) { // 二次截断：绝不挂载/缓存半成品
        if (p.win && state.wins[p.win.id]) {
          p.win.el.classList.remove("generating");
          p.win.el.classList.add("failed");
          p.win.errMsgEl.textContent = "这个应用一口气梦不完——再试一次吧";
        }
        return;
      }
      var raw = stripDoc(p.buf);
      p.history.push({ role: "assistant", content: raw });
      state.cache[p.ck] = { doc: raw, history: p.history.slice(), v: CACHE_V };
      cacheSave();
      if (p.win && state.wins[p.win.id]) {
        p.win.history = p.history.slice();
        if (p.win.streamDoc) finishStream(p);        // 页面早已成形，此刻只是通电
        else p.win.iframe.srcdoc = withBridge(raw);  // 流式不可用时的兜底
        p.win.el.classList.remove("generating", "failed");
      }
      return;
    }
    var w = state.wins[id];
    if (!w) return;
    if (trunc && !w.truncRetry) {
      w.truncRetry = true;
      w.buf = "";
      post({ id: w.id, messages: w.history, max: 12000 });
      return;
    }
    if (trunc) {
      w.truncRetry = false;
      if (w.history.length && w.history[w.history.length - 1].role === "user") w.history.pop();
      w.buf = "";
      w.el.classList.remove("updating", "failed");
      return;
    }
    w.truncRetry = false;
    var cleaned = stripDoc(w.buf);
    var patches = parsePatches(cleaned);
    var isDoc = /^\s*(<!DOCTYPE|<html[\s>]|<head[\s>]|<body[\s>]|<style[\s>]|<div[\s>]|<main[\s>]|<section[\s>])/i.test(cleaned);
    if (patches) {
      w.history.push({ role: "assistant", content: cleaned });
      trimHistory(w);
      w.iframe.contentWindow.postMessage({ mir: "patch", patches: patches }, "*");
    } else if (isDoc) {
      w.history.push({ role: "assistant", content: cleaned });
      trimHistory(w);
      mount(w, w.buf);
    } else {
      if (w.history.length && w.history[w.history.length - 1].role === "user") w.history.pop();
    }
    w.buf = "";
    w.el.classList.remove("updating", "failed");
  }

  function mirageFail(id, msg) {
    var p = state.gen[id];
    if (p && p.kind === "desktop") { desktopFinish(p, false, msg); return; }
    if (p && p.kind === "store") { delete state.gen[id]; storeEnd(p, false, String(msg)); return; }
    if (p && p.kind === "ai") {
      delete state.gen[id];
      var wv = state.wins[p.winId];
      if (wv && wv.iframe.contentWindow) {
        wv.iframe.contentWindow.postMessage({ mir: "ai-result", reqId: p.reqId, error: String(msg).slice(0, 200) }, "*");
      }
      return;
    }
    if (p) {
      delete state.gen[id];
      if (p.win && state.wins[p.win.id]) {
        if (p.win.streamDoc) { try { p.win.streamDoc.close(); } catch (e) {} p.win.streamDoc = null; }
        p.win.el.classList.remove("generating");
        p.win.el.classList.add("failed");
        p.win.errMsgEl.textContent = msg;
      }
      return;
    }
    var w = state.wins[id];
    if (!w) return;
    w.el.classList.remove("updating");
    w.el.classList.add("failed");
    w.errMsgEl.textContent = msg;
    w.buf = "";
  }

  /* ============ 窗口管理 ============ */
  var winsEl = document.getElementById("windows");
  function createWindow(app, icon, opts) {
    opts = opts || {};
    var id = "w" + (state.nextId++);
    var el = document.createElement("div");
    el.className = "win";
    var W = opts.w || 760, H = opts.h || 500;
    var off = (state.nextId % 7) * 26;
    el.style.width = W + "px";
    el.style.height = H + "px";
    el.style.left = Math.max(8, Math.min(window.innerWidth - W - 8, 130 + off)) + "px";
    el.style.top = Math.max(34, Math.min(window.innerHeight - H - 80, 70 + off)) + "px";
    var bodyHtml = opts.native
      ? '<div class="nbody"></div>'
      : '<div class="wbody">' +
          '<iframe sandbox="allow-scripts allow-same-origin"></iframe>' +
          '<div class="genpill">正在梦见 ' + esc(app) + '…</div>' +
          '<div class="glitch">' + svg("alert", 12, 2) + '幻象 · 重梦</div>' +
          '<div class="veil"><div class="vsp">想象中…</div></div>' +
          '<div class="werr">' + svg("alert", 30, 1.5) + '<div class="wt">梦被打断了</div>' +
            '<div class="werrmsg"></div>' +
            '<button data-act="retry">再试一次</button></div>' +
        '</div>';
    el.innerHTML =
      '<div class="tbar">' +
        '<div class="lights">' +
          '<span class="lt red" data-act="close"></span>' +
          '<span class="lt yel" data-act="min"></span>' +
          '<span class="lt grn" data-act="zoom"></span>' +
        '</div>' +
        '<div class="ttitle">' + esc(icon) + " " + esc(app) + '</div>' +
      '</div>' +
      bodyHtml +
      '<div class="rsz"></div>';
    winsEl.appendChild(el);
    var w = {
      id: id, app: app, icon: icon, el: el,
      iframe: opts.native ? null : el.querySelector("iframe"),
      nbody: opts.native ? el.querySelector(".nbody") : null,
      native: opts.native || null,
      streamDoc: null,
      errMsgEl: el.querySelector(".werrmsg"),
      history: [], buf: "", raf: null, zoomed: null
    };
    state.wins[id] = w;
    el.addEventListener("mousedown", function () { bringFront(w); }, true);
    el.querySelector(".tbar").addEventListener("mousedown", function (e) {
      if (e.target.classList.contains("lt")) return;
      startDrag(w, e, "move");
    });
    el.querySelector(".rsz").addEventListener("mousedown", function (e) { startDrag(w, e, "size"); });
    el.querySelectorAll(".lt").forEach(function (lt) {
      lt.addEventListener("click", function (e) {
        e.stopPropagation();
        var act = lt.getAttribute("data-act");
        if (act === "close") closeWin(w);
        if (act === "min") minimize(w);
        if (act === "zoom") zoom(w);
      });
    });
    if (!opts.native) {
      el.querySelector(".glitch").addEventListener("click", function (e) {
        e.stopPropagation();
        regen(w);
      });
      el.querySelector('[data-act="retry"]').addEventListener("click", function () {
        el.classList.remove("failed");
        if (w.history.length && w.history[w.history.length - 1].role === "user") {
          el.classList.add("updating");
          sendGen(w);
        } else {
          startCreate(w);
        }
      });
    }
    bringFront(w);
    refreshDock();
    return w;
  }
  function bringFront(w) {
    if (state.frontId === w.id) return;
    state.frontId = w.id;
    w.el.style.zIndex = ++state.z;
    Object.values(state.wins).forEach(function (x) {
      x.el.classList.toggle("front", x.id === w.id);
    });
    $("mAppName").textContent = w.app;
  }
  function closeWin(w) {
    var p = findGen(w.app);
    if (p && p.win === w) p.win = null;
    delete state.wins[w.id];
    w.el.remove();
    if (state.frontId === w.id) {
      state.frontId = null;
      var rest = Object.values(state.wins).filter(function (x) { return !x.el.classList.contains("mini"); });
      if (rest.length) bringFront(rest[rest.length - 1]);
      else $("mAppName").textContent = "访达";
    }
    refreshDock();
  }
  function minimize(w) {
    w.el.classList.add("mini");
    if (state.frontId === w.id) state.frontId = null;
    refreshDock();
  }
  function restore(w) {
    w.el.classList.remove("mini");
    bringFront(w);
  }
  function zoom(w) {
    if (w.zoomed) {
      w.el.style.left = w.zoomed.l; w.el.style.top = w.zoomed.t;
      w.el.style.width = w.zoomed.w; w.el.style.height = w.zoomed.h;
      w.zoomed = null;
    } else {
      w.zoomed = { l: w.el.style.left, t: w.el.style.top, w: w.el.style.width, h: w.el.style.height };
      w.el.style.left = "6px"; w.el.style.top = "32px";
      w.el.style.width = (window.innerWidth - 12) + "px";
      w.el.style.height = (window.innerHeight - 110) + "px";
    }
  }
  function startDrag(w, e, mode) {
    e.preventDefault();
    bringFront(w);
    document.body.classList.add("dragging");
    var sx = e.clientX, sy = e.clientY;
    var r = w.el.getBoundingClientRect();
    function mm(ev) {
      var dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (mode === "move") {
        w.el.style.left = Math.max(-r.width + 80, r.left + dx) + "px";
        w.el.style.top = Math.max(27, r.top + dy) + "px";
      } else {
        w.el.style.width = Math.max(260, r.width + dx) + "px";
        w.el.style.height = Math.max(160, r.height + dy) + "px";
      }
    }
    function mu() {
      document.body.classList.remove("dragging");
      document.removeEventListener("mousemove", mm);
      document.removeEventListener("mouseup", mu);
    }
    document.addEventListener("mousemove", mm);
    document.addEventListener("mouseup", mu);
  }

  /* ============ 调度中心 ============ */
  var mcOpen = false, mcSaved = [];
  function missionControl(force) {
    if (mcOpen && force !== true) { missionControlClose(); return; }
    if (mcOpen) return;
    var ws = Object.values(state.wins);
    var grid = $("mcGrid");
    grid.innerHTML = "";
    if (!ws.length) {
      grid.innerHTML = '<div id="mcEmpty">' + svg("frames", 34, 1.4) +
        '<div>没有打开的窗口——双击桌面图标试试。</div></div>';
    }
    var n = ws.length || 1;
    var cols = Math.ceil(Math.sqrt(n));
    var availW = Math.max(320, window.innerWidth - 112);
    var tileW = Math.min(420, (availW - (cols - 1) * 30) / cols);
    mcSaved = [];
    ws.forEach(function (w) {
      var rect = w.el.getBoundingClientRect();
      var winW = rect.width || parseInt(w.el.style.width) || 760;
      var winH = rect.height || parseInt(w.el.style.height) || 500;
      var scale = tileW / winW;
      var tile = document.createElement("div");
      tile.className = "mcTile";
      tile.style.width = tileW + "px";
      tile.style.height = (winH * scale) + "px";
      mcSaved.push({ w: w, cssText: w.el.style.cssText, mini: w.el.classList.contains("mini") });
      w.el.classList.remove("mini");
      w.el.style.cssText = "position:absolute;left:0;top:0;margin:0;" +
        "width:" + winW + "px;height:" + winH + "px;" +
        "transform:scale(" + scale + ");transform-origin:top left;" +
        "pointer-events:none;box-shadow:none;";
      var holder = document.createElement("div");
      holder.style.cssText = "position:absolute;inset:0;overflow:hidden;border-radius:10px;";
      holder.appendChild(w.el);
      tile.appendChild(holder);
      var cap = document.createElement("div");
      cap.className = "mcCap";
      cap.textContent = w.icon + "  " + w.app;
      tile.appendChild(cap);
      tile.addEventListener("click", function (e) {
        e.stopPropagation();
        missionControlClose(w);
      });
      grid.appendChild(tile);
    });
    $("mctrl").classList.add("show");
    mcOpen = true;
  }
  function missionControlClose(focusWin) {
    if (!mcOpen) return;
    mcSaved.forEach(function (s) {
      s.w.el.style.cssText = s.cssText;
      if (s.mini && (!focusWin || focusWin.id !== s.w.id)) s.w.el.classList.add("mini");
      winsEl.appendChild(s.w.el);
    });
    mcSaved = [];
    $("mctrl").classList.remove("show");
    $("mcGrid").innerHTML = "";
    mcOpen = false;
    if (focusWin && state.wins[focusWin.id]) restore(focusWin);
  }
  $("mctrl").addEventListener("click", function () { missionControlClose(); });

  /* ============ 桌面图标（今日热点应用，逐个落入） ============ */
  var ICON_COL_W = 104, ICON_ROW_H = 118; // 行高必须 ≥ 图标 74 + 标签两行，否则文字会压到下一枚图标
  function layoutDesktopIcons() { // 右缘逐列排布：每列自上而下，列满向左另起；顶部避开时钟控件，底部避开 Dock
    var icons = $("dicons").children;
    if (!icons.length) return;
    var startY = 170;
    var dwb = $("dwidget").getBoundingClientRect();
    if (dwb.bottom) startY = Math.max(startY, Math.ceil(dwb.bottom) + 24);
    var endY = window.innerHeight - 150;
    var rows = Math.max(1, Math.floor((endY - startY) / ICON_ROW_H));
    for (var i = 0; i < icons.length; i++) {
      var col = Math.floor(i / rows), row = i % rows;
      icons[i].style.left = Math.max(4, window.innerWidth - 124 - ICON_COL_W * col) + "px";
      icons[i].style.top = (startY + row * ICON_ROW_H) + "px";
    }
  }
  function addDesktopIcon(a) {
    var c = $("dicons");
    var d = document.createElement("div");
    d.className = "dskicon pop";
    d.style.animationDelay = "0.04s";
    d.style.setProperty("--hue", hueOf(a.name));
    d.title = a.name + (a.hint ? "：" + a.hint : "");
    d.innerHTML = '<div class="em">' + esc(a.icon || "✨") + '</div><div class="nm">' + esc(a.name) + "</div>";
    d.addEventListener("dblclick", function () { openApp(a.name, a.icon, a.hint); });
    d.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      e.stopPropagation();
      iconMenu(e, a);
    });
    c.appendChild(d);
    layoutDesktopIcons();
    return d;
  }
  window.addEventListener("resize", layoutDesktopIcons);
  if (window.ResizeObserver) new ResizeObserver(layoutDesktopIcons).observe(document.documentElement); // 兜住不派发 resize 的尺寸变化（如后台 0 尺寸标签页被展开）
  function renderDesktopIcons() {
    $("dicons").innerHTML = "";
    if (!state.world) return;
    state.world.apps.slice(0, 10).forEach(function (a, i) {
      var d = addDesktopIcon(a);
      d.style.animationDelay = (i * 0.09) + "s";
    });
  }
  function iconMenu(e, a) {
    var dd = $("dropdown");
    dd.innerHTML = "";
    [
      { l: "打开", f: function () { openApp(a.name, a.icon, a.hint); } },
      { sep: 1 },
      { l: "重梦「" + a.name + "」", f: function () { openApp(a.name, a.icon, a.hint, true); } }
    ].forEach(function (it) {
      if (it.sep) {
        var s = document.createElement("div"); s.className = "dsep"; dd.appendChild(s);
        return;
      }
      var d = document.createElement("div");
      d.className = "ditem";
      d.innerHTML = "<span>" + esc(it.l) + "</span>";
      d.addEventListener("click", function (ev) { ev.stopPropagation(); dd.hidden = true; it.f(); });
      dd.appendChild(d);
    });
    dd.style.left = Math.min(window.innerWidth - 220, e.clientX) + "px";
    dd.style.top = e.clientY + "px";
    dd.hidden = false;
  }

  /* ============ 系统应用（Dock 固定四席） ============ */
  function sysApps() {
    var w = state.world;
    var bname = (w && w.browser && w.browser.name) || DEFAULT_BROWSER.name;
    var bicon = (w && w.browser && w.browser.icon) || DEFAULT_BROWSER.icon;
    var sigList = state.signals.map(function (s) { return s.repo + "（" + (s.desc || "无描述") + "）"; }).join("；");
    var appNames = (w ? w.apps : []).map(function (a) { return a.name + " " + a.icon; }).join("、");
    return BASIC_APPS.concat([
      { name: bname, icon: bicon, w: 1000, h: 660, dock: true,
        hint: "「" + bname + "」——MirageOS 的网页浏览器（贴合今日世界的主题色与气质，" + bicon + " 徽标）。结构至关重要：固定工具栏（后退/前进按钮、地址栏），下方一个撑满剩余空间的 <div id=\"page\"> 容器承载当前页面；浏览器外壳永不重绘。地址栏：data-mir-enter=\"navigate: 用户在地址栏输入了内容。只返回一个 <mir-patch select='#page'>，内含该网址被梦出的完整页面\"。#page 内起始页：平行世界虚构站点的收藏夹网格（绝不真实品牌），每个磁贴 data-mir=\"navigate: patch #page 为该站点\"。页面里所有链接同样带 data-mir navigate 属性。所有导航响应必须且只能是一个 <mir-patch select=\\\"#page\\\">——绝不返回完整文档。页面要丰富可信：真实感文案、站点导航、用 CSS 渐变画的\"图片\"。默认搜索引擎叫「鹦鹉」。" },
      { name: "今日访达", icon: "🗂", w: 880, h: 560, dock: true,
        hint: "「今日访达」：展示今天这个平行世界的档案。顶部：开机标语（大字）+ 今日日期 + 主题色色块。中部两栏：左栏「信号来源」列出这些真实趋势信号：" + (sigList || "（今天信号失联，桌面纯靠想象）") + "；右栏「由此生成的应用」列出：" + (appNames || "（尚未生成）") + "，每项带一句话说明。底部一行小字：\"以上内容由 AI 根据真实趋势信号即时虚构，每次开机都会重来\"。静态 HTML + 本地 JS，像精致的 macOS 访达（侧栏+图标列表）。" },
      { name: "应用集市", icon: "🛍", w: 980, h: 640, dock: true, native: "appstore" }
    ]);
  }

  /* ============ 应用集市（固定 UI 框架的原生系统应用） ============
     与其他一切应用不同：外壳由本地代码绘制（不进 iframe、不经 AI 之手）——
     侧栏分类、今日主打横幅、商品卡片、搜索、获取按钮全是确定性本地 JS。
     货架上每一款商品由 AI 依今日世界上架：create-store JSON Lines 流式弹卡。
     开机完成后静默预取，用户点开时大概率已上架完毕。 */
  var STORE_CATS = ["游戏", "工具", "社交", "创作", "资讯", "生活"];
  var STORE_NAV = [
    { tab: "发现", ic: "spark" }, { tab: "游戏", ic: "game" }, { tab: "工具", ic: "sliders" },
    { tab: "社交", ic: "chat" }, { tab: "创作", ic: "pen" }, { tab: "资讯", ic: "news" },
    { tab: "生活", ic: "sun" }, { sep: 1 }, { tab: "已获取", ic: "dl" }
  ];
  function storeWin() {
    return Object.values(state.wins).find(function (w) { return w.native === "appstore"; }) || null;
  }
  function storeOccupied() {
    return sysApps().concat((state.world && state.world.apps) || [], state.installed, state.store.items)
      .map(function (a) { return a.name; }).join("、");
  }
  function fixStoreLine(o) {
    if (!o || typeof o.name !== "string" || !o.name.trim()) return null;
    var r = Math.max(3.5, Math.min(5, +o.rating || 4.2));
    return {
      name: o.name.trim().slice(0, 12),
      icon: String(o.icon || "✨").slice(0, 4),
      tagline: String(o.tagline || "").slice(0, 22),
      category: STORE_CATS.indexOf(o.category) >= 0 ? o.category : "工具",
      rating: Math.round(r * 10) / 10,
      price: /^¥\d+/.test(String(o.price)) ? String(o.price).slice(0, 8) : "免费",
      hint: String(o.hint || "").slice(0, 400)
    };
  }
  function storeStart(mode, query) {
    var st = state.store;
    var msg = { role: "user", content: JSON.stringify({
      task: "create-store", mode: mode, query: query || "",
      world: worldDesc(), occupied: storeOccupied(), time: new Date().toString()
    }) };
    var p = { id: "g" + (state.nextId++), kind: "store", mode: mode, reqQ: String(query || ""),
              buf: "", think: 0, tries: 0, history: [msg] };
    state.gen[p.id] = p;
    post({ id: p.id, messages: p.history, max: mode === "search" ? 3200 : 5200 });
    if (mode === "search") { st.results = []; st.resq = p.reqQ; st.serr = ""; st.sbusy = true; }
    else { st.items = []; st.err = ""; st.busy = true; }
    storeRender();
  }
  function storeEnsure() {
    var st = state.store;
    if (st.busy || st.items.length) return;
    storeStart("catalog");
  }
  function storeRedream() {
    var st = state.store;
    if (st.busy) return;
    st.results = null; st.resq = ""; st.serr = "";
    var w = storeWin();
    if (w && w.asEls) w.asEls.search.value = "";
    storeStart("catalog");
  }
  function storeLine(p, ln) {
    var o = null;
    try { o = JSON.parse(ln); } catch (e) { return; }
    if (!o || o.type !== "app") return;
    var st = state.store;
    if (p.mode === "search" && p.reqQ !== st.resq) return; // 已被更新的搜索取代：丢弃
    var a = fixStoreLine(o);
    if (!a) return;
    var arr = p.mode === "search" ? st.results : st.items;
    if (!arr) return;
    var taken = sysApps().concat((state.world && state.world.apps) || [], state.installed, arr);
    for (var i = 0; i < taken.length; i++) if (taken[i].name === a.name) return;
    arr.push(a);
  }
  function storeChunk(p, t) {
    p.buf += t;
    var lines = p.buf.split("\n");
    p.buf = lines.pop(); // 末尾留半行
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i].replace(/\r$/, "").replace(/^\s*```(?:json)?\s*/, "").replace(/```\s*$/, "").trim();
      if (!ln || ln.charAt(0) !== "{") continue; // 无视旁白噪音
      storeLine(p, ln);
    }
    storeRender();
  }
  function storeThink(p, n) {
    p.think += n;
    var st = state.store;
    var idle = p.mode === "catalog" ? !st.items.length : (st.results && !st.results.length);
    if (!idle) return;
    var w = storeWin();
    if (w && w.asEls) {
      w.asEls.status.hidden = false;
      w.asEls.status.textContent = "梦的思绪 " + p.think + " 字…";
    }
  }
  function storeEnd(p, trunc, errMsg) {
    var st = state.store;
    if (p.buf && !errMsg) { // 冲刷末尾半行
      var ln = p.buf.trim();
      if (ln.charAt(0) === "{") storeLine(p, ln);
      p.buf = "";
    }
    if (p.mode === "search") {
      if (p.reqQ !== st.resq) return;
      st.sbusy = false;
      if (errMsg && st.results && !st.results.length) st.serr = errMsg;
      storeRender();
      return;
    }
    st.busy = false;
    var n = st.items.length;
    if ((errMsg || n === 0 || (trunc && n < 6)) && p.tries < 1) {
      p.tries++; p.buf = ""; p.think = 0;
      st.items = []; st.busy = true;
      state.gen[p.id] = p;
      post({ id: p.id, messages: p.history, max: 7000 });
      storeRender();
      return;
    }
    if (n === 0) st.err = errMsg || "今天的商品没能梦出来";
    storeRender();
  }

  /* ---- 集市 UI（固定骨架，只填数据） ---- */
  function storeCard(a, i) {
    var d = document.createElement("div");
    d.className = "as-card";
    d.style.setProperty("--hue", hueOf(a.name));
    d.style.animationDelay = Math.min(i * 0.03, 0.36) + "s";
    d.title = a.hint || a.name;
    var has = state.installed.some(function (x) { return x.name === a.name; });
    var meta = [];
    if (a.rating) meta.push("★ " + a.rating);
    if (a.category) meta.push(a.category);
    if (a.price) meta.push(a.price);
    d.innerHTML =
      '<div class="as-ic">' + esc(a.icon) + '</div>' +
      '<div class="as-mid"><div class="as-name">' + esc(a.name) + "</div>" +
      (a.tagline ? '<div class="as-tag">' + esc(a.tagline) + "</div>" : "") +
      '<div class="as-meta">' + esc(meta.join(" · ") || "已获取") + "</div></div>" +
      '<button class="as-get' + (has ? " open" : "") + '">' + (has ? "打开" : "获取") + "</button>";
    d.addEventListener("click", function () { openApp(a.name, a.icon, a.hint); });
    d.querySelector(".as-get").addEventListener("click", function (e) {
      e.stopPropagation();
      if (state.installed.some(function (x) { return x.name === a.name; })) { openApp(a.name, a.icon, a.hint); return; }
      state.installed.push({ name: a.name, icon: a.icon, hint: a.hint });
      refreshDock();
      toast(a.icon, "已安装「" + a.name + "」", "新应用已加入 Dock。", null);
      storeRender();
    });
    return d;
  }
  function storeRender() {
    var w = storeWin();
    if (!w || !w.asEls) return;
    var st = state.store, E = w.asEls;
    var searching = !!st.results;
    E.nav.querySelectorAll(".as-ni").forEach(function (n) {
      n.classList.toggle("on", !searching && n.getAttribute("data-tab") === st.tab);
    });
    E.back.hidden = !searching;
    E.banner.hidden = true;
    if (searching) E.title.textContent = "搜索「" + st.resq + "」";
    else if (st.tab === "已获取") E.title.textContent = "已获取";
    else if (st.tab !== "发现") E.title.textContent = st.tab;
    else {
      E.title.textContent = "今日上架";
      var feat = st.items[0]; // 第 1 款 = 今日主打
      if (feat) {
        E.banner.hidden = false;
        E.banner.style.setProperty("--hue", hueOf(feat.name));
        E.bIc.textContent = feat.icon;
        E.bName.textContent = feat.name;
        E.bTag.textContent = feat.tagline || (feat.hint || "").slice(0, 24);
        E.banner.onclick = function () { openApp(feat.name, feat.icon, feat.hint); };
      }
    }
    var list = searching ? st.results
      : st.tab === "已获取" ? state.installed.slice()
      : st.tab === "发现" ? st.items
      : st.items.filter(function (a) { return a.category === st.tab; });
    E.count.textContent = list.length ? list.length + " 款" : "";
    E.list.innerHTML = "";
    list.forEach(function (a, i) { E.list.appendChild(storeCard(a, i)); });
    E.skel.hidden = !(st.busy && !st.items.length && !searching);
    var stat = "";
    if (st.busy) stat = st.items.length ? "还在上架 · 已到 " + st.items.length + " 款" : "正在梦见今日商品…";
    else if (st.sbusy && searching) stat = "正在为「" + st.resq + "」现编 · 已到 " + st.results.length + " 款";
    E.status.textContent = stat;
    E.status.hidden = !stat;
    E.shuffle.classList.toggle("dim", st.busy);
    E.empty.hidden = !!(list.length || st.busy || (st.sbusy && searching));
    if (!E.empty.hidden) {
      E.empty.textContent = searching
        ? (st.serr ? "这一趟没梦到：" + st.serr + "——换个词再试" : "没梦到相关商品——换个词再试试")
        : st.tab === "已获取" ? "还没有获取过应用，去「发现」逛逛。" : "这一类今天还没货。";
    }
    var bad = !!st.err && !searching && !st.busy;
    E.errBox.hidden = !bad;
    if (bad) E.errMsg.textContent = st.err;
  }
  function buildStore(w) {
    var navHtml = "";
    STORE_NAV.forEach(function (n) {
      if (n.sep) { navHtml += '<div class="as-nsep"></div>'; return; }
      navHtml += '<div class="as-ni" data-tab="' + n.tab + '">' + svg(n.ic, 16) + "<span>" + n.tab + "</span></div>";
    });
    var skel = "";
    for (var i = 0; i < 5; i++) {
      skel += '<div class="as-srow"><div class="sk-ic"></div><div class="sk-mid">' +
        '<div class="sk-ln"></div><div class="sk-ln s2"></div></div><div class="sk-btn"></div></div>';
    }
    w.nbody.innerHTML =
      '<div class="as">' +
        '<aside class="as-side">' +
          '<div class="as-brand">' + svg("bag", 19) + "<span>应用集市</span></div>" +
          '<nav class="as-nav">' + navHtml + "</nav>" +
          '<div class="as-foot">货架是真的，商品全是梦——<br>由 AI 依今日信号现编上架。</div>' +
        "</aside>" +
        '<div class="as-main">' +
          '<div class="as-top">' +
            '<div class="as-back" hidden>‹ 返回上架</div>' +
            '<input class="as-search" placeholder="搜索，或想象任何应用 — 回车现编" autocomplete="off" spellcheck="false">' +
            '<button class="as-shuffle" title="丢弃当前货架，重新梦一批">' + svg("redo", 14) + "换一批</button>" +
          "</div>" +
          '<div class="as-scroll">' +
            '<div class="as-banner" hidden>' +
              '<div class="as-bic"></div>' +
              '<div class="as-btx"><div class="as-bkick">今日主打</div><div class="as-bname"></div><div class="as-btag"></div></div>' +
              '<button class="as-bbtn">立即体验</button>' +
            "</div>" +
            '<div class="as-sechead"><span class="as-title">今日上架</span><span class="as-count"></span></div>' +
            '<div class="as-status" hidden></div>' +
            '<div class="as-skel" hidden>' + skel + "</div>" +
            '<div class="as-list"></div>' +
            '<div class="as-empty" hidden></div>' +
            '<div class="as-err" hidden>' + svg("alert", 26, 1.5) +
              '<div class="as-ert">货架没能梦出来</div><div class="as-ermsg"></div>' +
              '<button class="as-retry">再试一次</button></div>' +
          "</div>" +
        "</div>" +
      "</div>";
    var q = function (s) { return w.nbody.querySelector(s); };
    w.asEls = {
      nav: q(".as-nav"), search: q(".as-search"), shuffle: q(".as-shuffle"), back: q(".as-back"),
      banner: q(".as-banner"), bIc: q(".as-bic"), bName: q(".as-bname"), bTag: q(".as-btag"),
      title: q(".as-title"), count: q(".as-count"), status: q(".as-status"), skel: q(".as-skel"),
      list: q(".as-list"), empty: q(".as-empty"), errBox: q(".as-err"), errMsg: q(".as-ermsg")
    };
    w.asEls.nav.querySelectorAll(".as-ni").forEach(function (n) {
      n.addEventListener("click", function () {
        state.store.tab = n.getAttribute("data-tab");
        state.store.results = null; state.store.resq = ""; state.store.serr = "";
        w.asEls.search.value = "";
        storeRender();
      });
    });
    w.asEls.search.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      var raw = this.value.trim();
      if (!raw) {
        state.store.results = null; state.store.serr = "";
        storeRender();
        return;
      }
      if (state.store.sbusy) return;
      storeStart("search", raw.slice(0, 24));
    });
    w.asEls.back.addEventListener("click", function () {
      state.store.results = null; state.store.serr = "";
      w.asEls.search.value = "";
      storeRender();
    });
    w.asEls.shuffle.addEventListener("click", storeRedream);
    q(".as-retry").addEventListener("click", function () {
      state.store.err = "";
      storeStart("catalog");
    });
    storeRender();
  }
  function openAppstore(force) {
    var existing = storeWin();
    if (existing) {
      if (force) storeRedream();
      else if (existing.el.classList.contains("mini")) restore(existing);
      else bringFront(existing);
      return;
    }
    var spec = findSpec("应用集市") || {};
    var w = createWindow("应用集市", spec.icon || "🛍", { w: spec.w || 980, h: spec.h || 640, native: true });
    w.native = "appstore"; // createWindow 只置布尔，这里钉上原生应用标识
    buildStore(w);
    storeEnsure();
  }

  /* ============ Dock ============ */
  function refreshDock() {
    var dock = $("dock");
    dock.innerHTML = "";
    var lp = document.createElement("div");
    lp.className = "dicon";
    lp.innerHTML = "<span class='dic sys'>" + svg("grid", 20) + "</span><span class='tip'>启动台 · F4</span><span class='dot'></span>";
    lp.addEventListener("click", launchpadOpen);
    dock.appendChild(lp);
    var sepL = document.createElement("div"); sepL.className = "dsepv"; dock.appendChild(sepL);
    sysApps().forEach(function (a) { dock.appendChild(dockIcon(a.name, a.icon, a.hint)); });
    if (state.installed.length) {
      var sep0 = document.createElement("div"); sep0.className = "dsepv"; dock.appendChild(sep0);
      state.installed.forEach(function (a) { dock.appendChild(dockIcon(a.name, a.icon, a.hint)); });
    }
    var extras = {};
    Object.values(state.wins).forEach(function (w) {
      if (!findSpec(w.app)) extras[w.app] = w.icon;
    });
    var names = Object.keys(extras);
    if (names.length) {
      var sep = document.createElement("div"); sep.className = "dsepv"; dock.appendChild(sep);
      names.forEach(function (n) { dock.appendChild(dockIcon(n, extras[n])); });
    }
    var sep2 = document.createElement("div"); sep2.className = "dsepv"; dock.appendChild(sep2);
    var im = document.createElement("div");
    im.className = "dicon";
    im.innerHTML = "<span class='dic sys'>" + svg("spark", 20) + "</span><span class='tip'>想象搜索 · Ctrl K</span><span class='dot'></span>";
    im.addEventListener("click", spotOpen);
    dock.appendChild(im);
    var st = document.createElement("div");
    st.className = "dicon";
    st.innerHTML = "<span class='dic sys'>" + svg("sliders", 20) + "</span><span class='tip'>系统设置 · Ctrl ,</span><span class='dot'></span>";
    st.addEventListener("click", openSettings);
    dock.appendChild(st);
  }
  function dockIcon(name, icon, hint) {
    var d = document.createElement("div");
    d.className = "dicon";
    d.innerHTML = "<span class='dic' style='--hue:" + hueOf(name) + "'>" + esc(icon) + "</span><span class='tip'>" + esc(name) + "</span><span class='dot'></span>";
    var open = Object.values(state.wins).some(function (w) { return w.app === name; });
    if (open) d.classList.add("running");
    d.addEventListener("click", function (e) {
      var spec = findSpec(name);
      openApp(name, icon, hint || (spec && spec.hint), e.altKey); // Alt+点击 强制重梦
    });
    return d;
  }

  /* ============ 菜单栏 ============ */
  var dropdown = $("dropdown");
  var openMenu = null;
  function front() { return state.wins[state.frontId] || null; }
  function menuItems(name) {
    var f = front();
    var appName = f ? f.app : "访达";
    if (name === "apple") return [
      { l: "关于这台蜃楼…", f: function () {
          var aw = $("aboutWorld");
          var w = state.world;
          aw.innerHTML = w
            ? "今日世界：" + esc(w.tagline || "") + "<br>" +
              '<span style="color:#888">信号 ' + state.signals.length + " 条 · 应用 " + w.apps.length + " 个 · " +
              new Date().toLocaleDateString("zh-CN") + "</span>"
            : "";
          $("aboutDlg").hidden = false;
        } },
      { sep: 1 },
      { l: "系统设置…", k: "Ctrl+,", f: openSettings },
      { sep: 1 },
      { l: "睡眠", f: function () { $("sleepveil").hidden = false; } },
      { l: "重新入梦（重启）", f: function () { location.reload(); } }
    ];
    if (name === "app") return [
      { l: "关于 " + appName, m: "App>About" },
      { sep: 1 },
      { l: "关闭窗口", k: "Ctrl+W", f: function () { if (f) closeWin(f); } }
    ];
    if (name === "File") return [
      { l: "新建", m: "File>New" }, { l: "打开…", m: "File>Open" }, { l: "存储", m: "File>Save" }
    ];
    if (name === "Edit") return [
      { l: "撤销", m: "Edit>Undo" }, { l: "拷贝", m: "Edit>Copy" }, { l: "粘贴", m: "Edit>Paste" }, { l: "全选", m: "Edit>SelectAll" }
    ];
    if (name === "View") return [
      { l: "重梦 " + appName, f: function () { if (f) regen(f); } }
    ];
    if (name === "Window") {
      var items = [
        { l: "最小化", f: function () { if (f) minimize(f); } },
        { l: "缩放", f: function () { if (f) zoom(f); } },
        { sep: 1 },
        { l: "调度中心", k: "Ctrl+↑", f: function () { missionControl(true); } }
      ];
      var ws = Object.values(state.wins);
      if (ws.length) {
        items.push({ sep: 1 });
        ws.forEach(function (w) {
          items.push({ l: (w.id === state.frontId ? "✓ " : "　") + w.icon + " " + w.app,
                       f: function () { restore(w); } });
        });
      }
      return items;
    }
    if (name === "Help") return [{ l: appName + " 帮助", m: "Help>Help" }];
    return [];
  }
  function showDropdown(mitem) {
    var name = mitem.getAttribute("data-menu");
    var items = menuItems(name);
    dropdown.innerHTML = "";
    items.forEach(function (it) {
      if (it.sep) { var s = document.createElement("div"); s.className = "dsep"; dropdown.appendChild(s); return; }
      var d = document.createElement("div");
      d.className = "ditem";
      d.innerHTML = "<span>" + esc(it.l) + "</span>" + (it.k ? "<span class='key'>" + esc(it.k) + "</span>" : "");
      d.addEventListener("click", function (e) {
        e.stopPropagation();
        hideDropdown();
        if (it.f) it.f();
        else if (it.m) {
          var f = front();
          if (f && f.iframe && f.iframe.contentWindow) f.iframe.contentWindow.postMessage({ mir: "menu", item: it.m }, "*");
        }
      });
      dropdown.appendChild(d);
    });
    var r = mitem.getBoundingClientRect();
    dropdown.style.left = r.left + "px";
    dropdown.style.top = "28px";
    dropdown.hidden = false;
    document.querySelectorAll(".mitem").forEach(function (m) { m.classList.remove("open"); });
    mitem.classList.add("open");
    openMenu = mitem;
  }
  function hideDropdown() {
    dropdown.hidden = true;
    if (openMenu) openMenu.classList.remove("open");
    openMenu = null;
  }
  document.querySelectorAll(".mitem").forEach(function (m) {
    m.addEventListener("click", function (e) {
      e.stopPropagation();
      if (openMenu === m) hideDropdown(); else showDropdown(m);
    });
    m.addEventListener("mouseenter", function () { if (openMenu && openMenu !== m) showDropdown(m); });
  });
  document.addEventListener("click", hideDropdown);
  $("sleepveil").addEventListener("click", function () { $("sleepveil").hidden = true; });
  $("aboutOk").addEventListener("click", function () { $("aboutDlg").hidden = true; });

  /* ============ 键盘 ============ */
  document.addEventListener("keydown", function (e) {
    var mod = e.metaKey || e.ctrlKey;
    if (mod && (e.key === "w" || e.key === "W")) { e.preventDefault(); var f = front(); if (f) closeWin(f); }
    if (mod && (e.key === "k" || e.key === "K")) { e.preventDefault(); spotOpen(); }
    if (mod && e.key === ",") { e.preventDefault(); openSettings(); }
    if (e.key === "F4") { e.preventDefault(); launchpadOpen(); }
    if (e.ctrlKey && (e.key === "ArrowUp" || e.key === "Up")) { e.preventDefault(); missionControl(); }
    if (e.key === "Escape") {
      if (lpOpen) launchpadClose();
      else if (mcOpen) missionControlClose();
      else if (!$("spot").hidden) spotClose();
      else if (!$("settingsDlg").hidden) $("settingsDlg").hidden = true;
      else if (!$("dreamDlg").hidden) $("dreamDlg").hidden = true;
    }
  });

  /* ============ 系统设置 ============ */
  function openSettings() {
    $("settingsDlg").hidden = false;
  }
  $("setClose").addEventListener("click", function () { $("settingsDlg").hidden = true; });
  $("setRedream").addEventListener("click", function () { location.reload(); });
  $("setClearApps").addEventListener("click", function () {
    if (!confirm("遗忘本会话已梦出的所有应用？下次打开会重新梦。")) return;
    Object.values(state.wins).forEach(function (w) { closeWin(w); });
    state.cache = {};
    cacheSave();
    $("settingsDlg").hidden = true;
    toast("🌀", "已遗忘", "所有应用将在下次打开时重新梦出。", null);
  });
  $("setDreams").addEventListener("click", function () {
    $("settingsDlg").hidden = true;
    dreamOpen();
  });

  /* ============ 通知 ============ */
  function toast(icon, title, body, app) {
    var t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = '<div class="ti">' + (icon ? esc(icon) : svg("bell", 17)) + '</div><div><b>' + esc(title || "") +
      "</b><p>" + esc(body || "") + "</p></div>";
    t.addEventListener("click", function () {
      t.remove();
      if (app) openApp(String(app).slice(0, 40), "✨",
        "打开并展示这条通知背后的内容：" + title + " — " + (body || ""));
    });
    $("toasts").appendChild(t);
    setTimeout(function () {
      t.style.transition = "opacity .4s";
      t.style.opacity = "0";
      setTimeout(function () { t.remove(); }, 400);
    }, 8000);
  }

  /* ============ 启动台 ============ */
  var lpOpen = false;
  function launchpadList() {
    var list = BASIC_APPS.map(function (a) {
      return { name: a.name, icon: a.icon, hint: a.hint, tag: "基础" };
    });
    ((state.world && state.world.apps) || []).forEach(function (a) {
      list.push({ name: a.name, icon: a.icon, hint: a.hint, tag: "今日" });
    });
    state.installed.forEach(function (a) {
      if (!list.some(function (x) { return x.name === a.name; }))
        list.push({ name: a.name, icon: a.icon, hint: a.hint, tag: "已装" });
    });
    return list;
  }
  function launchpadRender() {
    var grid = $("lpgrid");
    var q = ($("lpsearch").value || "").trim().toLowerCase();
    grid.innerHTML = "";
    var items = launchpadList().filter(function (a) { return !q || a.name.toLowerCase().indexOf(q) >= 0; });
    if (!items.length) {
      var e = document.createElement("div"); e.className = "lpempty";
      e.textContent = "没有匹配「" + ($("lpsearch").value || "") + "」的应用";
      grid.appendChild(e); return;
    }
    items.forEach(function (a, i) {
      var d = document.createElement("div");
      d.className = "lpapp";
      d.style.animationDelay = (i * 0.035) + "s";
      d.innerHTML = "<div class='lpic' style='--hue:" + hueOf(a.name) + "'>" + esc(a.icon || "✨") + "</div>" +
                    "<div class='lpname'>" + esc(a.name) + "</div>";
      d.addEventListener("click", function () {
        launchpadClose();
        openApp(a.name, a.icon, a.hint);
      });
      grid.appendChild(d);
    });
  }
  function launchpadOpen() {
    if (lpOpen) { launchpadClose(); return; }
    lpOpen = true;
    var lp = $("launchpad");
    lp.hidden = false; lp.classList.remove("closing");
    $("lpsearch").value = "";
    launchpadRender();
    setTimeout(function () { $("lpsearch").focus(); }, 30);
  }
  function launchpadClose() {
    if (!lpOpen) return;
    lpOpen = false;
    var lp = $("launchpad");
    lp.classList.add("closing");
    setTimeout(function () { lp.hidden = true; lp.classList.remove("closing"); }, 180);
  }
  $("lpsearch").addEventListener("input", launchpadRender);
  $("lpsearch").addEventListener("keydown", function (e) {
    if (e.key === "Escape") { e.preventDefault(); launchpadClose(); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      var first = $("lpgrid").querySelector(".lpapp");
      if (first) first.click();
    }
  });
  $("launchpad").addEventListener("click", function (e) {
    if (e.target === $("launchpad")) launchpadClose();
  });

  /* ============ 想象搜索（Spotlight） ============ */
  var spotSel = 0, spotItems = [];
  function spotOpen() {
    $("spot").hidden = false;
    $("spotin").value = "";
    spotUpdate();
    setTimeout(function () { $("spotin").focus(); }, 30);
  }
  function spotClose() { $("spot").hidden = true; }
  function spotUpdate() {
    var raw = $("spotin").value.trim();
    var q = raw.toLowerCase();
    spotItems = [];
    launchpadList().forEach(function (a) {
      if (!q || a.name.toLowerCase().indexOf(q) >= 0) {
        spotItems.push({ icon: a.icon, label: a.name, tag: a.tag || "应用",
          f: function () { spotClose(); openApp(a.name, a.icon, a.hint); } });
      }
    });
    Object.keys(state.cache).forEach(function (k) {
      var nm = k.slice(5);
      if (nm && !spotItems.some(function (x) { return x.label === nm; })) {
        if (!q || nm.toLowerCase().indexOf(q) >= 0)
          spotItems.push({ icon: "✨", label: nm, tag: "已梦出", f: function () { spotClose(); openApp(nm); } });
      }
    });
    if (raw) {
      spotItems.unshift({ icon: "✨", label: '梦见「' + raw + '」', tag: "现编一个", f: function () {
        spotClose();
        openApp(raw.slice(0, 24), "✨",
          '用户刚刚想象出的应用：「' + raw + '」。大胆而贴切地解读，做一个让人眼前一亮的平行世界应用。');
      } });
    }
    spotSel = 0;
    spotRender();
  }
  function spotRender() {
    var r = $("spotres");
    r.innerHTML = "";
    spotItems.slice(0, 12).forEach(function (it, i) {
      var d = document.createElement("div");
      d.className = "spr" + (i === spotSel ? " sel" : "");
      d.innerHTML = '<span class="si">' + esc(it.icon) + "</span><span>" + esc(it.label) +
        '</span><span class="st">' + esc(it.tag || "") + "</span>";
      d.addEventListener("click", it.f);
      d.addEventListener("mousemove", function () {
        if (spotSel !== i) { spotSel = i; spotRender(); }
      });
      r.appendChild(d);
    });
  }
  $("spotin").addEventListener("input", spotUpdate);
  $("spotin").addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); spotSel = Math.min(spotSel + 1, Math.min(spotItems.length, 12) - 1); spotRender(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); spotSel = Math.max(spotSel - 1, 0); spotRender(); }
    else if (e.key === "Enter" && spotItems[spotSel]) spotItems[spotSel].f();
    else if (e.key === "Escape") spotClose();
  });
  $("spot").addEventListener("click", function (e) { if (e.target === $("spot")) spotClose(); });
  $("spotbtn").addEventListener("click", spotOpen);

  /* ============ 梦境回放 ============ */
  function dreamsLoad() {
    try { return JSON.parse(localStorage.getItem(DREAMS_KEY)) || []; } catch (e) { return []; }
  }
  function dreamsSave(list) {
    try { localStorage.setItem(DREAMS_KEY, JSON.stringify(list.slice(0, 30))); } catch (e) {}
  }
  function saveDream(w) {
    var list = dreamsLoad();
    list.unshift({
      ts: Date.now(),
      tagline: w.tagline || "",
      wallpaper: (w.theme && w.theme.wallpaper) || "",
      accent: (w.theme && w.theme.accent) || "",
      apps: (w.apps || []).slice(0, 10).map(function (a) { return { name: a.name, icon: a.icon }; })
    });
    dreamsSave(list);
  }
  function dreamOpen() {
    var grid = $("dreamGrid");
    var list = dreamsLoad();
    grid.innerHTML = "";
    $("dreamEmpty").hidden = list.length > 0;
    list.slice(0, 18).forEach(function (d) {
      var el = document.createElement("div");
      el.className = "dream";
      var when = new Date(d.ts);
      var wp = d.wallpaper || fallbackWallpaper(d.accent);
      el.innerHTML =
        '<div class="dw" style="background:' + esc(wp).replace(/"/g, "&quot;") + '">' +
          '<div class="dtag">' + esc(d.tagline || "（无标语）") + "</div></div>" +
        '<div class="dmeta"><b>' + when.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) +
          " · " + (d.apps || []).length + " 个应用</b>信号驱动的平行世界</div>" +
        '<div class="dapps">' + (d.apps || []).map(function (a) { return esc(a.icon || "✨"); }).join("") + "</div>";
      el.title = (d.apps || []).map(function (a) { return a.name; }).join("、");
      grid.appendChild(el);
    });
    $("dreamDlg").hidden = false;
  }
  $("dreambtn").addEventListener("click", dreamOpen);
  $("dreamClose").addEventListener("click", function () { $("dreamDlg").hidden = true; });
  $("dreamClear").addEventListener("click", function () {
    if (confirm("清空所有梦境回放？此操作不可撤销。")) {
      dreamsSave([]);
      dreamOpen();
    }
  });

  /* ============ 来自应用 iframe 的消息 ============ */
  window.addEventListener("message", function (e) {
    var d = e.data || {};
    var w = Object.values(state.wins).find(function (x) {
      return x.iframe && x.iframe.contentWindow === e.source;
    });
    if (d.mir === "event" && w) updateApp(w, d.detail);
    else if (d.mir === "open") openApp(String(d.app).slice(0, 60), "✨",
      "另一个应用请求打开它：" + String(d.app) + "。" + String(d.hint || ""));
    else if (d.mir === "focus" && w) bringFront(w);
    else if (d.mir === "notify") toast(d.icon, d.title, d.body, null);
    else if (d.mir === "ai" && w) {
      var ag = { id: "g" + (state.nextId++), kind: "ai", winId: w.id, reqId: d.reqId,
                 buf: "", win: null, raf: null,
                 history: [{ role: "user", content: JSON.stringify({
                   task: "ai", app: w.app, world: worldDesc(),
                   prompt: String(d.prompt).slice(0, 4000) }) }] };
      state.gen[ag.id] = ag;
      post({ id: ag.id, messages: ag.history, max: 2500 });
    }
    else if (d.mir === "install") {
      var nm = String(d.app).slice(0, 40), ic = String(d.icon || "✨").slice(0, 8);
      if (!state.installed.some(function (a) { return a.name === nm; }) && !findSpec(nm)) {
        state.installed.push({ name: nm, icon: ic, hint: String(d.hint || "").slice(0, 300) });
        refreshDock();
        toast(ic, "已安装「" + nm + "」", "新应用已加入 Dock。", null);
      }
    }
    else if (d.mir === "jserror" && w) {
      w.el.classList.add("glitched");
      w.el.querySelector(".glitch").title = d.message || "";
    }
  });

  /* ============ 时钟 ============ */
  function tickClock() {
    var d = new Date();
    var wd = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
    var h = d.getHours(), m = d.getMinutes();
    $("clock").textContent = d.getMonth() + 1 + "月" + d.getDate() + "日 周" + wd +
      "  " + h + ":" + (m < 10 ? "0" : "") + m;
    var dwT = $("dwTime"), dwD = $("dwDate");
    var hr12 = h % 12; if (hr12 === 0) hr12 = 12;
    dwT.textContent = hr12 + ":" + (m < 10 ? "0" : "") + m + " " + (h < 12 ? "AM" : "PM");
    dwD.textContent = d.getMonth() + 1 + "月" + d.getDate() + "日 · 周" + wd;
    $("dwidget").classList.add("show");
  }
  setInterval(tickClock, 1000);
  tickClock();

  /* ============ 开机管线 ============ */
  function bootProgress(pct) { $("bfill").style.width = pct + "%"; }
  function bootTag(t) { $("btag").textContent = t; }
  function showSignals(sigs) {
    var box = $("bsigs");
    if (!sigs || !sigs.length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = "";
    sigs.forEach(function (s, i) {
      var d = document.createElement("div");
      d.style.animationDelay = (i * 0.12) + "s";
      d.textContent = s.repo + (s.desc ? " — " + s.desc : "");
      box.appendChild(d);
    });
  }
  function setSigChip() {
    var chip = $("sigchip");
    if (state.signals.length) {
      chip.innerHTML = svg("antenna", 12) + "<span>今日 · " + state.signals.length + " 条信号</span>";
      chip.title = "今日桌面由以下真实趋势信号生成：\n" +
        state.signals.map(function (s) { return s.repo; }).join("\n");
    } else {
      chip.innerHTML = svg("antenna", 12) + "<span>今日 · 纯想象</span>";
      chip.title = "信号源失联，桌面由 AI 纯想象生成";
    }
  }

  /* ---- 桌面生成：JSON Lines 逐行流式 ---- */
  function worldReset() {
    state.world = { theme: null, tagline: "", browser: { name: DEFAULT_BROWSER.name, icon: DEFAULT_BROWSER.icon }, apps: [] };
  }
  function fixAppLine(a) {
    if (!a || typeof a.name !== "string" || !a.name.trim()) return null;
    return {
      name: a.name.trim().slice(0, 12),
      icon: String(a.icon || "✨").slice(0, 4),
      hint: String(a.hint || "").slice(0, 400),
      w: Math.max(300, Math.min(1100, +a.w || 760)),
      h: Math.max(240, Math.min(780, +a.h || 500))
    };
  }
  function desktopLine(line) { // 一行已解析的 JSON 对象
    var o = null;
    try { o = JSON.parse(line); } catch (e) { return; }
    if (!o || typeof o !== "object") return;
    if (o.type === "theme" && o.wallpaper) {
      state.world.theme = o;
      applyTheme(o);
      bootProgress(72);
    } else if (o.type === "tagline" && o.text) {
      state.world.tagline = String(o.text).slice(0, 30);
      bootTag(state.world.tagline);
    } else if (o.type === "browser" && o.name) {
      state.world.browser = { name: String(o.name).slice(0, 8), icon: String(o.icon || DEFAULT_BROWSER.icon).slice(0, 4) };
      refreshDock();
    } else if (o.type === "app") {
      var a = fixAppLine(o);
      if (a && state.world.apps.length < 10 &&
          !sysApps().some(function (s) { return s.name === a.name; }) && // 基础软件/浏览器等系统应用名不被今日应用占用
          !state.world.apps.some(function (x) { return x.name === a.name; })) {
        state.world.apps.push(a);
        addDesktopIcon(a);
        bootProgress(72 + state.world.apps.length * 2.4);
        if (state.world.apps.length === 3) hideBoot(); // 第 3 个图标落地即进桌面，剩下的当着用户的面继续梦
      }
    }
  }
  function desktopChunk(p, t) {
    p.buf += t;
    var lines = p.buf.split("\n");
    p.buf = lines.pop(); // 末尾留半行
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i].replace(/\r$/, "").replace(/^\s*```(?:json)?\s*/, "").replace(/```\s*$/, "").trim();
      if (!ln || ln.charAt(0) !== "{") continue; // 无视旁白噪音
      desktopLine(ln);
    }
  }
  function genDesktop() {
    worldReset();
    $("dicons").innerHTML = "";
    var msg = { role: "user", content: JSON.stringify({
      task: "create-desktop",
      date: new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }),
      time: new Date().toString(),
      signals: state.signals.map(function (s) { return s.repo + " — " + (s.desc || ""); }),
      note: state.signals.length ? "" : "（今日信号源失联，请纯凭想象构造一个今日世界）"
    }) };
    var g = { id: "g" + (state.nextId++), kind: "desktop", buf: "", history: [msg], tries: 0 };
    state.gen[g.id] = g;
    post({ id: g.id, messages: g.history, max: 6000 });
  }
  function desktopFinish(p, trunc, errMsg) {
    console.log("[mirage] desktop finish", { trunc: trunc, err: errMsg || null, apps: state.world ? state.world.apps.length : 0, tail: p.buf.slice(0, 200) });
    if (p.buf && !trunc && !errMsg) { // 冲刷末尾半行
      var ln = p.buf.trim();
      if (ln.charAt(0) === "{") desktopLine(ln);
      p.buf = "";
    }
    var n = state.world ? state.world.apps.length : 0;
    if (n >= 4 && !errMsg) { worldComplete(p); return; }
    if (p.tries < 1) {
      p.tries++;
      p.buf = "";
      worldReset();
      $("dicons").innerHTML = "";
      $("boot").classList.remove("hidden"); // 已进桌面也要请回开机屏，别让用户盯着空桌
      bootProgress(55);
      bootTag(errMsg ? "梦受了点干扰，再试一次…" : "世界没拼完整，再梦一次…");
      post({ id: p.id, messages: p.history, max: 10000 });
      return;
    }
    if (!state.world) worldReset();
    var used = state.world.apps.map(function (a) { return a.name; });
    DEFAULT_APPS.forEach(function (a) {
      if (state.world.apps.length >= 10) return;
      if (used.indexOf(a.name) < 0) {
        state.world.apps.push({ name: a.name, icon: a.icon, hint: a.hint, w: a.w, h: a.h });
        addDesktopIcon(a);
      }
    });
    worldComplete(p);
    if (n < 4) toast("🏜", "用了备用梦境", "今日世界没拼完整，已混入内置平行世界应用。", null);
  }
  function hideBoot() {
    if (!$("boot").classList.contains("hidden")) {
      bootProgress(100);
      setSigChip();
      refreshDock();
      setTimeout(function () { $("boot").classList.add("hidden"); }, 400);
    }
  }
  function worldComplete(p) {
    delete state.gen[p.id];
    if (!state.world.tagline) state.world.tagline = DEFAULT_WORLD.tagline;
    saveDream(state.world);
    setSigChip();
    refreshDock();
    hideBoot();
    setTimeout(storeEnsure, 1600); // 静默预取集市货架：等用户点开时大概率已上架完毕
  }

  /* ============ 启动（先过门禁） ============ */
  var booted = false;
  function startBoot() { // 门禁通过后才允许启动：此前不发出任何请求
    try { sessionStorage.removeItem(CACHE_KEY); } catch (e) {} // 每次开机重梦：清掉上一次开机的应用缓存
    cacheLoad();
    refreshDock();
    renderDesktopIcons();
    bootProgress(10);
    bootTag("正在读取今日信号…");
    fetch("/api/trending", { headers: gateHeaders() }).then(function (r) { return r.json(); }).then(function (t) {
      state.signals = (t.signals || []).slice(0, 12);
      showSignals(state.signals);
      bootProgress(40);
      bootTag(state.signals.length
        ? "捕获 " + state.signals.length + " 条信号，正在入梦…"
        : "信号源失联，今天纯靠想象…");
      bootProgress(55);
      genDesktop();
    }).catch(function () {
      state.signals = [];
      bootProgress(55);
      bootTag("信号源失联，今天纯靠想象…");
      genDesktop();
    });
    fetch("/api/config", { headers: gateHeaders() }).then(function (r) { return r.json(); }).then(function (c) {
      $("setModel").textContent = c.model + " @ " + (c.relay || "?") + (c.effort ? " · " + c.effort : "");
    }).catch(function () { $("setModel").textContent = "未知"; });
  }
  function bootOnce() { if (!booted) { booted = true; startBoot(); } }

  function initGate() {
    var lock = $("lock"), inp = $("lockIn");
    if (gateKey() === GATE_PW) { lock.hidden = true; return; } // 本会话已解锁：免门禁直接开机
    function tryUnlock() {
      if (inp.value === GATE_PW) {
        try { sessionStorage.setItem(GATE_KEY, GATE_PW); } catch (e) {}
        lock.classList.add("away");
        setTimeout(function () { lock.hidden = true; }, 500);
        bootOnce();
      } else {
        $("lockErr").textContent = inp.value ? "密码不对，这台蜃楼不认识你。" : "请输入密码。";
        lock.classList.remove("shake");
        void lock.offsetWidth; // 重置动画
        lock.classList.add("shake");
        inp.value = "";
        inp.focus();
      }
    }
    $("lockGo").addEventListener("click", tryUnlock);
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") tryUnlock(); });
    setTimeout(function () { inp.focus(); }, 60);
  }

  initGate();
  window.addEventListener("load", function () {
    if (gateKey() === GATE_PW) bootOnce();
  });
})();
