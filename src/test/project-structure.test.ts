import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const root = resolve(__dirname, '..', '..')

describe('Project Structure', () => {
  it('has a package.json with correct name', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))
    expect(pkg.name).toBe('pomodoro-task-extension')
  })

  it('has React and React DOM as dependencies', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))
    expect(pkg.dependencies).toHaveProperty('react')
    expect(pkg.dependencies).toHaveProperty('react-dom')
  })

  it('has @types/chrome as a devDependency', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))
    expect(pkg.devDependencies).toHaveProperty('@types/chrome')
  })

  it('has TypeScript configured', () => {
    expect(existsSync(resolve(root, 'tsconfig.json'))).toBe(true)
    expect(existsSync(resolve(root, 'tsconfig.app.json'))).toBe(true)
  })

  it('has Vite configured', () => {
    expect(existsSync(resolve(root, 'vite.config.ts'))).toBe(true)
  })

  it('has an index.html entry point', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf-8')
    expect(html).toContain('id="root"')
    expect(html).toContain('src="/src/main.tsx"')
  })

  it('has the expected source directory structure', () => {
    expect(existsSync(resolve(root, 'src'))).toBe(true)
    expect(existsSync(resolve(root, 'src', 'background'))).toBe(true)
    expect(existsSync(resolve(root, 'src', 'components'))).toBe(true)
    expect(existsSync(resolve(root, 'src', 'hooks'))).toBe(true)
    expect(existsSync(resolve(root, 'src', 'types'))).toBe(true)
  })

  it('has ESLint configured', () => {
    expect(existsSync(resolve(root, 'eslint.config.js'))).toBe(true)
  })

  it('has build and test scripts', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))
    expect(pkg.scripts).toHaveProperty('build')
    expect(pkg.scripts).toHaveProperty('test')
    expect(pkg.scripts).toHaveProperty('lint')
    expect(pkg.scripts).toHaveProperty('dev')
  })
})
