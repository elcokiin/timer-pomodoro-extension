import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Clock, Plus } from 'lucide-react'

interface PresetsSectionProps {
  /** Current timer duration in seconds */
  currentDuration: number
  /** Whether the timer is currently running */
  isRunning: boolean
  /** Callback to set a new duration (in seconds) */
  onSetDuration: (durationSeconds: number) => void
}

const PRESETS = [
  { label: '25m', minutes: 25 },
  { label: '50m', minutes: 50 },
  { label: '15m', minutes: 15 },
] as const

export function PresetsSection({
  currentDuration,
  isRunning,
  onSetDuration,
}: PresetsSectionProps) {
  const [customMinutes, setCustomMinutes] = useState('')

  const handlePresetClick = (minutes: number) => {
    onSetDuration(minutes * 60)
  }

  const handleCustomSubmit = () => {
    const parsed = Number(customMinutes)
    if (!Number.isFinite(parsed) || parsed <= 0) return
    onSetDuration(Math.floor(parsed) * 60)
    setCustomMinutes('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCustomSubmit()
    }
  }

  const currentDurationMinutes = currentDuration / 60

  return (
    <div data-testid="presets-section" className="flex flex-col items-center gap-3 w-full max-w-xs px-4">
      {/* Preset buttons */}
      <div data-testid="presets-buttons" className="flex items-center gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.label}
            data-testid={`preset-${preset.minutes}`}
            variant={currentDurationMinutes === preset.minutes ? 'default' : 'outline'}
            size="sm"
            disabled={isRunning}
            onClick={() => handlePresetClick(preset.minutes)}
          >
            <Clock className="size-3.5" />
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Custom duration input */}
      <div data-testid="custom-duration" className="flex items-center gap-2 w-full">
        <Input
          data-testid="custom-duration-input"
          type="number"
          min="1"
          placeholder="Custom (min)"
          value={customMinutes}
          onChange={(e) => setCustomMinutes(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRunning}
          className="h-8 text-sm"
        />
        <Button
          data-testid="custom-duration-submit"
          variant="outline"
          size="sm"
          disabled={isRunning || !customMinutes || Number(customMinutes) <= 0}
          onClick={handleCustomSubmit}
        >
          <Plus className="size-3.5" />
          Set
        </Button>
      </div>
    </div>
  )
}
