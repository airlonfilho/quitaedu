import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function authenticate(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/dashboard",
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect("/login?error=1");
      }
      throw err;
    }
  }

  return (
    <main style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>Entrar — Quitaedu</h1>
      {error && <p style={{ color: "crimson" }}>Credenciais inválidas.</p>}
      <form
        action={authenticate}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <label>
          E-mail
          <input name="email" type="email" required style={{ display: "block", width: "100%" }} />
        </label>
        <label>
          Senha
          <input name="password" type="password" required style={{ display: "block", width: "100%" }} />
        </label>
        <button type="submit">Entrar</button>
      </form>
    </main>
  );
}
