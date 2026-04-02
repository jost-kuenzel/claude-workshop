import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Set JWT secret for testing
process.env.JWT_SECRET = 'test-secret-key-for-vitest'

// Mock Next.js navigation for tests that might import it
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
}))