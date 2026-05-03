import { describe, it, expect } from "bun:test";
import { POST } from "@/app/api/auth/logout/route";

describe("POST /api/auth/logout", () => {
  it('should return 200 with message "Logged out"', async () => {
    const res = await POST();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.message).toBe("Logged out");
  });

  it("should set-cookie clears crm_token (maxAge=0)", async () => {
    const res = await POST();

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("crm_token=");
    expect(setCookie).toContain("Max-Age=0");
  });
});
