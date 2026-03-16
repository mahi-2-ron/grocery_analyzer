# 🧬 PureScan — AI-Powered Food Ingredient Analyzer

> A hybrid-intelligence food safety auditor that uses **DeepSeek AI**, **Google Gemini**, and an **on-device local database** to analyze food ingredients for health risks — instantly.

![React](https://img.shields.io/badge/React-18-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5-purple?logo=vite)
![DeepSeek](https://img.shields.io/badge/DeepSeek-AI-green)
![Gemini](https://img.shields.io/badge/Google_Gemini-Vision-orange)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## 🔬 What is PureScan?

PureScan is a **multi-model bio-audit pipeline** that scans food ingredient labels and generates a detailed health report. It works in three modes:

| Mode | How It Works | Best For |
|------|-------------|----------|
| 📸 **Vision Audit** | Upload a photo of an ingredient label → Gemini Vision reads it → AI analyzes it | Product labels, packaging |
| 📝 **Text Audit** | Paste raw ingredients → DeepSeek AI returns a full JSON report | Copy-pasted ingredient lists |
| 🧠 **Local Intel** | On-device database with 50+ hazardous additives scans the text locally | Offline use, API failures |

---

## ✨ Key Features

- **🤖 Triple-Engine Intelligence** — DeepSeek AI → Gemini Vision → Local Database fallback chain
- **📊 Health Scoring** — Dynamic 0–100 health index based on ingredient severity
- **🔍 Deep Ingredient Analysis** — Each ingredient is categorized with risk level, health impact, daily limits, and alternatives
- **📷 Image OCR Pipeline** — If Gemini Vision fails, Tesseract.js performs local OCR and sends text to DeepSeek
- **⚡ Instant Local Fallback** — 50+ pre-loaded high-risk additives (BHA, BHT, Aspartame, Red 40, HFCS, etc.) ensure results even without internet
- **🎨 Premium UI** — Glassmorphism, smooth Framer Motion animations, mobile-first responsive design
- **🔐 API Key Management** — Store Gemini and DeepSeek keys locally via the in-app Settings panel

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│              PureScan v3.8                   │
│         Master Audit Pipeline               │
├─────────────────────────────────────────────┤
│                                             │
│  📸 Image Input ──► Gemini Vision API       │
│        │              (Multi-Model Retry)   │
│        │ FAIL                               │
│        ▼                                    │
│     Tesseract.js OCR ──► DeepSeek AI        │
│        │                    │ FAIL          │
│        ▼                    ▼               │
│     Local Intelligence Engine               │
│     (50+ Additives Database)                │
│                                             │
│  📝 Text Input ──► DeepSeek AI (Primary)    │
│        │              │ FAIL                │
│        │              ▼                     │
│        │           Gemini Text API          │
│        │              │ FAIL                │
│        ▼              ▼                     │
│     Local Intelligence Engine               │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18 or higher
- **npm** v9+

### Installation

```bash
# Clone the repository
git clone https://github.com/mahi-2-ron/grocery_analyzer.git
cd grocery_analyzer

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Production Build

```bash
npm run build
npm run preview
```

---

## 🔑 API Configuration

PureScan supports two cloud AI providers. Configure them via the **Settings (🔑)** button in the app:

| Provider | Purpose | How to Get Key |
|----------|---------|----------------|
| **DeepSeek** | Primary text analysis engine | [platform.deepseek.com](https://platform.deepseek.com/) |
| **Google Gemini** | Vision/image analysis engine | [aistudio.google.com](https://aistudio.google.com/) |

> **Note:** API keys are stored in your browser's `localStorage` and never leave your device.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | React 18 + TypeScript |
| **Build Tool** | Vite 5 |
| **Animations** | Framer Motion |
| **Icons** | Lucide React |
| **AI (Text)** | DeepSeek Chat API |
| **AI (Vision)** | Google Generative AI SDK |
| **OCR** | Tesseract.js |
| **Styling** | Vanilla CSS + Design Tokens |

---

## 📁 Project Structure

```
Food_Analyzer/
├── public/              # Static assets
├── src/
│   ├── App.tsx          # Main application (all screens + AI logic)
│   ├── index.css        # Global styles + design tokens
│   └── main.tsx         # React entry point
├── index.html           # HTML template
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
├── vite.config.ts       # Vite config
└── README.md            # This file
```

---

## 🧪 How the Analysis Works

1. **Input** — User uploads an image or pastes ingredient text
2. **Cloud AI** — The app sends the data to DeepSeek (text) or Gemini (image) for professional nutritional analysis
3. **Fallback** — If cloud APIs fail (network, balance, region), the app uses its **local database** of 50+ known hazardous additives
4. **Report** — A structured JSON report is displayed with:
   - **Health Score** (0–100)
   - **Detected Ingredients** with risk levels (Low / Moderate / High)
   - **Health Impact** descriptions
   - **Recommended Alternatives**
   - **Category Stats** (preservatives, sugars, colors, others)

---

## 📸 Screenshots

| Home Screen | Analysis Result | Ingredient Detail |
|:-----------:|:---------------:|:-----------------:|
| Vision & Text Audit options | Health Score + Risk Badges | Deep-dive on each additive |

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 👨‍💻 Author

**Mahesh Madiwalar**
- Portfolio: [maheshmadiwalar18.netlify.app](https://maheshmadiwalar18.netlify.app/)
- GitHub: [@mahi-2-ron](https://github.com/mahi-2-ron)

---

## ⚖️ Disclaimer

This application is for **informational purposes only**. The health scores and risk assessments are generated using AI models and a curated local database. They should **not** substitute professional medical or nutritional advice. Always consult a healthcare professional for dietary decisions.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
