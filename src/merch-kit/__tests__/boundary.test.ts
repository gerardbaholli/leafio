import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The kit's promise is that it can be copied into another project as-is.
 * These tests are what keep that promise true: they fail the build the moment
 * someone reaches out of the folder, pulls in an app-level dependency, or
 * starts styling with utility classes that would not exist in a host app.
 */

const KIT_ROOT = resolve(__dirname, '..')

/** Packages that belong to the demo, never to the kit. */
const FORBIDDEN_PACKAGES = [
  'zustand',
  'zundo',
  'recharts',
  'lucide-react',
  'tailwindcss',
  '@tailwindcss/vite',
]

function kitFiles(dir = KIT_ROOT): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return kitFiles(full)
    return /\.tsx?$/.test(entry) ? [full] : []
  })
}

function importsOf(source: string): string[] {
  const specifiers: string[] = []
  const pattern = /(?:from|import)\s*['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(source))) specifiers.push(match[1])
  return specifiers
}

const files = kitFiles()

describe('merch-kit stays portable', () => {
  it('has files to check', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it('never imports through the app alias', () => {
    const offenders = files.flatMap((file) =>
      importsOf(readFileSync(file, 'utf8'))
        .filter((specifier) => specifier.startsWith('@/'))
        .map((specifier) => `${relative(KIT_ROOT, file)} -> ${specifier}`),
    )
    expect(offenders).toEqual([])
  })

  it('never reaches above its own folder with a relative path', () => {
    const offenders = files.flatMap((file) =>
      importsOf(readFileSync(file, 'utf8'))
        .filter((specifier) => specifier.startsWith('.'))
        .filter((specifier) => !resolve(file, '..', specifier).startsWith(KIT_ROOT))
        .map((specifier) => `${relative(KIT_ROOT, file)} -> ${specifier}`),
    )
    expect(offenders).toEqual([])
  })

  it('depends only on react, konva and three', () => {
    const offenders = files.flatMap((file) =>
      importsOf(readFileSync(file, 'utf8'))
        .filter((specifier) =>
          FORBIDDEN_PACKAGES.some(
            (pkg) => specifier === pkg || specifier.startsWith(`${pkg}/`),
          ),
        )
        .map((specifier) => `${relative(KIT_ROOT, file)} -> ${specifier}`),
    )
    expect(offenders).toEqual([])
  })

  it('styles inline instead of with utility classes', () => {
    // `className={className}` pass-through is fine; a literal class string is not,
    // because it would silently render unstyled in a host without our CSS.
    const offenders = files
      .filter((file) => !file.includes('__tests__'))
      .filter((file) => /className="/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(KIT_ROOT, file))
    expect(offenders).toEqual([])
  })
})
