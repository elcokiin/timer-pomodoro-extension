import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const root = resolve(__dirname, '..', '..')

describe('Tailwind CSS & shadcn/ui Configuration', () => {
  it('has Tailwind CSS as a devDependency', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))
    expect(pkg.devDependencies).toHaveProperty('tailwindcss')
  })

  it('has @tailwindcss/vite as a devDependency', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))
    expect(pkg.devDependencies).toHaveProperty('@tailwindcss/vite')
  })

  it('has shadcn/ui core dependencies installed', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))
    expect(pkg.dependencies).toHaveProperty('class-variance-authority')
    expect(pkg.dependencies).toHaveProperty('clsx')
    expect(pkg.dependencies).toHaveProperty('tailwind-merge')
    expect(pkg.dependencies).toHaveProperty('lucide-react')
  })

  it('has tw-animate-css installed', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))
    expect(pkg.dependencies).toHaveProperty('tw-animate-css')
  })

  it('has a components.json for shadcn/ui', () => {
    expect(existsSync(resolve(root, 'components.json'))).toBe(true)
    const config = JSON.parse(readFileSync(resolve(root, 'components.json'), 'utf-8'))
    expect(config.tsx).toBe(true)
    expect(config.aliases).toHaveProperty('components')
    expect(config.aliases).toHaveProperty('utils')
    expect(config.aliases).toHaveProperty('ui')
  })

  it('has the cn utility function at src/lib/utils.ts', () => {
    expect(existsSync(resolve(root, 'src', 'lib', 'utils.ts'))).toBe(true)
    const utils = readFileSync(resolve(root, 'src', 'lib', 'utils.ts'), 'utf-8')
    expect(utils).toContain('clsx')
    expect(utils).toContain('twMerge')
    expect(utils).toContain('export function cn')
  })

  it('has Tailwind CSS imported in index.css', () => {
    const css = readFileSync(resolve(root, 'src', 'index.css'), 'utf-8')
    expect(css).toContain('@import "tailwindcss"')
  })

  it('has CSS variables for shadcn/ui theming in index.css', () => {
    const css = readFileSync(resolve(root, 'src', 'index.css'), 'utf-8')
    expect(css).toContain('--background')
    expect(css).toContain('--foreground')
    expect(css).toContain('--primary')
    expect(css).toContain('--secondary')
    expect(css).toContain('--destructive')
    expect(css).toContain('--border')
    expect(css).toContain('--radius')
  })

  it('has path alias configured in tsconfig.app.json', () => {
    const raw = readFileSync(resolve(root, 'tsconfig.app.json'), 'utf-8')
    // Strip JSONC comments before parsing
    const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')
    const tsconfig = JSON.parse(stripped)
    expect(tsconfig.compilerOptions.paths).toHaveProperty('@/*')
    expect(tsconfig.compilerOptions.paths['@/*']).toContain('./src/*')
  })

  it('has the Tailwind CSS Vite plugin configured in vite.config.ts', () => {
    const viteConfig = readFileSync(resolve(root, 'vite.config.ts'), 'utf-8')
    expect(viteConfig).toContain('@tailwindcss/vite')
    expect(viteConfig).toContain('tailwindcss()')
  })

  it('has path alias configured in vite.config.ts', () => {
    const viteConfig = readFileSync(resolve(root, 'vite.config.ts'), 'utf-8')
    expect(viteConfig).toContain("alias")
    expect(viteConfig).toContain("'@'")
  })

  it('cn utility correctly merges class names', async () => {
    const { cn } = await import('../lib/utils')
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-red-500', undefined, 'bg-blue-500')).toBe('text-red-500 bg-blue-500')
    expect(cn()).toBe('')
  })
})
