const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function isKebabCase(s: string): boolean {
  return KEBAB_RE.test(s)
}

/**
 * Turn a title into a skill name.
 * "My Cool Skill!" -> "my-cool-skill"; "/discord:configure — Setup" -> "configure"
 */
export function toKebabCase(input: string): string {
  let s = input.trim()
  // "/plugin:cmd — Title" or "/cmd - Title" -> "cmd"
  const slash = s.match(/^\/([A-Za-z0-9_:-]+)/)
  if (slash) {
    const cmd = slash[1]
    s = cmd.includes(':') ? cmd.slice(cmd.lastIndexOf(':') + 1) : cmd
  }
  s = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
  return s
}
