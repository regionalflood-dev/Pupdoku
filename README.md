# Pupdoku · Ciri Pup

A lightweight, adorable cat-themed logic puzzle game. Players must find all the hidden cats based on grid colored regions and positional rules.

The project is developed using Vite, TypeScript, and native CSS. It also includes a native Android WebView wrapper that can be built into an APK.

## Game Rules

### Square Board

- Exactly one cat is hidden in each row.
- Exactly one cat is hidden in each column.
- Exactly one cat is hidden in each colored region.
- Two cats cannot touch each other in adjacent cells, including diagonally.
- Mark cells where you are certain there is no cat, and find all cats to pass the level.

### Hexagonal Board

- Each side of the board contains 5 to 9 hexagonal cells.
- Each straight line along the three grid axes can hide at most one cat.
- Exactly one cat is hidden in each colored region.
- No other cats are allowed in the hexagonal cells immediately surrounding a cat.

## Features

- **1,000 Main Levels:** Ranging from 5 × 5 to 9 × 9 grid sizes.
- **1,000 Hexagonal Main Levels:** The first 20 levels serve as easy tutorials with a side length of 5; subsequent levels are randomly distributed across side lengths of 6 to 8.
- **Clear Openings:** Each hexagonal level includes small colored blocks (no larger than 3 cells) or colored shapes that fall completely along a single axis line, providing clear opening patterns to start solving.
- **Daily Challenge Pool:** Features 200 square levels (9 × 9) and 200 hexagonal levels (side length 8 to 9).
- **Smart Rotation:** Daily questions are selected at random from the pool of uncompleted challenges. Once all 400 levels are completed, the full library re-enters the random pool.
- **Offline Generation:** Levels are generated offline and persist, ensuring the current board layout is fully reused when retrying a failed attempt.
- **Dual-Solver Verification:** An exact solver verifies a unique solution for each level, while a logic solver ensures levels can be solved progressively using core deduction rules (Inference levels 0-4).
- **In-Game Hints:** The hint system highlights a deducible cell and explains the reasoning behind the move.
- **"Find Cat" Action:** A dedicated helper button reveals an undiscovered cat on the spot.
- **Stat Tracking:** Includes metrics for initial markers, mistake counters, and completion timers.
- **Star Ratings:** Performance evaluation ranging from 1 to 3 stars per level.
- **Audio Feedback:** Immersive background music and operational sound effects.
- **Responsive Design:** Fully fluid layout built for both desktop browsers and mobile devices.
- **Mobile Support:** Ready to be packaged as a standalone Android application.

## Tech Stack

- [Vite](https://vite.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vitest](https://vitest.dev/)
- Native HTML, CSS, and Web Audio API
- Android WebView

## Local Development

Node.js 18 or higher is required to run the project.

```bash
npm install
npm run dev
```

Once started, open the local URL printed by Vite in your terminal to start playing.

## Testing & Production Build

```bash
# Run unit tests
npm test

# Build the Web version
npm run build

# Regenerate the 1,000 main square levels, 400 daily challenges, and 1,000 main hexagonal levels offline
npm run generate:levels

# Locally preview the production build
npm run preview
```

The Web build output will be compiled into the `dist/` directory.

Pre-generated levels are saved in `src/levels.generated.json`. The generation script utilizes a fixed seed order. For square levels, the script only accepts boards that feature a unique solution and can be fully completed using deduction rules 0 to 4. Square daily challenge maps carry an additional requirement to explicitly require deduction rule 4. Hexagonal main maps and daily challenges are checked and verified for unique solutions using an independent, three-axis solver engine.

## Android Building

The Android project codebase is located in the `android/` directory. Building requires JDK, the Android SDK, and Gradle to be installed on your machine.

You can execute the automated one-click build routine directly from the project root:

```bash
npm run android
```

Alternatively, you can run the shell script manually:

```bash
./scripts/build-android.sh
```

The automation toolchain will sequentially execute testing modules, bundle production Web assets, synchronize web assets into the Android native envelope, automatically increment patch versions for both `versionCode` and `versionName`, and assemble and sign verified Debug and Release APK binaries. Output packages will be stored at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
android/app/build/outputs/apk/release/app-release.apk
```

The `releases/` directory in the repository is intended for managing public distribution binaries.

## Project Structure

```text
.
├── src/                         # Game logic, logic solvers, level library, UI view, and audio logic
├── scripts/generate-levels.mjs # Offline level generation and selection script
├── public/audio/                # Web Audio API assets
├── android/                     # Android WebView native application wrapper
├── releases/                    # Public distribution release APKs
├── index.html                   # Web application entry point
├── package.json                 # npm automation scripts and project dependencies
└── vite.config.ts               # Vite bundler configurations
```

## Publishing to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-github-repository-url>
git push -u origin main
```

Before pushing to a public repository, ensure that your commits do not include any access keys, keystores, credential configuration files, or other sensitive personal metadata. The current Android Release build profile uses a default debug signature profile, which is intended solely for local environments, ad-hoc testing, and development showcases. Please swap this for your private release signing keystore configuration prior to publishing onto commercial application stores.

## License

This project does not currently declare an open-source license. If you intend to authorize other developers to legally use, alter, compile, or redistribute this codebase, consider placing an appropriate `LICENSE` configuration file into the root of the project structure prior to moving the repository to a public visibility state.
