/* MirageOS 外壳逻辑 — 移植自 wibeos (MIT)，按共识改造：
   删 persona/文件系统/音乐/摄像头，加热点开机、会话缓存、梦境回放，全中文平行世界。 */
(function () {
  "use strict";

  /* ============ 基础 ============ */
  var CACHE_V = 1;           // 缓存结构版本
  var CACHE_KEY = "mirage_cache_v" + CACHE_V;
  var DREAMS_KEY = "mirage_dreams_v1";
  var state = { wins: {}, nextId: 1, z: 10, frontId: null, cache: {}, gen: {},
                world: null, signals: [], installed: [] };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ============ 系统提示词（应用锻造炉） ============ */
  var SYSTEM_PROMPT = [
    "你是 MirageOS 的应用锻造炉。MirageOS 是一个跑在浏览器里的仿 macOS「幻觉操作系统」：桌面、菜单栏、Dock 与窗口由真实的本地外壳绘制；窗口里运行的一切应用都由你现场虚构，没有预装软件。每次请求只处理一个任务。",
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
    "apps 从信号发散：至少 2 个真正可玩的游戏（hint 写明玩法与按键）、至少 1 个聊天/社交、至少 1 个内容流（视频/资讯/社区）；类型错开，别全是工具；全部为平行世界虚构中文品牌。",
    "",
    "CREATE（任务 \"create-app\"）：返回完整独立的 HTML 文档，全部 CSS/JS 内联，零外部资源（图标用 emoji/unicode/CSS/内联 SVG）。应用必须真正可用：游戏能玩、计算器能算、编辑器能编辑。像精致的原生 macOS 应用（-apple-system 字体栈、mac 风格控件）。窗口外壳（标题栏、红绿灯）由系统绘制——不要自己画标题栏。html,body{margin:0;height:100%} 铺满窗口。",
    "快而简：瞄准 100 行内，先骨架后细节，宁简勿繁——速度比华丽重要，用户等 30 秒就会失去兴趣。",
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
    return "radial-gradient(1100px 750px at 75% 18%, color-mix(in srgb, " + accent + " 65%, #ffffff) 0%, transparent 60%)," +
           "radial-gradient(900px 700px at 18% 82%, color-mix(in srgb, " + accent + " 50%, #ff5fa2) 0%, transparent 55%)," +
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
      headers: { "content-type": "application/json" },
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
  var POP_PROLOGUE = '<meta charset="utf-8"><style>' + POP_STYLE + "</style>";
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
    if (w.el.classList.contains("generating") || w.el.classList.contains("updating")) return;
    if (w.history.length && w.history[w.history.length - 1].role === "user") w.history.pop();
    detail.time = new Date().toString();
    w.history.push({ role: "user", content: JSON.stringify({ task: "update-app", world: worldDesc(), event: detail }) });
    trimHistory(w);
    w.el.classList.add("updating");
    sendGen(w);
  }
  function regen(w) {
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
    if (!p || !p.win) return;
    p.think = (p.think || 0) + n;
    var pill = p.win.el.querySelector(".genpill");
    if (pill && !p.textStarted) pill.textContent = "💭 梦的思绪 " + p.think + " 字…";
  }

  function mirageChunk(id, t) {
    var p = state.gen[id];
    if (p) {
      if (p.kind === "desktop") { desktopChunk(p, t); return; }
      if (!p.textStarted && p.win) {
        p.textStarted = true;
        var pill0 = p.win.el.querySelector(".genpill");
        if (pill0) pill0.textContent = "✨ 正在梦见 " + p.win.app + "…";
      }
      p.buf += t;
      streamFeed(p, t);
      return;
    }
    var w = state.wins[id];
    if (w) w.buf += t;
  }

  function mirageDone(id, trunc) {
    var p = state.gen[id];
    if (p && p.kind === "desktop") { desktopFinish(p, trunc); return; }
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
    el.innerHTML =
      '<div class="tbar">' +
        '<div class="lights">' +
          '<span class="lt red" data-act="close"></span>' +
          '<span class="lt yel" data-act="min"></span>' +
          '<span class="lt grn" data-act="zoom"></span>' +
        '</div>' +
        '<div class="ttitle">' + esc(icon) + " " + esc(app) + '</div>' +
      '</div>' +
      '<div class="wbody">' +
        '<iframe sandbox="allow-scripts allow-same-origin"></iframe>' +
        '<div class="genpill">✨ 正在梦见 ' + esc(app) + '…</div>' +
        '<div class="glitch">⚠️ 幻象 · 重梦</div>' +
        '<div class="veil"><div class="vsp">✨ 想象中…</div></div>' +
        '<div class="werr"><div style="font-size:34px">💥</div><div>梦被打断了</div>' +
          '<div class="werrmsg" style="color:#999;font-size:11px;max-width:90%"></div>' +
          '<button data-act="retry">再试一次</button></div>' +
      '</div>' +
      '<div class="rsz"></div>';
    winsEl.appendChild(el);
    var w = {
      id: id, app: app, icon: icon, el: el,
      iframe: el.querySelector("iframe"),
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
      grid.innerHTML = '<div id="mcEmpty"><div style="font-size:40px">🪟</div>' +
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
  function addDesktopIcon(a, i) {
    var c = $("dicons");
    var d = document.createElement("div");
    d.className = "dskicon pop";
    var x = window.innerWidth - 124 - 104 * Math.floor(i / 7);
    var y = 130 + (i % 7) * 100;
    d.style.left = Math.max(4, Math.min(window.innerWidth - 100, x)) + "px";
    d.style.top = Math.max(30, Math.min(window.innerHeight - 160, y)) + "px";
    d.style.animationDelay = "0.04s";
    d.title = a.name + (a.hint ? "：" + a.hint : "");
    d.innerHTML = '<div class="em">' + esc(a.icon || "✨") + '</div><div class="nm">' + esc(a.name) + "</div>";
    d.addEventListener("dblclick", function () { openApp(a.name, a.icon, a.hint); });
    d.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      e.stopPropagation();
      iconMenu(e, a);
    });
    c.appendChild(d);
  }
  function renderDesktopIcons() {
    $("dicons").innerHTML = "";
    if (!state.world) return;
    state.world.apps.slice(0, 10).forEach(function (a, i) {
      var d = addDesktopIcon(a, i);
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
    return [
      { name: bname, icon: bicon, w: 1000, h: 660, dock: true,
        hint: "「" + bname + "」——MirageOS 的网页浏览器（贴合今日世界的主题色与气质，" + bicon + " 徽标）。结构至关重要：固定工具栏（后退/前进按钮、地址栏），下方一个撑满剩余空间的 <div id=\"page\"> 容器承载当前页面；浏览器外壳永不重绘。地址栏：data-mir-enter=\"navigate: 用户在地址栏输入了内容。只返回一个 <mir-patch select='#page'>，内含该网址被梦出的完整页面\"。#page 内起始页：平行世界虚构站点的收藏夹网格（绝不真实品牌），每个磁贴 data-mir=\"navigate: patch #page 为该站点\"。页面里所有链接同样带 data-mir navigate 属性。所有导航响应必须且只能是一个 <mir-patch select=\\\"#page\\\">——绝不返回完整文档。页面要丰富可信：真实感文案、站点导航、用 CSS 渐变画的\"图片\"。默认搜索引擎叫「鹦鹉」。" },
      { name: "今日访达", icon: "🗂", w: 880, h: 560, dock: true,
        hint: "「今日访达」：展示今天这个平行世界的档案。顶部：开机标语（大字）+ 今日日期 + 主题色色块。中部两栏：左栏「信号来源」列出这些真实趋势信号：" + (sigList || "（今天信号失联，桌面纯靠想象）") + "；右栏「由此生成的应用」列出：" + (appNames || "（尚未生成）") + "，每项带一句话说明。底部一行小字：\"以上内容由 AI 根据真实趋势信号即时虚构，每次开机都会重来\"。静态 HTML + 本地 JS，像精致的 macOS 访达（侧栏+图标列表）。" },
      { name: "应用集市", icon: "🛍", w: 980, h: 640, dock: true,
        hint: "「应用集市」：平行世界的应用商店。顶部大横幅（CSS 渐变假图+今日促销文案），分类 chips，卡片网格：先放\"编辑精选\"——" + (appNames || "几个虚构应用") + "（今日桌面同款），再发明 6-9 个同世界观的新应用。每张卡片：emoji 图标、中文名、标语、星级、价格（免费/¥6）、一句搞笑用户评论。每张卡有「获取」按钮：点击调用 mir.install(应用名, emoji, 一句话描述)，按钮变为「已获取」。静态 HTML + 本地 JS。绝不出现真实品牌。" }
    ];
  }

  /* ============ Dock ============ */
  function refreshDock() {
    var dock = $("dock");
    dock.innerHTML = "";
    var lp = document.createElement("div");
    lp.className = "dicon";
    lp.innerHTML = "🚀<span class='tip'>启动台 (F4)</span><span class='dot'></span>";
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
    im.innerHTML = "✨<span class='tip'>想象搜索 (Ctrl+K)</span><span class='dot'></span>";
    im.addEventListener("click", spotOpen);
    dock.appendChild(im);
    var st = document.createElement("div");
    st.className = "dicon";
    st.innerHTML = "⚙️<span class='tip'>系统设置 (Ctrl+,)</span><span class='dot'></span>";
    st.addEventListener("click", openSettings);
    dock.appendChild(st);
  }
  function dockIcon(name, icon, hint) {
    var d = document.createElement("div");
    d.className = "dicon";
    d.innerHTML = esc(icon) + "<span class='tip'>" + esc(name) + "</span><span class='dot'></span>";
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
          if (f && f.iframe.contentWindow) f.iframe.contentWindow.postMessage({ mir: "menu", item: it.m }, "*");
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
  fetch("/api/config").then(function (r) { return r.json(); }).then(function (c) {
    $("setModel").textContent = c.model + " @ " + (c.relay || "?") + (c.effort ? " · " + c.effort : "");
  }).catch(function () { $("setModel").textContent = "未知"; });

  /* ============ 通知 ============ */
  function toast(icon, title, body, app) {
    var t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = '<div class="ti">' + esc(icon || "🔔") + '</div><div><b>' + esc(title || "") +
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
    var list = ((state.world && state.world.apps) || []).map(function (a) {
      return { name: a.name, icon: a.icon, hint: a.hint, tag: "今日" };
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
    items.forEach(function (a) {
      var d = document.createElement("div");
      d.className = "lpapp";
      d.innerHTML = "<div class='lpic'>" + esc(a.icon || "✨") + "</div>" +
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
      if (!state.installed.some(function (a) { return a.name === nm; })) {
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
      d.textContent = "▲ " + s.repo + (s.desc ? " — " + s.desc : "");
      box.appendChild(d);
    });
  }
  function setSigChip() {
    var chip = $("sigchip");
    if (state.signals.length) {
      chip.textContent = "📡 今日 · " + state.signals.length + " 条信号";
      chip.title = "今日桌面由以下真实趋势信号生成：\n" +
        state.signals.map(function (s) { return s.repo; }).join("\n");
    } else {
      chip.textContent = "📡 今日 · 纯想象";
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
          !state.world.apps.some(function (x) { return x.name === a.name; })) {
        state.world.apps.push(a);
        addDesktopIcon(a, state.world.apps.length - 1);
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
        addDesktopIcon(a, state.world.apps.length - 1);
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
  }

  /* ============ 启动 ============ */
  window.addEventListener("load", function () {
    try { sessionStorage.removeItem(CACHE_KEY); } catch (e) {} // 每次开机重梦：清掉上一次开机的应用缓存
    cacheLoad();
    refreshDock();
    renderDesktopIcons();
    bootProgress(10);
    bootTag("正在读取今日信号…");
    fetch("/api/trending").then(function (r) { return r.json(); }).then(function (t) {
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
  });
})();
