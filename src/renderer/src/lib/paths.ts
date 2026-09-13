/** Minimal path helpers for the renderer (no Node `path` here). */

export function dirname(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i <= 0 ? p : p.slice(0, i)
}

export function basename(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i < 0 ? p : p.slice(i + 1)
}

export function join(a: string, b: string): string {
  const sep = a.includes('\\') ? '\\' : '/'
  return a.replace(/[\\/]+$/, '') + sep + b
}
