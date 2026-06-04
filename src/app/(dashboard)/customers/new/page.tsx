"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CustomerForm from "../_components/CustomerForm";

export default function NewCustomerPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.role !== "admin") {
          router.push("/customers");
        } else {
          setIsAdmin(true);
        }
      })
      .catch(() => router.push("/customers"));
  }, [router]);

  if (isAdmin === null) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">New Customer</h1>
      <CustomerForm />
    </div>
  );
}
