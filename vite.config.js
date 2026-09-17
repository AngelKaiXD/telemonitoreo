import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const firebaseVersion = JSON.parse(
  readFileSync(new URL('./node_modules/firebase/package.json', import.meta.url), 'utf8'),
).version

const SW_FILENAME = 'firebase-messaging-sw.js'

/**
 * Genera el Service Worker de Firebase Messaging en dev y en build, inyectando
 * la config pública de Firebase (VITE_FIREBASE_*). No se versiona un archivo
 * con valores incrustados: la fuente es el entorno (mismo esquema que el resto
 * de variables VITE_).
 */
function messagingSwSource(config, version) {
  return `/* Generado en tiempo de build por vite.config.js — no editar a mano. */
importScripts('https://www.gstatic.com/firebasejs/${version}/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/${version}/firebase-messaging-compat.js')

firebase.initializeApp(${JSON.stringify(config)})

const messaging = firebase.messaging()

// Mensajes solo-datos: los que traen bloque \`notification\` los muestra el SDK.
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return
  const data = payload.data || {}
  self.registration.showNotification(data.title || 'Telemedicina', {
    body: data.body || data.reason || '',
    icon: '/favicon.svg',
    data,
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  const url = data.jitsi_room ? 'https://meet.jit.si/' + data.jitsi_room : '/'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ('focus' in client) {
            client.focus()
            if ('navigate' in client) return client.navigate(url)
          }
        }
        return self.clients.openWindow(url)
      }),
  )
})
`
}

function firebaseMessagingSwPlugin(env) {
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  }
  const source = () => messagingSwSource(config, firebaseVersion)
  return {
    name: 'firebase-messaging-sw',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith(`/${SW_FILENAME}`)) return next()
        res.setHeader('Content-Type', 'application/javascript')
        res.setHeader('Cache-Control', 'no-cache')
        res.end(source())
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: SW_FILENAME, source: source() })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react(), firebaseMessagingSwPlugin(env)],
    server: {
      proxy: {
        // En desarrollo, /api/invite-doctor lo sirve `vercel dev` (puerto 3000).
        // En producción es una Vercel Function del mismo dominio.
        '/api': 'http://localhost:3000',
      },
    },
  }
})
