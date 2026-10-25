# WMS-For-ERPNext 📦📱

An enterprise-grade cross-platform Warehouse Management System (WMS) mobile application built with **React Native**, **Expo Router (SDK 57)**, and **TypeScript**, seamlessly integrated with **ERPNext**. Designed for high-speed warehouse floor operations, stock audits, physical reconciliations, and inventory tracking.

---

## 🚀 Key Features & Modules

### 1. 🔍 High-Speed Barcode & QR Scanning
- Real-time camera scanner with instant barcode/QR parsing.
- Automated lookup for items, warehouse locations, bins, and serial/batch tags.
- Built-in haptic feedback and audio cues for error prevention during rapid scanning.

### 2. 📋 Stock Reconciliation & Audit
- Physical count verification with variance calculation.
- **Batch & Serial Number Tracking**: Full support for tracking batch-controlled and serialized inventory directly from the mobile floor.
- Instant reconciliation submission directly into ERPNext.

### 3. 📦 Stock Adjustments & Transfers
- On-the-fly stock adjustments for damage, scrap, or inventory discrepancies.
- Inter-warehouse and bin-to-bin material movement validation.
- Inventory dispatch workflows and dispatch queue handling.

### 4. 🔄 Real-Time Web Portal & ERPNext Sync
- Seamless two-way data synchronization with ERPNext backend APIs.
- Resilient offline caching and error recovery for warehouse dead-zones.

### 5. ✨ Premium Warehouse UX
- Fluid micro-animations powered by **React Native Reanimated** and **Gesture Handler**.
- Responsive bottom navigation with tailored accessibility and responsive typography.
- Multi-language support (i18n ready).

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Mobile Framework** | React Native 0.86 / Expo SDK 57 (Expo Router) |
| **Language** | TypeScript |
| **UI & Styling** | Vanilla React Native StyleSheet, Linear Gradients, Lucide Icons |
| **Animations & Gestures** | React Native Reanimated 4.5, Gesture Handler |
| **Hardware APIs** | Expo Camera, Barcode Scanner, Expo Haptics |
| **Data & Storage** | Expo SecureStore, Expo FileSystem |
| **Internationalization** | i18next / react-i18next |

---

## 📂 Project Architecture

```
Swift-WMS/
├── app/
│   ├── (auth)/             # Authentication & user login flows
│   ├── (tabs)/             # Primary app tabs
│   │   ├── index.tsx       # Warehouse dashboard & quick actions
│   │   ├── scan.tsx        # Camera barcode scanner
│   │   ├── inventory.tsx   # Item catalog & warehouse stock levels
│   │   ├── adjustment.tsx  # Stock adjustments & variance handling
│   │   └── settings.tsx    # App preferences, language, profile
│   ├── stock/              # Stock reconciliation & batch/serial flows
│   ├── inventory/          # Warehouse dispatch & transfer modules
│   └── _layout.tsx         # Root navigation & tab bar layout
├── assets/                 # App icons, splash screens, and vector assets
└── package.json            # Dependencies & build scripts
```

---

## 💻 Getting Started Locally

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Expo Go on iOS/Android or an emulator

### Installation & Run
```bash
# 1. Clone the repository
git clone https://github.com/thakurbhagyashri/WMS-For-ERPNext.git
cd WMS-For-ERPNext

# 2. Install dependencies
npm install

# 3. Start development server
npx expo start
```
