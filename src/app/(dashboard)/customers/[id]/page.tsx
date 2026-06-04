"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import CustomerForm from "../_components/CustomerForm";
import type { Customer } from "@/lib/types";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [customerRes, meRes] = await Promise.all([
          fetch(`/api/customers/${id}`),
          fetch("/api/auth/me"),
        ]);
        const customerData = await customerRes.json();
        const meData = await meRes.json();
        setCustomer(customerData);
        setIsAdmin(meData.role === "admin");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (!customer) return <p className="text-sm text-red-500">Customer not found.</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">
        {customer.firstName} {customer.lastName}
      </h1>
      <CustomerForm customer={customer} readOnly={!isAdmin} />
    </div>
  );
}
