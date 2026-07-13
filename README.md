# rainy-window-editor

雨夜车窗氛围生成器。上传你的背景图/视频，调节雨滴、雾气与折射，叠加可拖拽文字，导出情绪化氛围画面。

![screenshot](assets/screenshot.png)

## 功能亮点
- **WebGL 实时雨滴折射**：自定义 fragment shader 实现 RGB 色差折射 + LOD 分级
- **Bokeh 径向失焦**：大水珠边缘与雾气区域模拟真实景深虚化
- **Procedural 微水珠层**：shader 内高密度静态微水珠，与 CPU 绘制的大/中水珠互补
- **雨夜湿润化后处理**：降饱和、选择性调色、底部反光、大气雨雾、动态暗角
- **闪电效果**：随机闪烁，支持开关
- **鼠标视差 + 镜头缩放**：背景随鼠标偏移，Zoom 缩放玻璃（长焦/广角）
- **可折叠玻璃态控制面板**
- **图片/视频背景**（cover / stretch 适配）
- **可拖拽、双击编辑的文字排版层**
- **导出 PNG**（含文字合成）

## 技术栈
p5.js (WEBGL + custom Shader) + HTML5 DOM Overlay + Vanilla JS

## 快速开始
```bash
python3 -m http.server 3000
# 访问 http://localhost:3000
```

## 文档目录

| 文件 | 内容 |
|------|------|
| [`docs/01-项目概述.md`](docs/01-项目概述.md) | 项目灵感、核心体验、当前功能、技术架构 |
| [`docs/02-架构决策.md`](docs/02-架构决策.md) | 技术选型理由与权衡（p5.js/Three.js、CPU/GPU、DOM/Canvas 等） |
| [`docs/03-开发日志.md`](docs/03-开发日志.md) | 按时间线的完整迭代记录（2026-07-11 ~ 2026-07-13） |
| [`docs/04-API文档.md`](docs/04-API文档.md) | 全局配置、类公共方法、Shader Uniforms 清单 |
| [`docs/05-算法规范.md`](docs/05-算法规范.md) | 技术规则与视觉规范（法线生成、性能、折射、物理、雾气等） |
| [`docs/06-已知问题.md`](docs/06-已知问题.md) | 踩坑记录与根因分析（WebGL 崩溃、性能危机、果冻颗粒等） |
| [`docs/07-使用手册.md`](docs/07-使用手册.md) | 用户操作指南：上传、调参、文字排版、导出 |

## Credits
- **项目发起**：基于 vibe coding 雨天编辑器灵感
- **参考实现**：借鉴 [rocksdanister/rain](https://github.com/rocksdanister/rain) 的雾化、失焦、镜头与交互思路
- **代码实现**：Claude (Anthropic)
