import React, { useState } from "react";
import "../styles/admin-login.css";
import { verifyAdminCredentials } from "../services/storeApi.js";

export default function AdminLogin({ onSuccess, onCancel }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const token = await verifyAdminCredentials(user, pass);
      sessionStorage.setItem("adminAuth", "true");
      sessionStorage.setItem("adminAuthToken", token);
      if (onSuccess) onSuccess();
    } catch (e) {
      setError("That sign in did not work.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login container">
      <h2>Store Owner Sign In</h2>
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
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
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
    </div>
  );
}
