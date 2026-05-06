import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    base: './',
    plugins: [react()],
    server: {
        port: 3000,
        proxy: {
            '/api': {
                target: 'http://localhost:8000',
                changeOrigin: true
            }
        }
    },
    build: {
        // Otimizações para produção (Render Free)
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true,
                pure_funcs: ['console.log', 'console.warn', 'console.error']
            }
        },
        // Source map só em dev (economiza ~30% do tamanho do bundle)
        sourcemap: mode === 'development',
        // Divide chunks para cache eficiente
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom'],
                    'vendor-icons': ['lucide-react'],
                },
                // Nomeia chunks com hash para cache agressivo
                entryFileNames: 'assets/[name]-[hash].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]'
            }
        },
        // Tamanho limite de warning
        chunkSizeWarningLimit: 500
    },
    // Otimizações de dependências
    optimizeDeps: {
        include: ['react', 'react-dom', 'lucide-react']
    }
}))
