import { TimerView } from './components/TimerView'

function App() {
  return (
    <div className="app">
      <h1 className="text-foreground text-center text-lg font-semibold pt-4">
        Pomodoro Timer
      </h1>
      <p className="text-muted-foreground text-center text-sm">
        Focus. Work. Rest. Repeat.
      </p>
      <TimerView />
    </div>
  )
}

export default App
