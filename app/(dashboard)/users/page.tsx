"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import Pagination from "@/components/Pagination";
import type { User } from "@/lib/types";

interface UserWithoutPassword extends Omit<User, "password"> {}

interface CurrentUser extends Omit<User, "password"> {}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserWithoutPassword[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 10;

  // Fetch current user info and check auth
  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/dashboard");
          return;
        }
        const data = await res.json();
        if (data.role !== "admin") {
          router.push("/dashboard");
          return;
        }
        setCurrentUser(data);
      } catch {
        router.push("/dashboard");
      }
    }

    fetchCurrentUser();
  }, [router]);

  // Fetch users list
  async function fetchUsers(p: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/users?page=${p}&limit=${limit}`);
      if (!res.ok) {
        router.push("/dashboard");
        return;
      }
      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (currentUser) {
      fetchUsers(page);
    }
  }, [page, currentUser]);

  if (loading || !currentUser) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Users</h1>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-8">
                      <AvatarImage
                        src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(
                          user.email
                        )}`}
                        alt={user.name}
                      />
                      <AvatarFallback>
                        {user.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-2">
                      <span>{user.name}</span>
                      {user.id === currentUser.id && (
                        <Badge variant="outline">me</Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end">
        <Pagination page={page} total={total} limit={limit} onPageChange={setPage} />
      </div>
    </div>
  );
}
