import { defineConfig } from 'bunup'
import { exports } from 'bunup/plugins'

export default defineConfig({
  entry: ['./src/index.ts'],
  target: 'bun',
  dts: { tsgo: true },
  format: 'esm',
  plugins: [exports()],
})
