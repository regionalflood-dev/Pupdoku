# Meowdoku · 猫咪数独

一款轻量、可爱的猫咪逻辑益智游戏。玩家需要根据棋盘区域和位置规则，找出所有藏起来的猫咪。

项目使用 Vite、TypeScript 和原生 CSS 开发，同时提供一个原生 Android WebView 壳，可构建为 APK。

## 游戏规则

- 每一行恰好藏有一只猫咪。
- 每一列恰好藏有一只猫咪。
- 每个彩色区域恰好藏有一只猫咪。
- 两只猫咪不能在相邻格子中接触，包括斜角方向。
- 标记确定没有猫咪的格子，找出全部猫咪即可过关。

## 功能特色

- 5 × 5 至 9 × 9 的渐进式关卡。
- 简单、普通、困难三种难度。
- 随机生成且可复现的谜题，完整关卡在相同 seed 下保持一致。
- 精确求解器逐关验证唯一解，并用固定初始标记消除候选布局中的歧义。
- 初始标记、错误次数与计时统计。
- 一至三星的关卡评价。
- 背景音乐与操作音效。
- 响应式布局，支持桌面端和移动端。
- 可打包为 Android 应用。

## 技术栈

- [Vite](https://vite.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vitest](https://vitest.dev/)
- 原生 HTML、CSS 与 Web Audio API
- Android WebView

## 本地运行

需要安装 Node.js 18 或更高版本。

```bash
npm install
npm run dev
```

启动后，打开终端中 Vite 输出的本地地址即可游玩。

## 测试与构建

```bash
# 运行单元测试
npm test

# 构建 Web 版本
npm run build

# 本地预览构建结果
npm run preview
```

Web 构建产物会生成在 `dist/` 目录中。

## Android 构建

Android 工程位于 `android/`，需要安装 JDK、Android SDK 和 Gradle。

先构建 Web 资源，并将 `dist/` 中的内容同步到：

```text
android/app/src/main/assets/
```

然后执行：

```bash
cd android
gradle assembleDebug
```

生成的 APK 位于：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

仓库中的 `releases/` 目录用于保存对外发布的 APK 文件。

## 项目结构

```text
.
├── src/                         # 游戏逻辑、界面和音频代码
├── public/audio/                # Web 音频资源
├── android/                     # Android WebView 工程
├── releases/                    # 可对外发布的 APK
├── index.html                   # Web 入口
├── package.json                 # npm 脚本与依赖
└── vite.config.ts               # Vite 配置
```

## 发布到 GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-github-repository-url>
git push -u origin main
```

发布前请确认仓库中不包含密钥、签名文件或其他敏感信息。当前 Android Release 构建使用调试签名，仅适合测试和演示；正式上架时请改用自己的 Release 签名。

## License

本项目暂未声明开源许可证。若希望他人使用、修改或分发代码，请在公开仓库前添加合适的 `LICENSE` 文件。
