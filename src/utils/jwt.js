// Lightweight JWT payload decoder — no extra dependency needed since we only
// need the "role" claim client-side for route guarding. Server-side, the real
// gate is Spring Security's hasRole('ADMIN') on the /api/admin/** endpoints.
export function decodeJwtPayload(token) {
  if (!token) return null
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function getRoleFromToken(token) {
  return decodeJwtPayload(token)?.role || null
}
