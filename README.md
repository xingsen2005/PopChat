# Pop Chat Desktop

一款功能完整的本地AI聊天桌面应用，基于Electron和React构建。支持多种AI服务提供商，包括深度求索(DeepSeek)、谷歌(Google)、OpenAI、Anthropic、xAI、智谱清言(Zhipu)、Kimi和火山引擎(Volcengine)。

## 功能特性

### 多服务商支持

- **DeepSeek（深度求索）** - DeepSeek Chat API
- **Google（谷歌）** - Gemini 系列模型
- **OpenAI** - GPT 系列模型
- **Anthropic** - Claude 系列模型
- **xAI** - Grok 系列模型
- **Z.AI（智谱清言）** - GLM 系列模型
- **Kimi（豆包）** - Moonshot AI 模型
- **doubao（火山引擎）** - 字节跳动方舟模型

### 核心功能

- **对话式AI** - 实时流式聊天响应，提供流畅的对话体验
- **模型管理** - 添加、编辑、启用/禁用多个AI模型
- **Token配额查询** - 查看剩余API额度（支持的服务商）
- **文件附件** - 支持在对话中附加本地文件
- **本地存储** - 对话记录和设置本地持久化存储
- **系统加密** - 使用操作系统级加密安全存储API密钥

### 用户体验

- **深色/浅色主题** - 自动检测系统主题或手动切换
- **键盘快捷键** - 快速访问（Ctrl+N: 新建对话，Ctrl+M: 模型管理，Ctrl+,: 设置）
- **规则和记忆** - 支持自定义对话规则和记忆上下文，允许针对单个模型额外配置
- **压缩上下文** - 支持压缩上下文，允许针对单个模型决定是否开启，避免超出Token限制
- **额度查询** - 支持查询剩余可用 Token 额度，对于无法查询的情况，记录累计已用 Token
- ** Markdown 渲染** - 用户友好 Markdown 和代码块显示

## 技术栈

| 分类 | 技术 |
|------|------|
| 桌面框架 | Electron 30 |
| 前端框架 | React 18 |
| 编程语言 | TypeScript |
| 构建工具 | Vite 5 |
| 样式框架 | Tailwind CSS 3 |
| 桌面打包 | electron-builder 24 |
| 图标库 | Lucide React |
| Markdown渲染 | react-markdown + remark-gfm |

## 环境要求

- **Node.js** 18.0 或更高版本
- **npm** 9.0 或更高版本
- **操作系统**: Windows 10+, macOS 10.15+, 或 Linux (Ubuntu 20.04+)

## 安装指南

### 1. 克隆仓库

```bash
git clone <repository-url>
cd PopChat
```

### 2. 安装依赖

```bash
npm install
```

### 3. 开发模式

```bash
npm run dev
```

这将启动开发服务器在 `http://localhost:5173` 并启动Electron应用。

### 4. 生产构建

```bash
npm run build
```

构建输出将位于 `dist/` 目录。

### 5. 打包为桌面应用

```bash
npm run package
```

这将在 `release/` 目录创建独立的可执行文件。

### 6. 一键打包编译（新手推荐）

项目提供了一键打包编译脚本 `build.ps1`，可以自动完成编译并输出到 `release-final` 文件夹：

```powershell
.\build.ps1
```

**注意**: 使用此脚本前必须安装 **Node.js（≥18.0）**。运行脚本后，编译产物将自动输出到 `release-final/` 目录。

## 项目结构

