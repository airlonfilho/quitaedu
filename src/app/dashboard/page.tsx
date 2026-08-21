import { auth, signOut } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <main style={{ maxWidth: 480, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>Dashboard</h1>
      <p>Logado como {session?.user?.email}</p>
      <p>Papel: {session?.user?.role}</p>
      <p>schoolId: {session?.user?.schoolId ?? "(admin da plataforma)"}</p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button type="submit">Sair</button>
      </form>
    </main>
  );
}
