"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRandomSimpsonsCharacter, type SimpsonsCharacter } from "@/lib/simpsons";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [character, setCharacter] = useState<SimpsonsCharacter | null>(null);
  const [imageStatus, setImageStatus] = useState<"loading" | "ready" | "error">("loading");
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    // abort the fetch if it takes more than 8s, so a slow API degrades to the placeholder
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    getRandomSimpsonsCharacter(controller.signal)
      .then((char) => {
        setCharacter(char);
        setImageStatus("ready");
      })
      .catch(() => {
        setImageStatus("error");
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed");
        return;
      }

      // Small delay to ensure cookie is set before navigating
      await new Promise((resolve) => setTimeout(resolve, 100));
      router.push("/dashboard");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-row items-center gap-8">
        {/* Image column: visible only on md+ screens; purely decorative */}
        <div className="hidden md:flex items-center justify-center w-64 h-80">
          {imageStatus === "ready" && character ? (
            // Plain <img> keeps the fetch purely client-side (no Next server round-trip)
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={character.imageUrl}
              alt={character.name}
              width={256}
              height={320}
              className="rounded-lg object-cover w-full h-full"
            />
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full bg-muted text-muted-foreground rounded-lg">
              <span className="text-4xl">🍩</span>
              <span className="mt-2 text-sm font-medium">D&apos;oh!</span>
            </div>
          )}
        </div>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-center">ACME CRM</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