```
PopChat/
├── scripts/
│   ├── build.mjs          # 构建脚本
│   └── dev.mjs            # 开发脚本
├── src/
│   ├── components/        # React UI组件
│   │   ├── ChatArea.tsx       # 主聊天界面
│   │   ├── ModelConfigModal.tsx
│   │   ├── ModelManagement.tsx
│   │   ├── SettingsPanel.tsx
│   │   └── Sidebar.tsx
│   ├── types/
│   │   └── index.ts       # TypeScript类型定义
│   ├── utils/
│   │   ├── api.ts         # API工具函数
│   │   └── storage.ts     # 本地存储工具
│   ├── App.tsx            # 主应用组件
│   ├── main.tsx           # React入口文件
│   ├── main.ts            # Electron主进程
│   ├── preload.js         # 预加载脚本（IPC桥接）
│   └── index.css          # 全局样式
├── build.ps1              # 一键打包编译脚本
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── postcss.config.js
```

## 配置说明

### 添加AI模型

1. 点击侧边栏中的 **模型** 标签
2. 点击 **添加模型** 按钮
3. 配置以下信息：
   - **服务商**: 选择您的AI服务商
   - **模型名称**: 模型的显示名称
   - **API密钥**: 您从服务商获取的API密钥
   - **模型ID**: 特定的模型标识符（例如 `gpt-4`, `claude-3-5-sonnet-20241022`）
   - **自定义端点**（可选）: 覆盖默认API端点

### 各服务商支持的模型ID

| 服务商 | 示例模型ID |
|--------|-----------|
| DeepSeek | `deepseek-chat`, `deepseek-coder` |
| Google | `gemini-1.5-pro`, `gemini-1.5-flash` |
| OpenAI | `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo` |
| Anthropic | `claude-sonnet-4-20250514`, `claude-3-5-sonnet-20241022` |
| xAI | `grok-2`, `grok-2-vision` |
| Z.AI | `glm-4`, `glm-4-flash` |
| Kimi | `kimi-chat` |
| doubao | `doubao-lite-4k` |

### 设置选项

通过侧边栏中的 **设置** 标签访问设置：

- **主题**: 浅色、深色或系统（自动检测）
- **自动更新**: 启用/禁用自动更新通知
- **紧凑模式**: 切换紧凑UI布局

## API集成

应用通过Electron主进程与AI服务商通信，确保安全性。所有API密钥在本地持久化之前都会使用操作系统的安全存储进行加密。

### 支持的API端点

| 服务商 | 基础URL |
|--------|--------|
| DeepSeek | `https://api.deepseek.com` |
| Google | `https://generativelanguage.googleapis.com` |
| OpenAI | `https://api.openai.com` |
| Anthropic | `https://api.anthropic.com` |
| xAI | `https://api.x.ai` |
| Z.AI | `https://open.bigmodel.cn/api/paas/v4` |
| Kimi | `https://api.moonshot.cn/v1` |
| doubao | `https://ark.cn-beijing.volces.com/api/v3` |

## 键盘快捷键

| 快捷键 | 操作 |
|--------|------|
| `Ctrl+N` / `Cmd+N` | 新建对话 |
| `Ctrl+M` / `Cmd+M` | 切换模型面板 |
| `Ctrl+,` / `Cmd+,` | 切换设置面板 |

## 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开 Pull Request

### 开发规范

- 遵循TypeScript最佳实践
- 使用函数组件和hooks
- 保持与现有代码库一致的代码风格
- 编写描述性的提交信息

## 许可证

本项目采用 **GPL-3.0** 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 支持与帮助

如果您遇到任何问题或有疑问：

1. 查看 [Issues](https://github.com/your-repo/issues) 页面
2. 创建新的issue并提供详细信息
3. 包含复现步骤、预期行为和实际行为

## 致谢

- [Electron](https://www.electronjs.org/) - 桌面应用框架
- [React](https://react.dev/) - UI库
- [Vite](https://vitejs.dev/) - 下一代前端构建工具
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先的CSS框架
- [Lucide](https://lucide.dev/) - 美观且一致的图标集

---

**注意**: 本应用需要有效的 AI 服务提供商 API 密钥。请参考各服务商的文档获取 API 密钥，并了解其使用政策和定价。输出结果由对应大模型决定，我们不对任何输出结果负责。
