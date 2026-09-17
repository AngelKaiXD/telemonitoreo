import { supabase } from './supabaseClient'

/** Sala Jitsi pública, igual que la app móvil. */
export function jitsiUrl(room) {
  return `https://meet.jit.si/${room}`
}

async function functionErrorMessage(error) {
  if (error?.context && typeof error.context.json === 'function') {
    try {
      const payload = await error.context.json()
      if (payload?.error) return payload.error
      if (payload?.message) return payload.message
    } catch {
      /* respuesta sin JSON */
    }
  }
  return error?.message || 'No se pudo enviar la invitación.'
}

/**
 * Invoca la misma Edge Function que la app móvil (Fase 9c). No la modifica:
 * manda `{ patientId, reason }` y recibe `{ ok, notification_id, jitsi_room,
 * push_sent, message }`.
 */
export async function sendTelemedicineInvite(patientId, reason) {
  const { data, error } = await supabase.functions.invoke('send-telemedicine-notification', {
    body: { patientId, reason },
  })
  if (error) throw new Error(await functionErrorMessage(error))
  if (data && data.error) throw new Error(data.error)
  if (data && data.ok === false) throw new Error(data.message || 'No se pudo enviar la invitación.')
  return data ?? {}
}

/**
 * Notificaciones visibles según RLS (Doctor: las que envió; Admin: todas).
 * Sin filtro en el cliente, igual que `fetchNotifications` del móvil.
 */
export async function fetchNotifications() {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, patient_id, doctor_id, reason, jitsi_room, created_at, read_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/**
 * Actualización en vivo: escucha INSERT en `notifications` (Supabase Realtime).
 * Devuelve una función para desuscribirse.
 */
export function subscribeNotifications(onInsert) {
  const channel = supabase
    .channel(`notifications-web-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications' },
      (payload) => onInsert?.(payload.new),
    )
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}
