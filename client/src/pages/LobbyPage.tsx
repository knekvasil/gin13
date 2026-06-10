import { useAuth } from "../auth/AuthContext";

export default function LobbyPage() {
  const { user, logout, token } = useAuth();

  return (
    <div>
      <h1>Gin 13</h1>
      <p>Welcome, {user?.displayName}!</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
