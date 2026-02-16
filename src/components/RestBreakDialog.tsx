import { Coffee, BrainCircuit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/** Default break duration: 5 minutes */
const DEFAULT_BREAK_DURATION = 5 * 60
/** Default work duration: 25 minutes */
const DEFAULT_WORK_DURATION = 25 * 60

interface RestBreakDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Current timer mode (determines which dialog variant to show) */
  mode: 'work' | 'break'
  /** Called when user wants to dismiss the dialog without starting a new session */
  onDismiss: () => void
  /** Called when user wants to switch mode and start a new session */
  onSwitchModeAndStart: (mode: 'work' | 'break', duration: number) => void
}

/**
 * RestBreakDialog – a shadcn Dialog that appears automatically when
 * the timer finishes.
 *
 * - After a work session: prompts the user to start a break.
 * - After a break session: prompts the user to start working again.
 */
export function RestBreakDialog({
  open,
  mode,
  onDismiss,
  onSwitchModeAndStart,
}: RestBreakDialogProps) {
  const isWorkFinished = mode === 'work'

  const title = isWorkFinished
    ? 'Work session complete!'
    : 'Break is over!'

  const description = isWorkFinished
    ? 'Great job! You\'ve earned a break. Take some time to rest and recharge before your next session.'
    : 'Break finished! Ready to focus again? Start a new work session to keep the momentum going.'

  const actionLabel = isWorkFinished ? 'Start Break' : 'Start Work'

  const handleAction = () => {
    if (isWorkFinished) {
      onSwitchModeAndStart('break', DEFAULT_BREAK_DURATION)
    } else {
      onSwitchModeAndStart('work', DEFAULT_WORK_DURATION)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onDismiss() }}>
      <DialogContent
        data-testid="rest-break-dialog"
        showCloseButton={false}
      >
        <DialogHeader>
          <div
            data-testid="rest-break-dialog-icon"
            className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10"
          >
            {isWorkFinished ? (
              <Coffee className="size-6 text-primary" />
            ) : (
              <BrainCircuit className="size-6 text-primary" />
            )}
          </div>
          <DialogTitle data-testid="rest-break-dialog-title" className="text-center">
            {title}
          </DialogTitle>
          <DialogDescription data-testid="rest-break-dialog-description" className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-center gap-2 sm:justify-center">
          <Button
            data-testid="rest-break-dialog-dismiss"
            variant="outline"
            onClick={onDismiss}
          >
            Dismiss
          </Button>
          <Button
            data-testid="rest-break-dialog-action"
            onClick={handleAction}
          >
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
