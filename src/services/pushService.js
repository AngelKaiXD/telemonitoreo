import { supabase } from './supabaseClient'

// Config pública de Firebase (mismo proyecto que la app móvil). Se inyecta por
// entorno (VITE_FIREBASE_*); el Service Worker la recibe en build desde
// vite.config.js. Nunca hay secretos aquí: son claves publicables del cliente.
const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY
const SW_URL = '/firebase-messaging-sw.js'

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'Notification' in window &&
    'PushManager' in window
  )
}

export function pushConfigMissing() {
  return !FIREBASE_CONFIG.apiKey || !FIREBASE_CONFIG.projectId || !FIREBASE_CONFIG.appId || !VAPID_KEY
}

export function notificationPermission() {
  if (!pushSupported()) return 'unsupported'
  return Notification.permission
}

let messagingPromise = null

async function getMessagingInstance() {
  if (!messagingPromise) {
    messagingPromise = (async () => {
      const [{ initializeApp, getApps }, { getMessaging, isSupported }] = await Promise.all([
        import('firebase/app'),
        import('firebase/messaging'),
      ])
      if (!(await isSupported())) {
        throw new Error('Este navegador no soporta notificaciones push.')
      }
      const app = getApps().length > 0 ? getApps()[0] : initializeApp(FIREBASE_CONFIG)
      return getMessaging(app)
    })()
  }
  try {
    return await messagingPromise
  } catch (error) {
    messagingPromise = null
    throw error
  }
}

/**
 * Pide permiso, registra el Service Worker, obtiene el token del navegador y lo
 * guarda en `device_tokens` con el mismo patrón que la app móvil (upsert por
 * `profile_id`). Lanza errores con mensajes claros para la UI.
 */
export async function enableWebPush(profileId) {
  if (!profileId) throw new Error('No se pudo identificar tu perfil para registrar el dispositivo.')
  if (!pushSupported()) {
    throw new Error('Este navegador no soporta notificaciones push.')
  }
  if (pushConfigMissing()) {
    throw new Error(
      'Falta la configuración de Firebase en la web (VITE_FIREBASE_*). Pídele al administrador que la complete.',
    )
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(
      'Permiso de notificaciones denegado. Puedes habilitarlo desde la configuración del navegador.',
    )
  }

  const registration = await navigator.serviceWorker.register(SW_URL)
  const messaging = await getMessagingInstance()
  const { getToken } = await import('firebase/messaging')
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  })
  if (!token) {
    throw new Error('No se pudo obtener el token de notificaciones del navegador.')
  }

  const { error } = await supabase.from('device_tokens').upsert(
    {
      profile_id: profileId,
      fcm_token: token,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id' },
  )
  if (error) throw error

  return token
}

/** Suscribe un handler a los mensajes FCM recibidos con la pestaña abierta. */
export async function onForegroundPush(handler) {
  const messaging = await getMessagingInstance()
  const { onMessage } = await import('firebase/messaging')
  return onMessage(messaging, handler)
}
