import { Timer, ListTodo } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { TimerView } from './components/TimerView'
import { TaskList } from './components/TaskList'

function App() {
  return (
    <div className="app">
      <h1 className="text-foreground text-center text-lg font-semibold pt-4">
        Pomodoro Timer
      </h1>
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
