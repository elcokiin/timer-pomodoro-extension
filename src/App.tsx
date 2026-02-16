import { Timer, ListTodo, Github } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { TimerView } from './components/TimerView'
import { TaskList } from './components/TaskList'

function App() {
  const handleGithubClick = () => {
    window.open('https://github.com/elcokiin/timer-pomodoro-extension', '_blank')
  }

  return (
    <div className="app">
      <div className="relative pt-4">
        <h1 className="text-foreground text-center text-lg font-semibold">
          Pomodoro Timer
        </h1>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-3 size-8 text-muted-foreground hover:text-foreground"
          onClick={handleGithubClick}
          data-testid="github-link"
          aria-label="View source on GitHub"
        >
          <Github className="size-4" />
        </Button>
      </div>
      <p className="text-muted-foreground text-center text-sm mb-2">
        Focus. Work. Rest. Repeat.
      </p>

      <Tabs defaultValue="focus" className="w-full px-4">
        <TabsList className="w-full" data-testid="tabs-list">
          <TabsTrigger value="focus" data-testid="tab-focus">
            <Timer className="size-4" />
            Focus
          </TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">
            <ListTodo className="size-4" />
            Tasks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="focus" data-testid="tab-content-focus">
          <TimerView />
        </TabsContent>

        <TabsContent value="tasks" data-testid="tab-content-tasks">
          <TaskList />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default App
