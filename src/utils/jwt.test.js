import { describe, it, expect } from 'vitest'
import { decodeJwtPayload, getRoleFromToken } from './jwt'

// Token dummy hasil encode base64url dari:
// header: { alg: "HS256", typ: "JWT" }
// payload: { sub: "admin", role: "ADMIN", iat: 1234567890 }
// (signature-nya sengaja diisi string apa aja karena decodeJwtPayload cuma
// baca payload, sama seperti behaviour aslinya di jwt.js — verifikasi
// signature tetap tanggung jawab backend)
const VALID_TOKEN =
  'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJzdWIiOiAiYWRtaW4iLCAicm9sZSI6ICJBRE1JTiIsICJpYXQiOiAxMjM0NTY3ODkwfQ.fakesignature'

describe('decodeJwtPayload', () => {
  it('mengembalikan null kalau token kosong atau tidak ada', () => {
    expect(decodeJwtPayload(null)).toBeNull()
    expect(decodeJwtPayload(undefined)).toBeNull()
    expect(decodeJwtPayload('')).toBeNull()
  })

  it('mengembalikan null kalau token bukan JWT yang valid', () => {
    expect(decodeJwtPayload('bukan-token-jwt')).toBeNull()
    expect(decodeJwtPayload('a.b')).toBeNull()
  })

  it('men-decode payload dari token JWT yang valid', () => {
    const payload = decodeJwtPayload(VALID_TOKEN)
    expect(payload).toEqual({
      sub: 'admin',
      role: 'ADMIN',
      iat: 1234567890,
    })
  })
})

describe('getRoleFromToken', () => {
  it('mengembalikan role dari token yang valid', () => {
    expect(getRoleFromToken(VALID_TOKEN)).toBe('ADMIN')
  })

  it('mengembalikan null kalau token tidak valid', () => {
    expect(getRoleFromToken('token-rusak')).toBeNull()
  })

  it('mengembalikan null kalau token tidak ada', () => {
    expect(getRoleFromToken(null)).toBeNull()
  })
})
