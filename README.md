# Meowdoku · 猫咪数独

一款轻量、可爱的猫咪逻辑益智游戏。玩家需要根据棋盘区域和位置规则，找出所有藏起来的猫咪。

项目使用 Vite、TypeScript 和原生 CSS 开发，同时提供一个原生 Android WebView 壳，可构建为 APK。

## 游戏规则

### 方形棋盘

- 每一行恰好藏有一只猫咪。
- 每一列恰好藏有一只猫咪。
- 每个彩色区域恰好藏有一只猫咪。
- 两只猫咪不能在相邻格子中接触，包括斜角方向。
- 标记确定没有猫咪的格子，找出全部猫咪即可过关。

### 六边形棋盘

- 棋盘每边包含 5 至 9 个六边形格子。
- 每条三组轴向直线最多藏有一只猫咪。
- 每个彩色区域恰好藏有一只猫咪。
- 猫咪周围相邻的六边形格子不能再有猫咪。

## 功能特色

- 1000 个 5 × 5 至 9 × 9 的主线关卡。
- 1000 个六边形主线关卡：前 20 关为边长 5 的简单关，后续关卡固定随机分布在边长 6 至 8。
- 每个六边形关卡都包含不超过 3 格的小色块和完整落在同一轴线上的色块，提供明确的开局规律。
- 每日挑战池包含 200 个 9 × 9 方形关和 200 个边长 8 至 9 的六边形关。
- 每天从尚未通关的每日挑战中随机选题；400 关全部通过后，完整题库会重新进入随机池。
- 离线生成并固化关卡，失败重试始终复用当前棋盘。
- 精确求解器逐关验证唯一解，逻辑求解器逐关验证可通过推论 0-4 解出。
- 棋盘提示会高亮一个可推导格子并解释原因。
- “找到猫”按钮可以直接揭开一只尚未发现的猫。
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

# 重新离线生成 1000 个方形主线关、400 个每日挑战和 1000 个六边形主线关
npm run generate:levels

# 本地预览构建结果
npm run preview
```

Web 构建产物会生成在 `dist/` 目录中。

预生成关卡保存在 `src/levels.generated.json`。生成脚本使用固定 seed 顺序，方形关卡只收录唯一解且能由推论 0-4 完成的题目；方形挑战关还必须使用推论 4。六边形主线和每日挑战由独立的三轴求解器逐关验证唯一解。

## Android 构建

Android 工程位于 `android/`，需要安装 JDK、Android SDK 和 Gradle。

在项目根目录执行一键打包脚本：

```bash
npm run android
```

也可以直接运行：

```bash
./scripts/build-android.sh
```

脚本会依次运行测试、构建 Web 资源、同步 Android 内嵌资源、自动递增 `versionCode` 和 `versionName` 的补丁版本，并构建、校验 Debug 和 Release APK。生成的 APK 位于：

```text
android/app/build/outputs/apk/debug/app-debug.apk
android/app/build/outputs/apk/release/app-release.apk
```

仓库中的 `releases/` 目录用于保存对外发布的 APK 文件。

## 项目结构

```text
.
├── src/                         # 游戏逻辑、推理器、关卡库、界面和音频代码
├── scripts/generate-levels.mjs # 离线关卡生成与筛选脚本
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
