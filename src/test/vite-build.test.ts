import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { resolve } from 'path'

const root = resolve(__dirname, '..', '..')
const distDir = resolve(root, 'dist')

describe('Vite multi-page build configuration', () => {
  describe('vite.config.ts', () => {
    let configContent: string

    beforeAll(() => {
      configContent = readFileSync(resolve(root, 'vite.config.ts'), 'utf-8')
    })

    it('exists in project root', () => {
      expect(existsSync(resolve(root, 'vite.config.ts'))).toBe(true)
    })

    it('defines a build.rollupOptions.input configuration', () => {
      expect(configContent).toContain('rollupOptions')
      expect(configContent).toContain('input')
    })

    it('includes popup entry point (index.html)', () => {
      expect(configContent).toContain("'index.html'")
    })

    it('includes background entry point (src/background/index.ts)', () => {
      expect(configContent).toContain("'src/background/index.ts'")
    })

    it('has a popup input key', () => {
      expect(configContent).toMatch(/popup\s*:/)
    })

    it('has a background input key', () => {
      expect(configContent).toMatch(/background\s*:/)
    })

    it('defines entryFileNames output configuration', () => {
      expect(configContent).toContain('entryFileNames')
    })

    it('routes background entry to background.js at dist root', () => {
      expect(configContent).toContain("'background.js'")
    })

    it('routes non-background entries to assets/ directory', () => {
      expect(configContent).toContain('assets/[name]-[hash].js')
    })
  })

  describe('build output (dist/)', () => {
    // These tests verify the build output structure.
    // They require `npx vite build` to have been run before testing.
    // If dist/ does not exist, these tests are skipped gracefully.

    const distExists = existsSync(distDir)

    it('dist/ directory exists (build has been run)', () => {
      expect(distExists).toBe(true)
    })

    describe('popup output', () => {
      it.skipIf(!distExists)('generates index.html in dist root', () => {
        expect(existsSync(resolve(distDir, 'index.html'))).toBe(true)
      })

      it.skipIf(!distExists)('index.html contains a script tag', () => {
        const html = readFileSync(resolve(distDir, 'index.html'), 'utf-8')
        expect(html).toContain('<script')
        expect(html).toContain('type="module"')
      })

      it.skipIf(!distExists)('index.html references popup JS in assets/', () => {
        const html = readFileSync(resolve(distDir, 'index.html'), 'utf-8')
        expect(html).toMatch(/src="[./]*assets\/popup-[^"]+\.js"/)
      })

      it.skipIf(!distExists)('index.html references popup CSS in assets/', () => {
        const html = readFileSync(resolve(distDir, 'index.html'), 'utf-8')
        expect(html).toMatch(/href="[./]*assets\/popup-[^"]+\.css"/)
      })

      it.skipIf(!distExists)('index.html has the root div', () => {
        const html = readFileSync(resolve(distDir, 'index.html'), 'utf-8')
        expect(html).toContain('id="root"')
      })
    })

    describe('background service worker output', () => {
      it.skipIf(!distExists)('generates background.js in dist root', () => {
        expect(existsSync(resolve(distDir, 'background.js'))).toBe(true)
      })

      it.skipIf(!distExists)('background.js is not empty', () => {
        const content = readFileSync(resolve(distDir, 'background.js'), 'utf-8')
        expect(content.length).toBeGreaterThan(0)
      })

      it.skipIf(!distExists)('background.js contains timer logic (alarm name)', () => {
        const content = readFileSync(resolve(distDir, 'background.js'), 'utf-8')
        expect(content).toContain('pomodoro-timer')
      })

      it.skipIf(!distExists)('background.js references chrome.alarms API', () => {
        const content = readFileSync(resolve(distDir, 'background.js'), 'utf-8')
        expect(content).toContain('chrome.alarms')
      })

      it.skipIf(!distExists)('background.js references chrome.storage API', () => {
        const content = readFileSync(resolve(distDir, 'background.js'), 'utf-8')
        expect(content).toContain('chrome.storage')
      })

      it.skipIf(!distExists)('background.js references chrome.runtime API', () => {
        const content = readFileSync(resolve(distDir, 'background.js'), 'utf-8')
        expect(content).toContain('chrome.runtime')
      })

      it.skipIf(!distExists)('background.js does not contain React imports', () => {
        const content = readFileSync(resolve(distDir, 'background.js'), 'utf-8')
        // Background should be a standalone script, not bundling React
        expect(content).not.toContain('react-dom')
        expect(content).not.toContain('createRoot')
      })
    })

    describe('assets directory', () => {
      it.skipIf(!distExists)('assets/ directory exists', () => {
        expect(existsSync(resolve(distDir, 'assets'))).toBe(true)
      })

      it.skipIf(!distExists)('contains at least one JS file for the popup', () => {
        const files = readdirSync(resolve(distDir, 'assets'))
        const jsFiles = files.filter((f) => f.endsWith('.js'))
        expect(jsFiles.length).toBeGreaterThanOrEqual(1)
      })

      it.skipIf(!distExists)('contains at least one CSS file for the popup', () => {
        const files = readdirSync(resolve(distDir, 'assets'))
        const cssFiles = files.filter((f) => f.endsWith('.css'))
        expect(cssFiles.length).toBeGreaterThanOrEqual(1)
      })

      it.skipIf(!distExists)('popup JS files have hashed names', () => {
        const files = readdirSync(resolve(distDir, 'assets'))
        const jsFiles = files.filter((f) => f.endsWith('.js'))
        for (const file of jsFiles) {
          expect(file).toMatch(/popup-[a-zA-Z0-9]+\.js$/)
        }
      })
    })

    describe('static assets from public/', () => {
      it.skipIf(!distExists)('manifest.json is copied to dist root', () => {
        expect(existsSync(resolve(distDir, 'manifest.json'))).toBe(true)
      })

      it.skipIf(!distExists)('manifest.json references index.html as popup', () => {
        const manifest = JSON.parse(
          readFileSync(resolve(distDir, 'manifest.json'), 'utf-8')
        )
        const action = manifest.action as Record<string, unknown>
        expect(action.default_popup).toBe('index.html')
      })

      it.skipIf(!distExists)('manifest.json references background.js as service worker', () => {
        const manifest = JSON.parse(
          readFileSync(resolve(distDir, 'manifest.json'), 'utf-8')
        )
        const background = manifest.background as Record<string, unknown>
        expect(background.service_worker).toBe('background.js')
      })

      it.skipIf(!distExists)('icons directory is copied to dist', () => {
        expect(existsSync(resolve(distDir, 'icons'))).toBe(true)
      })

      it.skipIf(!distExists)('icon files exist in dist/icons/', () => {
        expect(existsSync(resolve(distDir, 'icons', 'icon-16.png'))).toBe(true)
        expect(existsSync(resolve(distDir, 'icons', 'icon-48.png'))).toBe(true)
        expect(existsSync(resolve(distDir, 'icons', 'icon-128.png'))).toBe(true)
      })
    })

    describe('dist/ is a loadable Chrome Extension', () => {
      it.skipIf(!distExists)('all manifest-referenced files exist in dist/', () => {
        const manifest = JSON.parse(
          readFileSync(resolve(distDir, 'manifest.json'), 'utf-8')
        )

        // Popup HTML
        const action = manifest.action as Record<string, unknown>
        expect(existsSync(resolve(distDir, action.default_popup as string))).toBe(
          true
        )

        // Background service worker
        const background = manifest.background as Record<string, unknown>
        expect(
          existsSync(resolve(distDir, background.service_worker as string))
        ).toBe(true)

        // Icons
        const icons = manifest.icons as Record<string, string>
        for (const [, iconPath] of Object.entries(icons)) {
          expect(existsSync(resolve(distDir, iconPath))).toBe(true)
        }
      })

      it.skipIf(!distExists)('no unexpected HTML files (only index.html)', () => {
        const files = readdirSync(distDir)
        const htmlFiles = files.filter((f) => f.endsWith('.html'))
        expect(htmlFiles).toEqual(['index.html'])
      })

      it.skipIf(!distExists)('background.js is at dist root (not in assets/)', () => {
        // Must be at root level for manifest.json service_worker reference
        expect(existsSync(resolve(distDir, 'background.js'))).toBe(true)

        // Verify it's NOT in assets/
        const assetsFiles = readdirSync(resolve(distDir, 'assets'))
        const bgInAssets = assetsFiles.filter((f) => f.startsWith('background'))
        expect(bgInAssets.length).toBe(0)
      })
    })
  })
})
