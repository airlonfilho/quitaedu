import { auth } from "@/auth";

export default async function AdminPage() {
  const session = await auth();

  return (
    <main style={{ maxWidth: 480, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>Área do Admin</h1>
      <p>Logado como {session?.user?.email} ({session?.user?.role})</p>
    </main>
  );
}
