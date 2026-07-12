---
name: brand
description: Brand identity system design via role-played senior brand designer + staged exploration (concept → variations → system). USE WHEN designing a logo, app icon, brand mark, or full visual identity for a product — instead of "generate a logo" one-shots.
---

# brand — 品牌识别系统设计(非一次性出图)

> 2026-07-12 起源:Jeff 为读值 DuValue LOGO 给出的方法论,固化为可复用 skill。
> 核心思想:**不要直接"生成一个 Logo",让 AI 扮演顶级品牌设计师去探索一个品牌系统。**
> 配合本地出图工具(codex-image / GPT Image / Midjourney / Ideogram)使用;hara-design 负责流程与评审,出图工具只是手。

## 何时用

- 新产品要 logo / app icon / 品牌 mark
- 现有 logo 被判"太通用/撞脸/没记忆点",要系统性重做
- 要一整套视觉语言(icon+官网+splash+登录+名片)而不是一张图

## 反模式(先读,避免走回头路)

1. **一句"设计一个 logo"直接出图** → 得到的是平均数,通用、撞脸。
2. **金融/科技产品的廉价化陷阱**:AI 一看到 finance 就画 K线/上涨箭头/美元/金币/牛熊/大脑/芯片——全部要在 negative prompt 里显式禁止。
3. **拿 AI 生成物当终稿**:字母/精确几何靠运气,同 prompt 重跑会变形。AI 的角色是**探索方向、验证概念成立**;终稿必须矢量手工(SVG 路径,统一描边/圆角/共享笔画)。
4. **第一轮就纠结颜色**:方向确定前,黑白/单色探索;色板是第三轮的事。

## 主 Prompt 模板(角色扮演 · 按产品填空)

```
You are a senior brand identity designer specializing in {行业} and technology companies.
Design a premium app icon and logo system for a product called "{产品名}".

Brand Meaning
{产品名} stands for {一句话品牌含义}.
It is {产品一句话定位——说"帮用户理解什么",别说功能清单}.
The product is inspired by {核心框架/理念,如 DuPont Analysis},
where {几个维度} come together into one concept: {核心概念,如 Intrinsic Value}.
The logo should subtly express this idea without literally drawing {行业陈词滥调,如 financial charts}.

Design Goals
Premium / Trustworthy / Intelligent / Timeless / Minimal / Modern.
Avoid anything that feels like {要撇清的邻居,如 crypto, trading, gambling}.

Target Audience
{2-4 类核心人群}

Visual Direction
{本轮探索的具体构图指令,如:geometric monogram using letters D and V;
three elegant lines or nodes converge toward the V…}

Style References
Apple / Linear / Stripe / Notion / Vercel / Perplexity.
Do NOT imitate their logos. Emulate their simplicity and premium aesthetic.

Color Palette
{主色板}. No gradients. No neon. No glowing effects.

Composition
1. App Icon 1024×1024, rounded square, recognizable at 32×32
2. Horizontal logo (icon + wordmark)  3. Black version  4. White version
5. Favicon  6. App Store presentation mockup

Style
Flat design. Swiss minimalism. Perfect geometric proportions.
Strong negative space. Extremely clean. No unnecessary decoration.
Output should look like it was designed by a top branding agency
for a billion-dollar {行业} startup.
```

## Negative Prompt(金融/科技类必挂)

```
Do NOT use: stock charts, candlestick charts, bar charts, upward arrows,
currency symbols, coins, bank buildings, bulls, bears, robots, brain icons,
AI chip icons, 3D effects, glassmorphism, overly futuristic visuals,
crypto aesthetics, generic fintech icons.
The logo should not immediately communicate "stock market".
It should communicate intelligence, structure, trust, and {核心概念}.
```

## 三轮流程

**第一轮 · 概念探索(Concept Exploration)**
- 5 个左右**互不相同的概念方向**(如:monogram / 具象物抽象 / 多线汇聚 / 罗盘 / 负空间隐藏),每方向 1-2 张。
- 黑白或单色,不纠结颜色。
- 评审尺子:32-60px 可辨 / 独占不撞脸 / 有没有"第二眼才读懂"的层次(最有长期生命力的特征)。

**第二轮 · 定向变体(Variations)**
- 选中 1 个方向,同概念出 **20-30 个变体**:只动几何比例/间距/节点位置/负空间/笔画粗细,**只黑白**。
- 从中挑最有辨识度的一版 → **转矢量手工精修**(此后不再用 AI 出 mark 本体)。

**第三轮 · 品牌系统(Brand System)**
- 冻结 SVG 后铺开:App Icon 全尺寸 / 官网 / Splash / 登录页 / Dashboard / 名片 / 商店截图风格。
- 视觉语言统一从这一步长出来,不是每处重新发明。

## codex-image 适配(本地出图硬约束)

- gen-image.sh **≤350 codepoints/prompt** → 主 Prompt 模板没法整段塞。做法:每个方向**蒸馏成一条 ≤350 字符的图像描述**,固定携带:`flat, Swiss minimal, geometric, strong negative space, {色}, app icon rounded square, legible at 60px` + negative 关键词摘要 `no charts, no arrows, no coins, no glow, no 3D, not mystical`。
- 一提示一调用,`-o` 落盘到项目 `brand/<轮次>/` 目录;生成后 **Read 回自查**(60px 心智模拟),糊/畸变就改词重跑。
- 字母类 mark:AI 只用来验证构图成立,**字母终稿一律矢量手绘**。

## 评审角色

生成不评审 = 白跑。每轮由 designer 人格(南荒=顾雅)按尺子排名 + 一句话优劣 + 明确推荐,再呈 Jeff 拍板。方向叉路(如"要完整字母组合还是更纯的符号")点明白给 Jeff 选,不要替他选。
