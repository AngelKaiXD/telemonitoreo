const FRIENDLY_MESSAGES = [
  {
    test: (error) =>
      error?.message?.toLowerCase().includes('invalid login credentials'),
    message: 'Credenciales incorrectas. Verifica el email y la contraseña.',
  },
  {
    test: (error) =>
      error?.message?.toLowerCase().includes('row-level security') ||
      error?.code === '42501' ||
      error?.code === '42503',
    message:
      'Tu rol no tiene permiso para realizar esta acción en la base de datos.',
  },
  {
    test: (error) => error?.code === '23505',
    message: 'Este registro ya existe o está duplicado.',
  },
  {
    test: (error) => error?.code === '23503',
    message: 'No se pudo guardar porque depende de un registro inexistente.',
  },
  {
    test: (error) =>
      /network|failed to fetch|fetch failed|load failed/i.test(
        error?.message ?? '',
      ),
    message:
      'Sin conexión con el servidor. Revisa tu internet y vuelve a intentarlo.',
  },
]

export function toUserMessage(error, fallback = 'Ocurrió un error inesperado.') {
  if (!error) return fallback
  if (error?.userMessage) return error.userMessage
  for (const rule of FRIENDLY_MESSAGES) {
    if (rule.test(error)) return rule.message
  }
  if (error?.message) return `${fallback} Detalle: ${error.message}`
  return fallback
}