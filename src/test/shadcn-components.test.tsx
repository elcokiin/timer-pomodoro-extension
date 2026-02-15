import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { render, screen } from '@testing-library/react'

const root = resolve(__dirname, '..', '..')

describe('shadcn/ui Components Installation', () => {
  describe('Component files exist', () => {
    const components = [
      'button',
      'card',
      'input',
      'progress',
      'checkbox',
      'tabs',
      'dialog',
      'scroll-area',
      'sonner',
    ]

    components.forEach((component) => {
      it(`has ${component}.tsx in src/components/ui/`, () => {
        const filePath = resolve(root, 'src', 'components', 'ui', `${component}.tsx`)
        expect(existsSync(filePath)).toBe(true)
      })
    })
  })

  describe('Component exports', () => {
    it('Button component exports Button and buttonVariants', async () => {
      const module = await import('@/components/ui/button')
      expect(module.Button).toBeDefined()
      expect(module.buttonVariants).toBeDefined()
    }, 15000)

    it('Card component exports Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter', async () => {
      const module = await import('@/components/ui/card')
      expect(module.Card).toBeDefined()
      expect(module.CardHeader).toBeDefined()
      expect(module.CardTitle).toBeDefined()
      expect(module.CardDescription).toBeDefined()
      expect(module.CardContent).toBeDefined()
      expect(module.CardFooter).toBeDefined()
    })

    it('Input component exports Input', async () => {
      const module = await import('@/components/ui/input')
      expect(module.Input).toBeDefined()
    })

    it('Progress component exports Progress', async () => {
      const module = await import('@/components/ui/progress')
      expect(module.Progress).toBeDefined()
    })

    it('Checkbox component exports Checkbox', async () => {
      const module = await import('@/components/ui/checkbox')
      expect(module.Checkbox).toBeDefined()
    })

    it('Tabs component exports Tabs, TabsList, TabsTrigger, TabsContent', async () => {
      const module = await import('@/components/ui/tabs')
      expect(module.Tabs).toBeDefined()
      expect(module.TabsList).toBeDefined()
      expect(module.TabsTrigger).toBeDefined()
      expect(module.TabsContent).toBeDefined()
    })

    it('Dialog component exports Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription', async () => {
      const module = await import('@/components/ui/dialog')
      expect(module.Dialog).toBeDefined()
      expect(module.DialogTrigger).toBeDefined()
      expect(module.DialogContent).toBeDefined()
      expect(module.DialogHeader).toBeDefined()
      expect(module.DialogFooter).toBeDefined()
      expect(module.DialogTitle).toBeDefined()
      expect(module.DialogDescription).toBeDefined()
    })

    it('ScrollArea component exports ScrollArea and ScrollBar', async () => {
      const module = await import('@/components/ui/scroll-area')
      expect(module.ScrollArea).toBeDefined()
      expect(module.ScrollBar).toBeDefined()
    })

    it('Sonner (Toast replacement) component exports Toaster', async () => {
      const module = await import('@/components/ui/sonner')
      expect(module.Toaster).toBeDefined()
    })
  })

  describe('Component rendering', () => {
    it('renders Button with text', async () => {
      const { Button } = await import('@/components/ui/button')
      render(<Button>Click me</Button>)
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
    })

    it('renders Button with different variants', async () => {
      const { Button } = await import('@/components/ui/button')
      const { container } = render(
        <>
          <Button variant="default">Default</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </>
      )
      expect(container.querySelectorAll('[data-slot="button"]')).toHaveLength(6)
    })

    it('renders Card with header and content', async () => {
      const { Card, CardHeader, CardTitle, CardDescription, CardContent } =
        await import('@/components/ui/card')
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Title</CardTitle>
            <CardDescription>Test Description</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Card body content</p>
          </CardContent>
        </Card>
      )
      expect(screen.getByText('Test Title')).toBeInTheDocument()
      expect(screen.getByText('Test Description')).toBeInTheDocument()
      expect(screen.getByText('Card body content')).toBeInTheDocument()
    })

    it('renders Input with placeholder', async () => {
      const { Input } = await import('@/components/ui/input')
      render(<Input placeholder="Enter text..." />)
      expect(screen.getByPlaceholderText('Enter text...')).toBeInTheDocument()
    })

    it('renders Input with type', async () => {
      const { Input } = await import('@/components/ui/input')
      render(<Input type="number" placeholder="Enter number" />)
      const input = screen.getByPlaceholderText('Enter number')
      expect(input).toHaveAttribute('type', 'number')
    })

    it('renders Progress with value', async () => {
      const { Progress } = await import('@/components/ui/progress')
      const { container } = render(<Progress value={75} />)
      const progressEl = container.querySelector('[data-slot="progress"]')
      expect(progressEl).toBeInTheDocument()
    })

    it('renders Checkbox', async () => {
      const { Checkbox } = await import('@/components/ui/checkbox')
      const { container } = render(<Checkbox />)
      const checkbox = container.querySelector('[data-slot="checkbox"]')
      expect(checkbox).toBeInTheDocument()
    })

    it('renders Tabs with content', async () => {
      const { Tabs, TabsList, TabsTrigger, TabsContent } =
        await import('@/components/ui/tabs')
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      )
      expect(screen.getByText('Tab 1')).toBeInTheDocument()
      expect(screen.getByText('Tab 2')).toBeInTheDocument()
      expect(screen.getByText('Content 1')).toBeInTheDocument()
    })

    it('renders ScrollArea with content', async () => {
      const { ScrollArea } = await import('@/components/ui/scroll-area')
      const { container } = render(
        <ScrollArea>
          <p>Scrollable content</p>
        </ScrollArea>
      )
      expect(screen.getByText('Scrollable content')).toBeInTheDocument()
      const scrollArea = container.querySelector('[data-slot="scroll-area"]')
      expect(scrollArea).toBeInTheDocument()
    })
  })

  describe('Dependencies installed', () => {
    it('has radix-ui as a dependency', () => {
      const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))
      expect(pkg.dependencies).toHaveProperty('radix-ui')
    })

    it('has sonner as a dependency (toast replacement)', () => {
      const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))
      expect(pkg.dependencies).toHaveProperty('sonner')
    })

    it('does not have next-themes as a dependency (Chrome extension, not Next.js)', () => {
      const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))
      expect(pkg.dependencies).not.toHaveProperty('next-themes')
    })
  })

  describe('Sonner component is adapted for Chrome Extension', () => {
    it('does not import from next-themes', () => {
      const content = readFileSync(
        resolve(root, 'src', 'components', 'ui', 'sonner.tsx'),
        'utf-8'
      )
      expect(content).not.toContain('next-themes')
      expect(content).not.toContain('useTheme')
    })
  })
})
