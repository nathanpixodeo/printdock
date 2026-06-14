# AirPrint - Background Thermal Print Server

A React Native application that turns your mobile device into a **background TCP print server** for Bluetooth thermal printers. Accept print jobs over LAN and forward them to a connected Bluetooth printer.

## Features

- **Bluetooth Device Discovery** — Scan and select paired Bluetooth thermal printers
- **TCP Server** — Listens on a configurable port (default `9100`) for raw print data
- **Background Service** — Runs persistently with a system notification showing server status
- **Deep Link Control** — Start/stop the server via `airprint://printserver/start` and `airprint://printserver/stop`
- **Dark Mode** — Full light/dark theme support
- **i18n** — English and French translations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.75 |
| Language | TypeScript 5.6 |
| Navigation | React Navigation (Stack) |
| State/Data | TanStack React Query |
| Storage | MMKV |
| Animations | React Native Reanimated |
| Styling | Atomic design with type-safe theme system |
| i18n | i18next |
| Validation | Zod |
| Bluetooth | react-native-bluetooth-serial, react-native-ble-plx |
| Background | react-native-background-actions |
| Networking | react-native-tcp-socket |

## Getting Started

### Prerequisites

- Node.js >= 18
- React Native development environment ([setup guide](https://reactnative.dev/docs/environment-setup))
- Android Studio (for Android) or Xcode (for iOS)

### Installation

```bash
git clone https://github.com/nathanpixodeo/air-print-app.git
cd air-print-app

# Install dependencies
yarn install

# Install iOS pods (iOS only)
yarn pod-install
```

### Running

```bash
# Start Metro bundler
yarn start

# Run on Android
yarn android

# Run on iOS
yarn ios
```

## Project Structure

```
src/
├── App.tsx                    # Root component with providers
├── components/
│   ├── atoms/                 # StatusBadge, Skeleton, AssetByVariant, IconByVariant
│   ├── molecules/             # ServerCard, DefaultError
│   ├── organisms/             # ErrorBoundary
│   └── templates/             # SafeScreen
├── hooks/
│   ├── domain/user/           # User API (React Query example)
│   └── language/              # i18n language toggle
├── navigation/                # Stack navigator setup
├── screens/
│   ├── Startup/               # Home screen (print server control)
│   └── Settings/              # Theme & language settings
├── services/
│   ├── instance.ts            # HTTP client (ky)
│   └── printServer.ts         # Bluetooth + TCP server service
├── theme/                     # Type-safe design system
│   ├── ThemeProvider/         # Context provider
│   ├── types/                 # Strict TS types for styles
│   └── assets/                # Variant-aware images & icons
└── translations/              # EN + FR locales
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `yarn android` | Run on Android |
| `yarn ios` | Run on iOS |
| `yarn start` | Start Metro bundler |
| `yarn test` | Run Jest tests |
| `yarn test:coverage` | Run tests with coverage |
| `yarn lint` | ESLint + Prettier + TypeScript checks |
| `yarn lint:fix` | Auto-fix lint issues |
| `yarn pod-install` | Install CocoaPods for iOS |

## Configuration

Configure the API endpoint (if needed) in `.env`:

```env
API_URL=https://your-api.example.com
```

## License

MIT
