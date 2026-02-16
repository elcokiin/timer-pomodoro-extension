Phase 1: Project Scaffolding & Environment
- [x] Initialize Vite + React + TypeScript project with a structure compatible with Chrome Extensions.
- [x] Configure tailwind.config.js and install shadcn/ui CLI.
- [x] Install essential shadcn components: Button, Card, Input, Progress, Checkbox, Tabs, Dialog, ScrollArea, and Toast.
- [x] Create a manifest.json (Manifest V3) with permissions for: alarms, storage, notifications, and activeTab.
Phase 2: The Core Engine (Background Script)
- [x] Create src/background.ts to host the primary timer logic using chrome.alarms.
- [x] Implement chrome.storage.local to persist the timer state (time remaining, isRunning, startTime).
- [x] Setup a listener to trigger a chrome.notifications alert when the countdown reaches zero.
- [x] Create a message listener to sync data between the popup and the background script.
Phase 3: State Management & Storage Hooks
- [x] Define TypeScript interfaces for:
Task { id: string, text: string, completed: boolean, isSelected: boolean }
TimerState { mode: 'work' | 'break', timeLeft: number, isRunning: boolean }
- [x] Create a custom React hook useChromeStorage to handle real-time updates between the extension UI and chrome.storage.local.
Phase 4: UI Development (shadcn/ui)
- [ ] Timer View: Build a centered countdown display with a shadcn Progress bar and control buttons (Start, Pause, Reset).
- [ ] Presets Section: Implement a list of clickable time presets (25m, 50m, 15m) and a custom duration input.
- [ ] Task List: Create a ScrollArea containing a list of tasks with Checkbox toggles and a "Delete" action.
- [ ] Layout: Wrap everything in a shadcn Tabs component to switch between "Focus" and "Tasks".
Phase 5: Completion Logic & Polish
- [ ] Implement the "Rest/Break" popup: A shadcn Dialog that appears automatically when the timer finishes.
- [ ] Add "Active Task" display: Show the currently selected task name above the timer.
- [ ] Configure vite.config.ts for multi-page build (generating popup.html and background.js in the /dist folder).
Phase 6: Final Validation
- [ ] Verify that the timer continues to count down even when the extension popup is closed.
- [ ] Ensure tasks remain saved after a browser restart.
- [ ] Test the "Add Custom Time" functionality for edge cases (0 or negative numbers).
