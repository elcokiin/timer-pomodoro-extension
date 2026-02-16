# Pomodoro Task Timer

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](https://github.com/elcokiin/timer-pomodoro-extension)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A Chrome extension that combines a Pomodoro focus timer with task management. Stay productive with structured work sessions, automatic break reminders, and an integrated task list -- all from your browser toolbar.

## Features

- **Pomodoro Timer** -- Countdown timer with start, pause, and reset controls
- **Work & Break Modes** -- Automatically switch between focused work sessions and rest breaks
- **Preset Durations** -- Quick-select buttons for 25min, 50min, and 15min sessions
- **Custom Duration** -- Set any duration you need for flexible time management
- **Task Management** -- Add, complete, and delete tasks without leaving the extension
- **Active Task Tracking** -- Select a task to associate with your current focus session
- **Persistent State** -- Timer and tasks survive popup close and browser restart via Chrome Storage
- **Desktop Notifications** -- Get notified when your session ends, even if the popup is closed
- **Rest/Break Prompts** -- Dialog prompts you to take a break or start a new work session when the timer finishes

## Screenshots

> Coming soon -- screenshots of the Focus tab, Tasks tab, and break dialog.

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | React 19 |
| Language | TypeScript 5.9 |
| Build Tool | Vite 7 |
| CSS | Tailwind CSS v4 |
| UI Components | shadcn/ui + Radix UI |
| Icons | Lucide React |
| Chrome APIs | Alarms, Storage, Notifications |
| Testing | Vitest + Testing Library |

## Installation

### From Source (Development)

1. **Clone the repository**

   ```bash
   git clone https://github.com/elcokiin/timer-pomodoro-extension.git
   cd timer-pomodoro-extension
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Build the extension**

   ```bash
   npm run build
   ```

4. **Load in Chrome**

   - Open `chrome://extensions/` in your browser
   - Enable **Developer mode** (toggle in the top right)
   - Click **Load unpacked**
   - Select the `dist/` folder from this project

5. **Click the extension icon** in your toolbar to start using it

### Development Mode

```bash
# Start the dev server (for UI development with hot reload)
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint the codebase
npm run lint
```

> **Note:** After making changes, run `npm run build` and reload the extension in `chrome://extensions/` to see updates in the actual extension.

## Project Structure

```
├── public/
│   ├── manifest.json          # Chrome Extension manifest (v3)
│   └── icons/                 # Extension icons (16, 48, 128px)
├── src/
│   ├── main.tsx               # React entry point
│   ├── App.tsx                # Root component (tab layout + header)
│   ├── index.css              # Global styles + Tailwind + shadcn theme
│   ├── background/
│   │   └── index.ts           # Service worker (timer engine, alarms, notifications)
│   ├── components/
│   │   ├── TimerView.tsx      # Timer display, controls, progress bar
│   │   ├── PresetsSection.tsx # Duration preset buttons + custom input
│   │   ├── TaskList.tsx       # Task CRUD interface
│   │   ├── RestBreakDialog.tsx# End-of-session dialog
│   │   └── ui/                # shadcn/ui primitives
│   ├── hooks/
│   │   ├── useTimer.ts        # Timer state management
│   │   ├── useTasks.ts        # Task CRUD operations
│   │   └── useChromeStorage.ts# Chrome storage sync hook
│   ├── types/
│   │   └── index.ts           # TypeScript interfaces
│   └── test/                  # Test suite (17 test files)
├── index.html                 # Popup HTML entry point
├── vite.config.ts             # Build config (multi-entry)
└── package.json
```

## How It Works

1. **Background Service Worker** handles the timer logic using `chrome.alarms`, ensuring the timer runs even when the popup is closed.
2. **Chrome Storage** persists both timer state and task data across sessions.
3. **Message Passing** keeps the popup UI in sync with the background worker via `chrome.runtime.sendMessage`.
4. **Chrome Notifications** alert you when a session ends, regardless of whether the popup is open.

## Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## License

This project is licensed under the [MIT License](LICENSE).

## Links

- **GitHub:** [github.com/elcokiin/timer-pomodoro-extension](https://github.com/elcokiin/timer-pomodoro-extension)
