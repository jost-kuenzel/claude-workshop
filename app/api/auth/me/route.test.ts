import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET } from '@/app/api/auth/me/route'
import { getDb } from '@/lib/db'
import Database from 'better-sqlite3'
import { createTestDb, seedUser } from '@/test/db-helpers'
import { makeRequest, makeAuthCookie, ADMIN_PAYLOAD, VIEWER_PAYLOAD } from '@/test/request-helpers'

vi.mock('@/lib/db', () => ({ getDb: vi.fn() }))

let testDb: Database.Database

beforeEach(async () => {
  testDb = createTestDb()
  vi.mocked(getDb).mockReturnValue(testDb)
})

afterEach(() => {
  testDb.close()
  vi.clearAllMocks()
})

describe('GET /api/auth/me', () => {
  it('should return 401 when no cookie', async () => {
    const req = makeRequest('/api/auth/me')

    const res = await GET(req)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 401 for invalid token', async () => {
    const req = makeRequest('/api/auth/me', { cookie: 'crm_token=invalid.token.here' })

    const res = await GET(req)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 200 with user payload for valid admin token', async () => {
    await seedUser(testDb, ADMIN_PAYLOAD)

    const req = makeRequest('/api/auth/me', { cookie: makeAuthCookie(ADMIN_PAYLOAD) })

    const res = await GET(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data).toEqual({
      id: ADMIN_PAYLOAD.userId,
      email: ADMIN_PAYLOAD.email,
      name: ADMIN_PAYLOAD.name,
      role: ADMIN_PAYLOAD.role,
    })
  })

  it('should return 200 with user payload for valid viewer token', async () => {
    await seedUser(testDb, VIEWER_PAYLOAD)

    const req = makeRequest('/api/auth/me', { cookie: makeAuthCookie(VIEWER_PAYLOAD) })

    const res = await GET(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data).toEqual({
      id: VIEWER_PAYLOAD.userId,
      email: VIEWER_PAYLOAD.email,
      name: VIEWER_PAYLOAD.name,
      role: VIEWER_PAYLOAD.role,
    })
  })
})