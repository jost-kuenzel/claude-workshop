import { NextRequest } from 'next/server'
import { signToken } from '@/lib/auth'
import type { JwtPayload } from '@/lib/types'

export const ADMIN_PAYLOAD: JwtPayload = {
  userId: 1,
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'admin',
}

export const VIEWER_PAYLOAD: JwtPayload = {
  userId: 2,
  email: 'viewer@example.com',
  name: 'Viewer User',
  role: 'viewer',
}

export function makeAuthCookie(payload: JwtPayload): string {
  const token = signToken(payload)
  return `${process.env.COOKIE_NAME || 'crm_token'}=${token}`
}

export function makeRequest(
  url: string,
  options: {
    method?: string
    body?: any
    cookie?: string
    headers?: Record<string, string>
  } = {}
) {
  const { method = 'GET', body, cookie, headers = {} } = options

  // Ensure URL is absolute
  const fullUrl = url.startsWith('http') ? url : `http://localhost${url}`

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }

  if (cookie) {
    requestHeaders['Cookie'] = cookie
  }

  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders,
  }

  if (body) {
    requestOptions.body = JSON.stringify(body)
  }

  return new NextRequest(fullUrl, requestOptions)
}