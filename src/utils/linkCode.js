const LINK_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const LINK_LENGTH = 6
const LINK_CHARS = new Set(LINK_ALPHABET)

/** Genera un código corto de 6 caracteres (sin 0/O ni 1/I/l). */
export function generateLinkCode() {
  let code = ''
  const bytes = new Uint32Array(LINK_LENGTH)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < LINK_LENGTH; i++) {
    code += LINK_ALPHABET[bytes[i] % LINK_ALPHABET.length]
  }
  return code
}

export function isValidLinkCode(code) {
  if (!code || code.length !== LINK_LENGTH) return false
  for (const char of String(code)) {
    if (!LINK_CHARS.has(char)) return false
  }
  return true
}