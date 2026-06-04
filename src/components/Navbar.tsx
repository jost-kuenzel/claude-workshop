"use client";

import { useEffect, useState } from "react";
import UserMenu from "@/components/UserMenu";

interface UserInfo {
  name: string;
  email: string;
}

export default function Navbar() {
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setUser(data))
      .catch(() => {});
  }, []);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
        {user && <UserMenu name={user.name} email={user.email} />}
      </div>
    </header>
  );
}
