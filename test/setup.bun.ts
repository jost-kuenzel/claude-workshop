import { expect, mock } from "bun:test";
import * as matchers from "@testing-library/jest-dom/matchers";

// happy-dom's GlobalRegistrator.register() is intentionally NOT called here.
// It overrides fetch/Request/Headers globals, which breaks NextRequest cookie
// parsing for API route tests. Component tests (none yet) that need a DOM
// should opt in by importing and calling GlobalRegistrator.register() in
// their own setup or at the top of the file.
expect.extend(matchers as never);

process.env.JWT_SECRET = "test-secret-key-for-vitest";

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
  usePathname: () => "/",
}));
