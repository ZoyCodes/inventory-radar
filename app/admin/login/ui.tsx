"use client";

import { ShieldAlert } from "lucide-react";
import { FormEvent, useState } from "react";

export default function AdminLogin() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      setError("Invalid admin token.");
      return;
    }

    window.location.href = "/admin";
  }

  return (
    <main className="admin-login-shell">
      <form className="admin-login" onSubmit={submit}>
        <ShieldAlert size={26} />
        <h1>Admin Access</h1>
        <label>
          Admin token
          <input
            autoComplete="current-password"
            onChange={(event) => setToken(event.target.value)}
            type="password"
            value={token}
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary-button full" type="submit">
          Sign in
        </button>
      </form>
    </main>
  );
}
