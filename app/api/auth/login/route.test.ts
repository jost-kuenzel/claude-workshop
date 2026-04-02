import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { POST } from '@/app/api/auth/login/route'
import { getDb } from '@/lib/db'
import Database from 'better-sqlite3'
import { createTestDb, seedUser } from '@/test/db-helpers'
import { makeRequest } from '@/test/request-helpers'

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

describe('POST /api/auth/login', () => {
  it('should return 400 when email/password missing', async () => {
    const req = makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'test@example.com' }, // missing password
    })
    
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Email and password are required')
  })

  it('should return 401 for unknown email', async () => {
    const req = makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'unknown@example.com', password: 'password123' },
    })
    
    const res = await POST(req)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe('Invalid email or password')
  })

  it('should return 401 for wrong password', async () => {
    await seedUser(testDb, {
      email: 'test@example.com',
      password: 'correctpassword',
    })
    
    const req = makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'test@example.com', password: 'wrongpassword' },
    })
    
    const res = await POST(req)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe('Invalid email or password')
  })

  it('should return 200 + set-cookie header for correct credentials', async () => {
    await seedUser(testDb, {
      email: 'test@example.com',
      password: 'password123',
    })
    
    const req = makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'test@example.com', password: 'password123' },
    })
    
    const res = await POST(req)
    expect(res.status).toBe(200)
    
    // Check set-cookie header
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toBeTruthy()
    expect(setCookie).toContain('crm_token=')
    
    const data = await res.json()
    expect(data.message).toBe('Logged in')
  })

  it('should return decoded token matching user payload', async () => {
    await seedUser(testDb, {
      id: 1,
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      role: 'admin',
    })
    
    const req = makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'test@example.com', password: 'password123' },
    })
    
    const res = await POST(req)
    const setCookie = res.headers.get('set-cookie')
    
    // Extract token from cookie
    const token = setCookie?.split('=')[1]?.split(';')[0]
    expect(token).toBeTruthy()
    
    // Verify token contains expected payload
    const payload = JSON.parse(Buffer.from(token!.split('.')[1], 'base64').toString())
    expect(payload.userId).toBe(1)
    expect(payload.email).toBe('test@example.com')
    expect(payload.name).toBe('Test User')
    expect(payload.role).toBe('admin')
  })
})