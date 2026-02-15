Role: You are an expert Senior Full-Stack Developer specializing in Chrome Extension development, TypeScript, and modern UI frameworks.

Objective: Create a functional Browser Extension (Manifest V3) that acts as a Pomodoro Timer integrated with a Task Manager.

Tech Stack:

Language: TypeScript

Framework: React

Styling: Tailwind CSS

UI Components: shadcn/ui (specifically: Button, Card, Input, Progress, Checkbox, and ScrollArea)

Build Tool: Vite

Core Features & Logic:

Persistent Timer: Implement the countdown logic in a background.ts service worker using chrome.alarms and chrome.storage. This ensures the timer doesn't reset when the extension popup is closed.

Task Manager:

A section to add, delete, and toggle tasks (Done/Pending).

The ability to "Select" a task to work on, which displays that task's name above the timer.

Presets & Customization:

A list of saved time presets (e.g., Focus: 45m, Short Break: 10m, Long Break: 20m).

An input field to add custom durations to the list.

Completion Alerts:

Trigger a chrome.notifications alert when the time is up.

Show a shadcn Dialog (Modal) when the popup is opened if a session has just finished.

UI/UX Design (shadcn/ui):

Structure: Use a Tabs component to switch between "Timer" and "Task List."

Timer View: A large, centered countdown display using a shadcn Progress ring or bar.

Task View: A ScrollArea containing a list of tasks with Checkbox components.

Theme: Modern, sleek, and supports dark mode.

Deliverables:

manifest.json configured for V3.

background.ts for background timer persistence.

Popup.tsx and related components using shadcn and Tailwind.

Step-by-step instructions for initializing the project, installing shadcn components, and loading the dist folder into Chrome.
