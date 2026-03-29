import React, { useState } from "react";
import "../styles/admin-login.css";

export default function AdminLogin({ onSuccess, onCancel }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    // Simple client-side check (username: Franklin, password: Cudjoe)
    if (user === "Franklin" && pass === "Cudjoe") {
      const token = btoa(`${user}:${pass}`);
      sessionStorage.setItem("adminAuth", "true");
      sessionStorage.setItem("adminAuthToken", token);
      setError("");
      if (onSuccess) onSuccess();
    } else {
      setError("Invalid credentials");
    }
  }

  return (
    <div className="admin-login container">
      <h2>Admin Sign In</h2>
      <form onSubmit={handleSubmit} className="admin-login-form">
        <label>Username</label>
        <input value={user} onChange={(e) => setUser(e.target.value)} />
        <label>Password</label>
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />
        {error && <div style={{ color: "#b94f59", marginTop: 8 }}>{error}</div>}
        <div style={{ marginTop: 12 }}>
          <button className="btn" type="submit">
            Sign in
          </button>
          <button
            className="btn secondary"
            type="button"
            onClick={onCancel}
            style={{ marginLeft: 8 }}
          >
            Cancel
          </button>
        </div>
      </form>
      <div style={{ marginTop: 12, color: "var(--muted)", fontSize: ".9rem" }}>
        Use username <strong>Franklin</strong> and password{" "}
        <strong>Cudjoe</strong> to sign in.
      </div>
    </div>
  );
}
