# 专家级 AI 界面设计技能库 (Comprehensive UI/UX Design Skills for AI)

完整理论参考。执行时以 [SKILL.md](SKILL.md) 的检查清单与工作流为准。

---

## 1. 材质与物理光学感知系统 (Material & Advanced Optical Physics)

### 技能：流体玻璃材质的应用与光学融合 (Adaptive Liquid-Glass Physics)

**设计原理与隐喻：** 界面不再是扁平的（Flat）或简单的毛玻璃（Frosted Glass），而是引入了液体流动性与高折射率玻璃的物理混合特性。组件不仅是浮动在内容上方，而是成为了内容的一面「透镜」。

**AI 执行细则（视觉/多模态）：**

- **动态环境采样（Contextual Sampling）：** 悬浮的玻璃组件必须实时对下方的图层进行扩张采样。当界面向下滚动时，组件的底色应根据下方图像的直方图（Histogram）和明暗度，自动在亮色（Light Mode Tint）与暗色（Dark Mode Tint）之间动态平滑过渡，确保内部文字的对比度始终符合 WCAG 标准。
- **交互物理化（Kinetic Shimmer & Expansion）：** 当组件从静态转入用户触碰（Hover/Active）状态时，AI 应触发材质形变。组件的物理体积应以弹簧动效（Spring Physics）向外扩张（如 5% 至 10%），同时在材质表面模拟一道快速掠过的光学高光闪烁（Shimmer Effect），传达出「液体受压」的视觉反馈。

**AI 负面清单 / 错误模式（Antipatterns）：**

- ❌ 禁止在玻璃组件下方手动添加黑色半透明遮罩层（Scrims）或阴影贴图，这会破坏折射的通透感。
- ❌ 禁止在相邻的两个玻璃组件上使用独立的采样器，这会导致交界处的光影断层。

---

### 技能：单色化视觉噪点控制 (Monochrome Dynamic Tinting)

**设计原理与隐喻：** 极简主义功能导航。为了让高折射率的玻璃材质不干扰主体内容的表达，图标和辅助视觉元素需要进行「视觉退后」处理。

**AI 执行细则：**

- **单色默认态（Monochrome Baseline）：** 除非有特定的状态改变（如选中、警告、激活），工具栏和导航栏内的图标必须强制使用单色调（Monochrome/Grayscale）渲染，去掉一切渐变色和多色组合。
- **高振动色彩着色（Vibrant Tinting）：** 仅当面临「下一步核心行动（Call to Action）」或「强烈情感验证」（如新消息提示 Badge）时，才允许使用 Tint。且该颜色必须经过活力化处理（Vibrant Color Blending），使其在玻璃表面折射后依然能保持高饱和度与清晰度，而非死板的纯色填充。

---

## 2. 空间布局与视线引导 (Spatial Layout & Eye-Gaze Guidance)

### 技能：意图导向的操作物理隔离 (Semantic Spatial Grouping)

**设计原理与隐喻：** 格式塔心理学（Gestalt Principles）的邻近律应用。AI 需要通过空间距离直接向用户的大脑传递「操作属性」的归类，减少用户的认知负荷。

**AI 执行细则：**

- **强关联组合（Cohesive Clusters）：** 语义上互相支持的操作（例如「点赞」与「加入收藏」），AI 必须将它们放置在同一个封闭的流体玻璃容器内，共用一个背景轮廓。
- **弱关联隔离（Action Segregation）：** 对于全局性或完全独立的动作（如「分享」、「更多设置」），AI 必须在强关联组合之间插入一个明确的物理空隙（Fixed/Flexible Spacer），或将其直接移出玻璃背景，单独作为孤立的悬浮元素（Shared Background Visibility Control），从视觉上建立清晰的操作层级。

---

### 技能：动态画布延伸与视差模糊 (Visual Canvas Extension)

**设计原理与隐喻：** 消除边界感。当结构性导航（如左侧边栏）覆盖在主体内容（如精美的英雄大图 Banner）上时，传统的剪裁会破坏构图的宏伟感。

