"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Customer } from "@/lib/types";

interface CustomerFormProps {
  customer?: Customer;
  readOnly?: boolean;
}

export default function CustomerForm({ customer, readOnly = false }: CustomerFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    firstName: customer?.firstName || "",
    lastName: customer?.lastName || "",
    company: customer?.company || "",
    email: customer?.email || "",
    phone: customer?.phone || "",
    status: customer?.status || "active",
    lastContact: customer?.lastContact || "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const isEdit = !!customer;
      const res = await fetch(isEdit ? `/api/customers/${customer.id}` : "/api/customers", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        return;
      }

      router.push("/customers");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!customer || !confirm("Delete this customer?")) return;
    setLoading(true);
    try {
      await fetch(`/api/customers/${customer.id}`, { method: "DELETE" });
      router.push("/customers");
    } catch {
      setError("Delete failed");
    } finally {
      setLoading(false);
    }
  }

  const fields = [
    { name: "firstName", label: "First Name" },
    { name: "lastName", label: "Last Name" },
    { name: "company", label: "Company" },
    { name: "email", label: "Email" },
    { name: "phone", label: "Phone" },
    { name: "lastContact", label: "Last Contact" },
  ] as const;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {fields.map(({ name, label }) => (
          <div key={name} className="space-y-1">
            <Label htmlFor={name}>{label}</Label>
            <Input
              id={name}
              name={name}
              type={name === "email" ? "email" : name === "lastContact" ? "date" : "text"}
              value={form[name]}
              onChange={handleChange}
              disabled={readOnly || loading}
              required
            />
          </div>
        ))}
        <div className="space-y-1">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            value={form.status}
            onChange={handleChange}
            disabled={readOnly || loading}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {!readOnly && (
        <div className="flex items-center justify-between pt-2">
          <div>
            {customer && (
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/customers")}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : customer ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
