const steps = [
  { name: 'fmt', cmd: ['bunx', 'oxfmt', '.'] },
  { name: 'lint', cmd: ['bunx', 'oxlint', '.'] },
  { name: 'test', cmd: ['bun', 'test'] },
]

for (const { name, cmd } of steps) {
  console.log(`\n→ ${name}`)
  const proc = Bun.spawn(cmd, { stdio: ['ignore', 'inherit', 'inherit'] })
  const code = await proc.exited
  if (code !== 0) {
    console.error(`\n✗ ${name} failed (exit ${code})`)
    process.exit(code)
  }
}

console.log('\n✓ all checks passed')