**AI 执行细则：**

- **镜像对称过渡（Artwork Mirroring）：** AI 在布局时，应将前景组件（如 Sidebar）遮挡住的背景图片区域向外（安全区域外）延伸。延伸出的部分不能是空白或纯黑，而是要将边缘图像进行水平/垂直镜像反射。
- **视差高斯模糊（Dynamic Gaussian Blur）：** 对镜像延伸出的艺术图内容应用高斯模糊，使其形成一个自然的色彩烟雾光晕（Halo Effect），既保证了前景文字的绝对可读性，又让背景艺术图在视觉上产生了跨越边界的无限延伸感。

---

## 3. 几何美学与数字量化规范 (Geometry & Digital Quantization)

### 技能：几何同心圆角对齐 (Corner Concentricity Computation)

**设计原理与隐喻：** 工业设计级的几何美学。当一个圆角内部嵌套另一个圆角时，如果两个圆角的半径差不等于它们的间距，就会产生「视觉冲突」（Visual Jarring）。

**AI 执行细则：**

- **同心圆心算法（Concentric Radius Formula）：** AI 在渲染嵌套结构（例如：在外层圆角曲率为 $R_{outer}$ 的模态卡片底部，放置一个圆角曲率为 $R_{inner}$ 的胶囊按钮，它们之间的物理间距为 $D$）时，必须确保：

$$R_{inner} = R_{outer} - D$$

以此保证内外两个圆角的几何中心点在二维空间中完全重合。

- **环境自适应形变（Responsive Geometry adaptation）：** UI 在小屏幕（iPhone）上应自动采用大曲率圆角以包裹设备物理屏幕的黑边；而在大屏幕（Mac/iPad）或密集视窗下，应自动收缩曲率，切换为高密度的圆角矩形（Rounded Rectangle），以保留水平方向的信息密度。

---

## 4. 连续性动效与形变机制 (Kinetic Continuity & Morphing Mechanics)

### 技能：拓扑结构形态渐变与重吸收 (Fluid Morphing & Reabsorption)

**设计原理与隐喻：** 视觉物质守恒定律。用户界面的状态切换不应该是无中生有的闪现（Instant Pop-up），所有新出现的界面元素都应该有其「物理前身」，即从触发它的源头演变而来。

**AI 执行细则：**

- **源点缩放动画（Source-Anchored Scaling）：** 当用户点击一个工具栏按钮唤起一个模态窗口（Sheet）或菜单时，新界面的物理边界必须以点击的按钮中心为原点，像水滴膨胀一样向外无缝形变放大（Morphing），而不是从屏幕底部生硬地推入。
- **液体化重吸收（Graceful Liquid Reabsorption）：** 当多个悬浮的子元素（如一组展开的勋章卡片）被关闭时，AI 必须计算各子元素的几何中心，应用液体融合动效，让它们在向中心聚拢的过程中「融合成一个大水滴」，最终平滑地被「重吸收（Reabsorbed）」回最初的触发按钮内部，彻底消失。

---

### 技能：多视窗全局采样同步 (Unified Glass-Effect Containerization)

**设计原理与隐喻：** 光学的物理一致性。由于流体玻璃需要折射周围物体的光线，如果每个组件各自为政，就会发生「A 玻璃照不出相邻 B 玻璃」的光学悖论。

**AI 执行细则：**

- **共享采样场（Shared Sampling Domain）：** 当布局中出现多个紧密相邻、甚至在动画中会发生碰撞重叠的玻璃组件时，AI 必须建立一个全局的采样容器（Unified Container Area）。
- **复合光影渲染（Composite Blending）：** 强制容器内所有独立的玻璃元素共享同一个背景像素采样缓冲区。这样，当组件 A 在动画中靠近组件 B 时，A 的边缘能够正确折射出 B 的外围色彩和光晕，从而在视觉上呈现出真正两块物理玻璃交织的真实光影效果。
