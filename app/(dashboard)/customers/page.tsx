"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import CustomerList from "./_components/CustomerList";

export default function CustomersPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setIsAdmin(data.role === "admin"))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customers</h1>
        {isAdmin && (
          <Button asChild>
            <Link href="/customers/new">New Customer</Link>
          </Button>
        )}
      </div>
      <CustomerList />
    </div>
  );
}
