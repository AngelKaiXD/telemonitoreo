import { createClient } from '@supabase/supabase-js'

/**
 * Vercel Function: invita a un doctor por correo y lo enlaza con su fila.
 *
 * *Nunca* se ejecuta en el navegador y la service_role key solo vive como
 * variable de entorno del servidor (sin prefijo VITE_). El flujo:
 *   1. Guarda la fila en `doctors` (idempotente por id).
 *   2. Crea la cuenta en Supabase Auth con `inviteUserByEmail` (el correo
 *      permite al doctor definir su propia contraseña).
 *   3. Crea `profiles` con `id = auth.user.id`, `role='doctor'` y
 *      `doctor_id = <id de doctors>` (puente que ya usan web y móvil).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido.' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor')
    return res.status(500).json({
      error:
        'El servidor no está configurado. Define SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.',
    })
  }

  // Cliente con privilegios de administración (solo backend).
  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Solo un administrador autenticado puede invitar doctores.
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const {
    data: { user: caller },
    error: callerError,
  } = await service.auth.getUser(token)
  if (callerError || !caller) {
    return res.status(401).json({ error: 'Sesión inválida o expirada.' })
  }
  const { data: callerProfile } = await service
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .maybeSingle()
  if (callerProfile?.role !== 'admin') {
    return res.status(403).json({ error: 'Solo un administrador puede invitar doctores.' })
  }

  const body = req.body ?? {}
  const doctorId = body.id ?? body.doctorId
  const first_name = (body.first_name ?? '').trim()
  const last_name = (body.last_name ?? '').trim()
  const specialty = (body.specialty ?? '').trim()
  const hospital_name = (body.hospital_name ?? '').trim()
  const phone = body.phone || null
  const email = (body.email ?? '').trim()
  const license_number = body.license_number || null
  const created_at = body.created_at || new Date().toISOString()

  if (
    !doctorId ||
    !first_name ||
    !last_name ||
    !specialty ||
    !hospital_name ||
    !email ||
    !email.includes('@')
  ) {
    return res.status(400).json({ error: 'Faltan datos obligatorios del doctor.' })
  }

  const redirectTo =
    (typeof body.redirectTo === 'string' && body.redirectTo) ||
    (req.headers.origin ? `${req.headers.origin}/login` : undefined)

  // 1. Fila del doctor (upsert idempotente por id).
  const { data: doctor, error: doctorError } = await service
    .from('doctors')
    .upsert(
      {
        id: doctorId,
        first_name,
        last_name,
        specialty,
        hospital_name,
        phone,
        email,
        license_number,
        created_at,
      },
      { onConflict: 'id' },
    )
    .select('*')
    .single()
  if (doctorError) {
    console.error('Error al guardar el doctor:', doctorError)
    return res.status(500).json({ error: 'No se pudo guardar el doctor en la base de datos.' })
  }

  // 2. Cuenta de Auth: invita por email para que el doctor defina su contraseña.
  const { data: invited, error: inviteError } = await service.auth.admin.inviteUserByEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  )
  if (inviteError) {
    if (/already registered|ya registrado|already been registered/i.test(inviteError.message)) {
      return res.status(409).json({
        error:
          'Ese correo ya tiene una cuenta. Puede recuperar su contraseña con "Olvidé mi contraseña" o editar el doctor para corregir el email.',
      })
    }
    console.error('Error al invitar al usuario:', inviteError)
    return res.status(400).json({ error: 'No se pudo enviar la invitación por correo.' })
  }

  const authUserId = invited?.user?.id
  if (!authUserId) {
    return res.status(500).json({ error: 'La invitación no devolvió un usuario de acceso.' })
  }

  // 3. Perfil de acceso enlazado a la fila del doctor.
  const { error: profileError } = await service
    .from('profiles')
    .upsert({ id: authUserId, role: 'doctor', doctor_id: doctorId }, { onConflict: 'id' })
  if (profileError) {
    console.error('Error al crear el perfil del doctor:', profileError)
    return res.status(500).json({ error: 'No se pudo crear el perfil de acceso del doctor.' })
  }

  return res.status(200).json({ doctor })
}