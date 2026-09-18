<p align="center">
  <img src="web/public/logo.svg" width="96" alt="OpenCanvas logo">
</p>

<h1 align="center">OpenCanvas</h1>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-f97316?style=flat-square" alt="License"></a>
  <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-7-646cff?style=flat-square&logo=vite&logoColor=white" alt="Vite"></a>
  <a href="https://reactrouter.com/"><img src="https://img.shields.io/badge/React_Router-7-ca4245?style=flat-square&logo=reactrouter&logoColor=white" alt="React Router"></a>
</p>

<p align="center">
  <a href="docs/content/docs/overview/quick-start.mdx">快速开始</a> ·
  <a href="docs/content/docs/overview/features.mdx">功能介绍</a> ·
  <a href="docs/content/docs/canvas/canvas-node-manual.mdx">画布节点操作手册</a> ·
  <a href="docs/content/docs/canvas/canvas-shortcuts.mdx">画布快捷键</a> ·
  <a href="docs/content/docs/development/local-canvas-mcp.mdx">本地画布 MCP</a> ·
  <a href="SECURITY.md">漏洞提交</a>
</p>

OpenCanvas 是一款面向图片创作的开源工作台。它把画布编排、AI 图片 / 视频 / 音频生成、参考图编辑、提示词库和素材沉淀放在同一个界面里，适合用来探索视觉方案并连续迭代结果。

> [!CAUTION]
> 项目目前处于开发阶段，不保证历史数据兼容。各种本地存储格式都可能直接调整，欢迎关注后续更新。
>
> 如果你需要稳定维护自己的分支，建议自行 fork 后独立开发。二次开发与 PR 请保留原作者信息和前端页面标识。

## 核心功能

- **画布编辑**：多画布与库管理、节点拖拽缩放、连线、小地图、撤销重做、锁定隐藏、对齐分布、坐标标尺与 16px 网格吸附，支持整包导出 / 导入（zip，含全部图片、视频、音频资源）。
- **AI 生成**：浏览器前台直连 OpenRouter（OpenAI 兼容接口），支持文生图、图生图 / 参考图编辑、文本生成、视频生成以及音频 / 语音 / 音乐生成。
- **画布节点**：文本、提示词（含音乐提示词、语音提示词）、图片、视频、音频、生成配置、图片生成、语音生成、音乐生成、智能画布、资源、录音、图片修饰。
- **图片工具**：裁剪、分割（本地 MobileSAM）、蒙版编辑、分辨率调整、背景移除、图片分析（主色 / EXIF / 感知哈希）、识别文字与视频帧截取。
- **智能画布**：固定比例画板，支持 1K / 2K / 4K 合成、背景与不透明度、图层顺序与混合模式、文本标注、一键排版模板、嵌套画板，以及合成预览 / 存为图片节点。
- **本地 MCP**：前端服务（`npm run dev` / `npm run start`）在同一端口 `3000` 同时提供浏览器桥接和 HTTP MCP 端点（`/mcp`），网页同源自动连接，任意支持 MCP 的客户端（如 opencode）都能读写当前已打开的画布。
- **插件系统**：支持通过 URL 动态安装 / 启用 / 更新 / 卸载远程节点插件，并提供 TypeScript SDK 自行开发画布节点插件。
- **提示词与素材**：内置 7 个开源提示词来源并支持自定义标准 JSON 来源，由浏览器前端直连并缓存到 IndexedDB；「我的素材」提供本地素材库。

完整功能说明见 [功能介绍](docs/content/docs/overview/features.mdx)。

## 快速开始

```bash
git clone git@github.com:AntarcticBearHKL/Oh-My-OpenCanvas.git
cd Oh-My-OpenCanvas/web
bun install
bun run dev
```

运行后默认端口 3000，可访问 `http://localhost:3000`。

## 配置

- 首次打开后进入右上角设置，填入 OpenRouter 的 API Key。
- API Key、画布项目、素材和生成记录默认保存在浏览器本地，由前端直接请求 `https://openrouter.ai/api/v1`，不经过项目服务器。

## 文档

- [快速开始](docs/content/docs/overview/quick-start.mdx)
- [功能介绍](docs/content/docs/overview/features.mdx)
- [画布节点操作手册](docs/content/docs/canvas/canvas-node-manual.mdx)
- [画布快捷键](docs/content/docs/canvas/canvas-shortcuts.mdx)
- [本地画布 MCP 连接原理](docs/content/docs/development/local-canvas-mcp.mdx)
- [画布数据结构](docs/content/docs/development/canvas-data-structure.mdx)
- [待办事项](docs/content/docs/progress/todo.mdx) · [待测试](docs/content/docs/progress/pending-test.mdx)

## 社区支持

学 AI，上 L 站：[LinuxDO](https://linux.do/)

点击链接加入群聊【开源 OpenCanvas(2群)】：https://qm.qq.com/q/HRt2kUnYiG

## 开源协议

本项目使用 [MIT License](LICENSE)。任何人都可以免费使用、复制、修改、分发、再授权和商业使用本项目，也可以用于闭源产品。
