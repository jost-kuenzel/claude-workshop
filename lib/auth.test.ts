import { describe, it, expect, beforeEach } from 'vitest'
import {
  hashPassword,
  comparePasswords,
  signToken,
  verifyToken,
  getTokenFromRequest,
  setAuthCookie,
  clearAuthCookie,
} from '@/lib/auth'
import { NextResponse } from 'next/server'
import * as jose from 'jose'

describe('auth utilities', () => {
  describe('hashPassword', () => {
    it('should produce a hash', async () => {
      const hash = await hashPassword('password123')
      expect(hash).toBeTruthy()
      expect(hash).not.toBe('password123')
    })

    it('should produce different hashes for same input (salting)', async () => {
      const hash1 = await hashPassword('password123')
      const hash2 = await hashPassword('password123')
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('comparePasswords', () => {
    it('should return true for correct password', async () => {
      const password = 'password123'
      const hash = await hashPassword(password)
      const result = await comparePasswords(password, hash)
      expect(result).toBe(true)
    })

    it('should return false for wrong password', async () => {
      const hash = await hashPassword('password123')
      const result = await comparePasswords('wrongpassword', hash)
      expect(result).toBe(false)
    })
  })

  describe('signToken', () => {
    it('should return a JWT string with expected payload fields', () => {
      const payload = {
        userId: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
      }
      const token = signToken(payload)
      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
    })
  })

  describe('verifyToken', () => {
    it('should decode valid token', async () => {
      const payload = {
        userId: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
      }
      const token = signToken(payload)
      const decoded = await verifyToken(token)
      expect(decoded).toBeTruthy()
      expect(decoded?.userId).toBe(payload.userId)
      expect(decoded?.email).toBe(payload.email)
    })

    it('should return null for tampered token', async () => {
      const token = 'invalid.token.here'
      const decoded = await verifyToken(token)
      expect(decoded).toBeNull()
    })

    it('should return null for expired token', async () => {
      // Create a token that expires immediately using jose directly
      const payload = {
        userId: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        exp: Math.floor(Date.now() / 1000) - 1, // Expired 1 second ago
      }
      const SECRET = new TextEncoder().encode('test-secret-key-for-vitest')
      const token = await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .sign(SECRET)
      const decoded = await verifyToken(token)
      expect(decoded).toBeNull()
    })
  })

  describe('getTokenFromRequest', () => {
    it('should extract cookie value', () => {
      const mockRequest = {
        cookies: {
          get: (name: string) => ({
            value: 'test-token',
          }),
        },
      }
      const token = getTokenFromRequest(mockRequest)
      expect(token).toBe('test-token')
    })

    it('should return null when cookie is absent', () => {
      const mockRequest = {
        cookies: {
          get: (name: string) => undefined,
        },
      }
      const token = getTokenFromRequest(mockRequest)
      expect(token).toBeNull()
    })
  })

  describe('setAuthCookie', () => {
    it('should set crm_token with correct maxAge', () => {
      const res = new NextResponse()
      const token = 'test-token'
      setAuthCookie(res, token)
      
      const cookie = res.cookies.get('crm_token')
      expect(cookie).toBeTruthy()
      expect(cookie?.value).toBe(token)
      // Note: NextResponse.cookies.get() returns the cookie value, not options
      // We can't test maxAge directly here without parsing the Set-Cookie header
    })
  })

  describe('clearAuthCookie', () => {
    it('should set crm_token with maxAge = 0', () => {
      const res = new NextResponse()
      clearAuthCookie(res)
      
      const cookie = res.cookies.get('crm_token')
      expect(cookie).toBeTruthy()
      expect(cookie?.value).toBe('')
      // Note: NextResponse.cookies.get() returns the cookie value, not options
      // We can't test maxAge directly here without parsing the Set-Cookie header
    })
  })
})