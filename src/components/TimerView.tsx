import { Play, Pause, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useTimer } from '@/hooks/useTimer'
import { PresetsSection } from '@/components/PresetsSection'

/**
 * Format seconds into MM:SS display string.
 */
function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * TimerView – a centered countdown display with a Progress bar
 * and Start / Pause / Reset control buttons.
 *
 * Communicates with the background service worker via the `useTimer`
 * hook to get live state and dispatch commands.
 */
export function TimerView() {
  const { state, isLoading, start, pause, reset, setDuration } = useTimer()

  if (isLoading) {
    return (
      <div data-testid="timer-loading" className="flex items-center justify-center py-12">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    )
  }

  const progressPercent =
    state.duration > 0 ? (state.timeLeft / state.duration) * 100 : 0

  const isFinished = state.timeLeft <= 0 && !state.isRunning

  return (
    <div data-testid="timer-view" className="flex flex-col items-center gap-6 py-6">
      {/* Mode badge */}
      <span
        data-testid="timer-mode"
        className="text-muted-foreground text-xs font-medium uppercase tracking-widest"
      >
        {state.mode === 'work' ? 'Work' : 'Break'}
      </span>

      {/* Countdown display */}
      <div
        data-testid="timer-display"
        className="text-foreground text-6xl font-bold tabular-nums tracking-tight"
      >
        {formatTime(state.timeLeft)}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs px-4">
        <Progress data-testid="timer-progress" value={progressPercent} />
      </div>

      {/* Control buttons */}
      <div data-testid="timer-controls" className="flex items-center gap-3">
        {state.isRunning ? (
          <Button
            data-testid="timer-pause-button"
            variant="outline"
            size="lg"
            onClick={pause}
          >
            <Pause className="size-5" />
            Pause
          </Button>
        ) : (
          <Button
            data-testid="timer-start-button"
            size="lg"
            onClick={start}
            disabled={isFinished}
          >
            <Play className="size-5" />
            Start
          </Button>
        )}

        <Button
          data-testid="timer-reset-button"
          variant="ghost"
          size="lg"
          onClick={reset}
        >
          <RotateCcw className="size-5" />
          Reset
        </Button>
      </div>

      {/* Time presets */}
      <PresetsSection
        currentDuration={state.duration}
        isRunning={state.isRunning}
        onSetDuration={setDuration}
      />
    </div>
  )
}
