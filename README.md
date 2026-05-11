# Pop Chat Desktop

A feature-complete local AI chat desktop application built with Electron and React. Supports multiple AI providers including DeepSeek, Google, OpenAI, Anthropic, xAI, 智谱清言 (Zhipu), Kimi, and 火山引擎 (Volcengine).

## Features

### Multi-Provider Support
- **DeepSeek** - DeepSeek Chat API
- **Google** - Gemini models
- **OpenAI** - GPT models
- **Anthropic** - Claude models
- **xAI** - Grok models
- **Z.AI (Zhipu)** - GLM models
- **Kimi** - Moonshot AI models
- **doubao (Volcengine)** - ByteDance Ark models

### Core Functionality
- **Conversational AI** - Real-time streaming chat responses
- **Model Management** - Add, edit, enable/disable multiple AI models
- **Token Quota Checking** - View remaining API credits (supported providers)
- **File Attachments** - Attach local files to conversations
- **Local Storage** - Conversations and settings persisted locally
- **System Encryption** - Secure API key storage using OS-level encryption

### User Experience
- **Dark/Light Theme** - Automatic system theme detection or manual toggle
- **Keyboard Shortcuts** - Quick access (Ctrl+N: new conversation, Ctrl+M: models, Ctrl+,: settings)
- **Auto-Update** - Automatic update notifications and installation
- **Markdown Rendering** - Beautiful markdown and code block display

## Tech Stack

| Category | Technology |
|----------|------------|
| Desktop Framework | Electron 30 |
| Frontend Framework | React 18 |
| Language | TypeScript |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS 3 |
| Desktop Builder | electron-builder 24 |
| Icons | Lucide React |
| Markdown | react-markdown + remark-gfm |

## Prerequisites

- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **Operating System**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 20.04+)

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd PopChat
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Development Mode
```bash
npm run dev
```
This will start the development server at `http://localhost:5173` and launch the Electron app.

### 4. Build for Production
```bash
npm run build
```
Output will be in the `dist/` directory.

### 5. Package as Desktop Application
```bash
npm run package
```
This will create a standalone executable in the `release/` directory.

## Project Structure

```
PopChat/
├── scripts/
│   ├── build.mjs          # Build script
│   └── dev.mjs            # Development script
├── src/
│   ├── components/        # React UI components
│   │   ├── ChatArea.tsx       # Main chat interface
│   │   ├── ModelConfigModal.tsx
│   │   ├── ModelManagement.tsx
│   │   ├── SettingsPanel.tsx
│   │   └── Sidebar.tsx
│   ├── types/
│   │   └── index.ts       # TypeScript type definitions
│   ├── utils/
│   │   ├── api.ts         # API utility functions
│   │   └── storage.ts     # Local storage utilities
│   ├── App.tsx            # Main application component
│   ├── main.tsx           # React entry point
│   ├── main.ts            # Electron main process
│   ├── preload.js         # Preload script (IPC bridge)
│   └── index.css          # Global styles
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── postcss.config.js
```

## Configuration

### Adding AI Models

1. Click the **Models** tab in the sidebar
2. Click **Add Model** button
3. Configure the following:
   - **Provider**: Select your AI provider
   - **Model Name**: Display name for the model
   - **API Key**: Your API key from the provider
   - **Model ID**: The specific model identifier (e.g., `gpt-4`, `claude-3-5-sonnet-20241022`)
   - **Custom Endpoint** (optional): Override default API endpoint

### Supported Model IDs by Provider

| Provider | Example Model IDs |
|----------|-------------------|
| DeepSeek | `deepseek-chat`, `deepseek-coder` |
| Google | `gemini-1.5-pro`, `gemini-1.5-flash` |
| OpenAI | `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo` |
| Anthropic | `claude-sonnet-4-20250514`, `claude-3-5-sonnet-20241022` |
| xAI | `grok-2`, `grok-2-vision` |
| Z.AI | `glm-4`, `glm-4-flash` |
| Kimi | `kimi-chat` |
| doubao | `doubao-lite-4k` |

### Settings

Access settings via the **Settings** tab in the sidebar:

- **Theme**: Light, Dark, or System (auto-detect)
- **Auto-Update**: Enable/disable automatic update notifications
- **Compact Mode**: Toggle compact UI layout

## API Integration

The application communicates with AI providers through the Electron main process for security. All API keys are encrypted using the operating system's secure storage before being persisted locally.

### Supported API Endpoints

| Provider | Base URL |
|----------|----------|
| DeepSeek | `https://api.deepseek.com` |
| Google | `https://generativelanguage.googleapis.com` |
| OpenAI | `https://api.openai.com` |
| Anthropic | `https://api.anthropic.com` |
| xAI | `https://api.x.ai` |
| Z.AI | `https://open.bigmodel.cn/api/paas/v4` |
| Kimi | `https://api.moonshot.cn/v1` |
| doubao | `https://ark.cn-beijing.volces.com/api/v3` |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` / `Cmd+N` | Create new conversation |
| `Ctrl+M` / `Cmd+M` | Toggle models panel |
| `Ctrl+,` / `Cmd+,` | Toggle settings panel |

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Use functional components with hooks
- Maintain consistent code style with existing codebase
- Write descriptive commit messages

## License

This project is licensed under the **GPL-3.0** License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/your-repo/issues) page
2. Create a new issue with detailed information
3. Include steps to reproduce, expected behavior, and actual behavior

## Acknowledgments

- [Electron](https://www.electronjs.org/) - Desktop application framework
- [React](https://react.dev/) - UI library
- [Vite](https://vitejs.dev/) - Next-generation frontend build tool
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Lucide](https://lucide.dev/) - Beautiful & consistent icon set

---

**Note**: This application requires valid API keys from AI service providers. Please refer to each provider's documentation for obtaining API keys and understanding their usage policies and pricing.
