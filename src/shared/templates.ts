import type { SkillDocument } from './skill-types'

export interface SkillTemplate {
  id: string
  title: string
  blurb: string
  make: () => SkillDocument
}

export const TEMPLATES: SkillTemplate[] = [
  {
    id: 'blank',
    title: 'Blank document',
    blurb: 'Start from nothing. Name and description fill in as you type.',
    make: () => ({
      frontmatter: { name: '', description: '' },
      extraYaml: '',
      bodyMarkdown: '',
      attachments: []
    })
  },
  {
    id: 'slash-command',
    title: 'Slash command',
    blurb: 'A skill the user runs by typing /name, with arguments.',
    make: () => ({
      frontmatter: {
        name: '',
        description: '',
        'user-invocable': true,
        'argument-hint': '[target]'
      },
      extraYaml: '',
      bodyMarkdown: [
        '# My Command',
        '',
        'Use when the user types /my-command. Explain in one sentence what this command does.',
        '',
        'Arguments passed: `$ARGUMENTS`',
        '',
        '## Steps',
        '',
        '1. Read the arguments and decide what the user wants.',
        '2. Do the work.',
        '3. Report the result in a short summary.',
        '',
        '## Rules',
        '',
        '- Keep the output short.',
        '- Ask before doing anything destructive.',
        ''
      ].join('\n'),
      attachments: []
    })
  },
  {
    id: 'reference',
    title: 'Reference / knowledge',
    blurb: 'Domain knowledge Claude should consult, with supporting files.',
    make: () => ({
      frontmatter: { name: '', description: '' },
      extraYaml: '',
      bodyMarkdown: [
        '# My Reference Skill',
        '',
        'Use when the user asks about this topic or works with these files. Describe what knowledge this skill holds.',
        '',
        '## When to use',
        '',
        '- The user mentions …',
        '- The task involves …',
        '',
        '## Key facts',
        '',
        '- Fact one.',
        '- Fact two.',
        '',
        '## Reference files',
        '',
        'Longer material lives in `references/`. Read the relevant file before answering.',
        ''
      ].join('\n'),
      attachments: []
    })
  },
  {
    id: 'workflow',
    title: 'Workflow',
    blurb: 'A repeatable multi-step process with the tools it needs.',
    make: () => ({
      frontmatter: {
        name: '',
        description: '',
        'allowed-tools': ['Read', 'Grep', 'Glob', 'Bash']
      },
      extraYaml: '',
      bodyMarkdown: [
        '# My Workflow',
        '',
        'Use when the user asks to run this process. Summarize the outcome in one sentence.',
        '',
        '## Before you start',
        '',
        '- Confirm the working directory is correct.',
        '- Check the prerequisites listed below.',
        '',
        '## Steps',
        '',
        '1. Gather the inputs.',
        '2. Run the checks.',
        '3. Apply the changes.',
        '4. Verify the result.',
        '',
        '## Done when',
        '',
        '- All checks pass.',
        '- The user has a short report of what changed.',
        ''
      ].join('\n'),
      attachments: []
    })
  }
]
