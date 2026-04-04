import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react.tsx',
    'adapters/sonner': 'src/adapters/sonner.tsx',
    internal: 'src/internal.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['react', 'react-dom', 'sonner'],
})
