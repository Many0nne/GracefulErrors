import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react.tsx',
    'adapters/sonner': 'src/adapters/sonner.tsx',
    'adapters/react-hot-toast': 'src/adapters/react-hot-toast.tsx',
    vue: 'src/vue.ts',
    axios: 'src/axios.ts',
  },
  format: ['esm', 'cjs'],
  outExtension({ format }) {
    return { js: format === 'esm' ? '.mjs' : '.cjs' }
  },
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['react', 'react-dom', 'sonner', 'react-hot-toast', 'vue', 'axios'],
})
