import { mock } from "bun:test";

process.env.JWT_SECRET = "test-secret-key-for-vitest";

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
  usePathname: () => "/",
}));
