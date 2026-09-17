# MakeGIF | Free Online Video to GIF Converter

[![Astro 5](https://img.shields.io/badge/Astro-5.x-BC52EE?style=flat-square&logo=astro&logoColor=white)](https://astro.build)
[![React 19](https://img.shields.io/badge/React-19.x-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![WebAssembly](https://img.shields.io/badge/Engine-FFmpeg.wasm-654FF0?style=flat-square&logo=webassembly&logoColor=white)](https://ffmpegwasm.netlify.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-8B9A6E?style=flat-square)](LICENSE)

An ultra-minimal, high-performance, 100% browser-based Video to GIF converter. Convert MP4, WebM, MOV, and M4V videos into crisp, lightweight animated GIFs directly inside your browser using **React 19** and **FFmpeg.wasm**.

**Live Website**: [https://makegif.github.io/](https://makegif.github.io/)  
**Developer Support**: [Buy Me a Coffee](https://buymeacoffee.com/kisharadilz)

---

## ✨ Features

- **100% Client-Side Privacy**: Your video files never leave your computer or phone. Zero server uploads, zero cloud tracking.
- **Dual-Pass High Fidelity Palette Generation**: Uses Lanczos scaling and two-pass adaptive color palette optimization (`palettegen` / `paletteuse`) for rich colors without dithering artifacts.
- **Synchronized Video Trimmer**: Real-time HTML5 `<video>` preview with seek synchronization, scrub bar, and instant "Set to Current Frame" buttons.
- **Fine-Grained Controls**:
  - **Framerate (FPS)**: `10` (compact), `15` (balanced), `20`, `24` (cinematic), `30` (ultra-smooth).
  - **Resolution**: `320px`, `480px`, `640px`, `800px`, and `Original Width`.
  - **Playback Speed**: `1.0x` (normal), `1.5x` (fast), `2.0x` (double).
- **Direct Export & Clipboard**: Download generated GIFs directly or copy them to your clipboard with a single click.
- **Complete 6-Language Localization**:
  - English (`/`)
  - Español (`/es/`)
  - Português (`/pt/`)
  - Deutsch (`/de/`)
  - Français (`/fr/`)
  - 日本語 (`/ja/`)
- **Theme Switcher**: Instant light/dark mode toggle with a synchronous anti-FOUC script preventing theme flickering.
- **Icon-Only Mobile/Tablet Header**: Clean, clutter-free top bar on small screens and tablets.
- **100% Technical SEO Architecture**:
  - Multi-entity JSON-LD structured data (`WebApplication`, `Organization`, `BreadcrumbList`, `HowTo`, `FAQPage`).
  - Automated XML sitemap (`sitemap-index.xml`) with bidirectional `xhtml:link` hreflang tags for all 6 languages.
  - Dedicated Open Graph & Twitter cards (1200×630px).
  - Google Analytics (`gtag.js`) integration.

---

## 🛠️ Technical Stack

- **Framework**: [Astro 5 (SSG mode)](https://astro.build/)
- **Interactive UI**: [React 19](https://react.dev/) (Astro Islands with `client:load`)
- **Video Processing Engine**: [@ffmpeg/ffmpeg](https://www.npmjs.com/package/@ffmpeg/ffmpeg) & [@ffmpeg/core](https://www.npmjs.com/package/@ffmpeg/core) (v0.12.10 WebAssembly single-threaded)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with class-based dark mode
- **Color Palette**:
  - Sage Green: `#8B9A6E`
  - Warm Ivory: `#F7F2EB`
  - Warm Border: `#EAE2D6`
  - Muted Neutral: `#EEEEEE`
  - Coffee Yellow: `#FFDD00`
- **Icons**: [Lucide React](https://lucide.dev/)

---

## 📁 Project Structure

```
makegif.github.io/
├── .github/
│   └── workflows/
│       └── deploy.yml              # Automated GitHub Pages CI/CD pipeline
├── public/
│   ├── favicon.svg                 # Brand icon
│   ├── robots.txt                  # Robots crawler directives & sitemap links
│   ├── coi-serviceworker.js        # Cross-origin isolation service worker
│   └── ffmpeg/                     # Bundled WASM core (ffmpeg-core.js & .wasm)
├── src/
│   ├── components/
│   │   ├── Header.astro            # Sticky header with responsive controls
│   │   ├── Footer.astro            # Multi-language directory & footer
│   │   ├── ThemeToggle.astro       # Instant theme toggle
│   │   ├── LanguagePicker.astro    # 6-locale switcher with flag icons
│   │   ├── Features.astro          # Value proposition grid
│   │   ├── HowItWorks.astro        # 3-step visual workflow
│   │   ├── Faq.astro               # Native <details>/<summary> accordion FAQs
│   │   ├── SupportBanner.astro     # Buy Me a Coffee callout
│   │   └── GifWorkspace.tsx        # React 19 interactive conversion island
│   ├── i18n/
│   │   ├── ui.ts                   # Complete dictionaries for en, es, pt, de, fr, ja
│   │   └── utils.ts                # Routing and localization helpers
│   ├── layouts/
│   │   └── Layout.astro            # Master layout: anti-FOUC, hreflangs, JSON-LD, Analytics
│   ├── pages/
│   │   ├── index.astro             # English root page (/)
│   │   ├── [lang]/
│   │   │   └── index.astro         # Subpath pages (/es/, /pt/, /de/, /fr/, /ja/)
│   │   └── 404.astro               # Custom 404 page
│   └── styles/
│       └── global.css              # Custom styling & scrollbar design
├── astro.config.mjs                # Astro configuration (React, Tailwind, Sitemap, i18n)
├── tailwind.config.mjs             # Tailwind CSS custom palette
├── tsconfig.json                   # Strict TypeScript settings
└── package.json                    # Project scripts and dependencies
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18.14.1 or higher, recommended v20+)
- `npm` (v9+)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/makegif/makegif.github.io.git
   cd makegif.github.io
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the local development server with cross-origin isolation enabled:

```bash
npm run dev
```

Open [http://localhost:4321](http://localhost:4321) in your browser.

### Building for Production

Build the static website (all 6 localized versions and XML sitemaps will be generated into the `dist/` directory):

```bash
npm run build
```

Preview the static production build locally:

```bash
npm run preview
```

---

## 🚢 Deployment

The repository includes a GitHub Actions workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) that automatically builds the Astro site and deploys it to **GitHub Pages** whenever changes are pushed to the `main` branch.

To enable GitHub Pages:
1. Go to your repository **Settings** > **Pages**.
2. Under **Build and deployment** > **Source**, select **GitHub Actions**.
3. Push to `main` — the workflow will compile and publish the site automatically.

---

## ☕ Support the Developer

MakeGIF is free, open-source, and maintained independently without intrusive ads or tracking. If this tool saved you time, consider supporting the developer:

👉 **[Buy Me a Coffee](https://buymeacoffee.com/kisharadilz)**

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
