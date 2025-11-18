## Glowtype 视觉体系 v1.0（给设计师 & 前端）

> 风格方向：Starfield × Emotional Spectrum × Soft Nebula × Light Sci‑Fi  
> 一句话定义：**把情绪做成一个星体，把体验做成一段星云旅程。**

---

### 1. 视觉方向原则

- 不做：MBTI 官方案、临床心理评估 UI、企业 SaaS 深蓝风。
- 要做：年轻、有趣、星座感、轻心理。
- 三个参考方向（以 A 星系风为主）：
  - ⭐ A. 星系 / 宇宙系：圆形星球、轨道、情绪光环、柔光边框。
  - 🎨 B. 可爱 / 清新插画：抽象情绪角色、小表情、柔和块面。
  - 🪩 C. Viral 分享卡：卡片、贴纸、泡泡背景，更偏“截图发圈”的海报感。

---

### 2. 配色系统（Emotional Glow Palette）

| 名称            | Hex        | 使用场景                          |
|-----------------|------------|-----------------------------------|
| Aura Blue       | `#93C5FD`  | 主色调、按钮、星云主光           |
| Nebula Purple   | `#C4B5FD`  | 背景渐变、卡片边缘光             |
| Soft Pink Glow  | `#FBCFE8`  | 情绪点缀、柔光高光               |
| Dawn Peach      | `#FFD8B5`  | 温暖情绪、次要按钮 Hover         |
| Deep Space Navy | `#0A0F25`  | 深层背景渐变（低透明度叠加）     |

原则：

- 柔和渐变、不过饱和；
- 不走企业蓝 (#2563EB 这种)；
- 一眼要有“梦幻 × 情绪 × 科幻”的感觉。

---

### 3. 背景（Background Style）

Hero 背景推荐：

```css
background:
  radial-gradient(circle at 70% 20%, #C4B5FD40, transparent 60%),
  radial-gradient(circle at 20% 70%, #93C5FD40, transparent 60%),
  #F8FAFF;
```

效果：

- 右上：偏紫光晕；
- 左下：偏蓝光晕；
- 中间：浅白；
- 整体像淡淡的星云能量分布，而不是纯白或纯色大块。

---

### 4. Glowtype 星卡（核心组件）

目标：**足够吸睛，用户愿意截图分享。**

基础要求：

- 圆角：24–32px（接近 Apple 小组件）。
- 半透明玻璃 + 边缘发光：

```css
box-shadow:
  0 0 40px rgba(200,160,255,0.3),
  0 0 80px rgba(160,200,255,0.2) inset;
backdrop-filter: blur(20px);
background: rgba(255,255,255,0.25);
```

- 内部情绪光晕（Emotional Aura）：

```css
background:
  radial-gradient(circle, #93C5FD60, transparent 50%),
  radial-gradient(circle, #C4B5FD50, transparent 60%),
  radial-gradient(circle, #FBCFE850, transparent 70%);
```

- 排版：标题 + tagline 居中，版式要像海报，而不是表格。

示例：

- 标题：`QUIET COMET`
- tagline：`小小的，但带着自己的轨迹 🌙`

---

### 5. 首页 Hero（最终版布局原则）

左侧：**只保留 3 行信息 + 1 个按钮**

- 标题：大号、粗体。
  - 例：`你的 Glowtype 是什么？ ✨`
- 副标题：16–18px，轻松、口语化。
  - 例：`一个 2 分钟的轻松小测试，把你最近的情绪变成一张 Glowtype 星卡。`
- 主按钮：
  - 文案：`开始测试`
  - 样式：蓝系渐变、微光、Hover 有蓝 → 青渐变；
  - 按钮是首屏唯一 CTA。

右侧：**主视觉 = 巨大的 Glowtype 星卡**

- 占 Hero 宽度约 45%；
- 有缓慢漂浮动画（3–4px 上下移动）；
- 玻璃质感、浅粉浅蓝光环；
- 卡片背后有一圈 Orbit 轨道缓慢旋转（极低速）；
- 这是首页灵魂：**必须好看，必须第一眼就吸睛。**

---

### 6. “怎么玩”区域（How it works）

目标：**轻薄、横向、像娱乐测试，不像产品说明。**

规范：

- 不用白底大卡片；改为一行文本 + emoji。

示例：

```text
怎么玩？

1️⃣ 选几个最像你的情况
2️⃣ 系统拼出你的情绪轨迹
3️⃣ 你会拿到一张 Glowtype 星卡
```

---

### 7. 测试页 Quiz（太空探险风）

整体氛围：**“轻太空问答 UI”**。

要求：

1. 顶部有非常淡的轨道背景（透明度 5–10%）：
   - 不抢视觉，但统一“星系”氛围。
2. 每道题是一张漂浮问答卡片：

```css
background: rgba(255,255,255,0.55);
backdrop-filter: blur(12px);
box-shadow: 0 4px 20px rgba(150,150,255,0.15);
```

3. 选项 = 发光按钮：
   - Hover：

```css
box-shadow: 0 0 20px rgba(150,200,255,0.35);
```

---

### 8. 结果页 Result Page

结构建议：

- 顶部：`你的 Glowtype` + 大标题 `Quiet Comet / 静彗星`。
- 主视觉：大星球 / Glowtype 星卡：
  - 圆形星球；
  - 光圈轨道；
  - 轻微自转或缓慢漂浮。
- 信息区块：
  - 情绪描述（2–3 段短文）；
  - 情绪节奏（可以图形化，比如简单水平条 / Tag）；
  - 自我关怀建议（3–5 条）。
- CTA：
  - `截图分享 🌟 / Save my Glowtype`；
  - `想聊聊 → 匿名聊天`。

---

### 9. 分享卡（Glowtype Share Card）

作为 viral 核心，必须可导出图片（前端 canvas 或后端生成皆可）。

规格：

- 尺寸：
  - 1080×1920（竖屏 story）
  - 或 1:1 方形版本；
- 要素：
  - 大星球 / Glowtype 星卡插图；
  - Glowtype 名称超大；
  - 背景星云渐变；
  - 底部有 `glowtype.me` Logo；
  - 字体略带科幻感，边缘可做轻微发光。

---

### 10. MUST / SHOULD / AVOID 指南（给设计 + 前端）

**MUST（必须落地）：**

- A. 重做首页 Hero 主视觉：
  - 漂浮星卡 + 星云光晕背景；
  - 不允许纯白大平面；  
  - 不允许矩形白框堆信息；  
  - 不允许企业深蓝工具风。
- B. 全站应用简化版星云背景（尤其首页、结果页）。
- C. 所有主要卡片（Hero 卡、题目卡、结果卡）采用玻璃效果（Glassmorphism）。
- D. 实现规范的 Glowtype Card 组件（圆角、blur、光晕）。
- E. Quiz 选项用发光按钮交互（Hover 有明显但柔和反馈）。
- F. 结果页带星球 / 星卡主视觉。
- G. 提供分享卡（canvas 导出或后端模板生成）。

**SHOULD（推荐）：**

- Orbit 动画（轨道缓慢旋转）；
- 背景粒子（轻量星点）；
- 情绪光环动态变化（不同 Glowtype 配不同 Aura）；
- 卡片呼吸动画（微缩放 / 光影变换）。

**AVOID（避免）：**

- 纯白背景 + 蓝色主按钮的企业风；
- 大块矩形白卡片堆满文字；
- 信息密度过高的说明文案；
- 报告式布局（像 PPT / 年度报告）；
- 带“诊断 / 评估 / 症状”等词的标题（放到 Safety / Help 即可）。

