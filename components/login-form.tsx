"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogIn } from "lucide-react";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(formData: FormData) {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error || "Login gagal.");
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  return (
    <form action={submit} className="space-y-3">
      <label>
        <span className="mb-1 block text-sm font-medium">Username</span>
        <input className="field" name="username" defaultValue="admin" required />
      </label>
      <label>
        <span className="mb-1 block text-sm font-medium">Password</span>
        <input className="field" name="password" type="password" required />
      </label>
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <button className="btn btn-primary w-full" disabled={loading}>
        <LogIn size={16} />
        Login
      </button>
    </form>
  );
}
