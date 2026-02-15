import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const root = resolve(__dirname, '..', '..')

describe('Chrome Extension manifest.json (Manifest V3)', () => {
  const manifestPath = resolve(root, 'public', 'manifest.json')

  it('exists in the public/ directory', () => {
    expect(existsSync(manifestPath)).toBe(true)
  })

  describe('manifest structure', () => {
    let manifest: Record<string, unknown>

    beforeAll(() => {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    })

    it('uses Manifest V3', () => {
      expect(manifest.manifest_version).toBe(3)
    })

    it('has a name', () => {
      expect(manifest.name).toBeDefined()
      expect(typeof manifest.name).toBe('string')
      expect((manifest.name as string).length).toBeGreaterThan(0)
    })

    it('has a description', () => {
      expect(manifest.description).toBeDefined()
      expect(typeof manifest.description).toBe('string')
      expect((manifest.description as string).length).toBeGreaterThan(0)
    })

    it('has a version', () => {
      expect(manifest.version).toBeDefined()
      expect(typeof manifest.version).toBe('string')
      expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/)
    })

    describe('permissions', () => {
      it('has permissions array', () => {
        expect(manifest.permissions).toBeDefined()
        expect(Array.isArray(manifest.permissions)).toBe(true)
      })

      it('includes "alarms" permission', () => {
        expect(manifest.permissions).toContain('alarms')
      })

      it('includes "storage" permission', () => {
        expect(manifest.permissions).toContain('storage')
      })

      it('includes "notifications" permission', () => {
        expect(manifest.permissions).toContain('notifications')
      })

      it('includes "activeTab" permission', () => {
        expect(manifest.permissions).toContain('activeTab')
      })
    })

    describe('action (popup)', () => {
      it('has an action field', () => {
        expect(manifest.action).toBeDefined()
        expect(typeof manifest.action).toBe('object')
      })

      it('specifies default_popup pointing to index.html', () => {
        const action = manifest.action as Record<string, unknown>
        expect(action.default_popup).toBe('index.html')
      })

      it('has a default_title', () => {
        const action = manifest.action as Record<string, unknown>
        expect(action.default_title).toBeDefined()
        expect(typeof action.default_title).toBe('string')
      })
    })

    describe('background service worker', () => {
      it('has a background field', () => {
        expect(manifest.background).toBeDefined()
        expect(typeof manifest.background).toBe('object')
      })

      it('specifies a service_worker', () => {
        const background = manifest.background as Record<string, unknown>
        expect(background.service_worker).toBeDefined()
        expect(typeof background.service_worker).toBe('string')
      })

      it('uses module type for the service worker', () => {
        const background = manifest.background as Record<string, unknown>
        expect(background.type).toBe('module')
      })
    })

    describe('icons', () => {
      it('has an icons field', () => {
        expect(manifest.icons).toBeDefined()
        expect(typeof manifest.icons).toBe('object')
      })

      it('specifies icon sizes (16, 48, 128)', () => {
        const icons = manifest.icons as Record<string, string>
        expect(icons['16']).toBeDefined()
        expect(icons['48']).toBeDefined()
        expect(icons['128']).toBeDefined()
      })

      it('icon files exist in public/', () => {
        const icons = manifest.icons as Record<string, string>
        for (const [, iconPath] of Object.entries(icons)) {
          const fullPath = resolve(root, 'public', iconPath)
          expect(existsSync(fullPath)).toBe(true)
        }
      })
    })
  })

  describe('manifest is valid JSON', () => {
    it('parses without errors', () => {
      expect(() => {
        JSON.parse(readFileSync(manifestPath, 'utf-8'))
      }).not.toThrow()
    })
  })
})
