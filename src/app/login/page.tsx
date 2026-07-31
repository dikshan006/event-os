import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn, type SessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";

async function login(formData: FormData) {
  "use server";
  const ip = ((await headers()).get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!rateLimit(`login:${ip}`, 10, 60_000)) redirect("/login?error=rate");
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (err) {
    if (err instanceof AuthError) redirect("/login?error=1");
    throw err; // NEXT_REDIRECT passes through
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string }> }) {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/studio");
  const { error, reset } = await searchParams;

  return (
    <div className="login">
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div className="script" style={{ fontSize: 56, color: "var(--rose)", lineHeight: 1 }}>W</div>
        <div style={{ fontSize: 12, letterSpacing: ".34em", textTransform: "uppercase", fontWeight: 500, marginTop: 6 }}>
          Wedding Planner OS
        </div>
        <p className="sub" style={{ margin: "10px auto 0" }}>One platform. Your brand. Every guest, personally invited.</p>
      </div>
      <form action={login} className="card pad frm" style={{ width: "100%", maxWidth: 380 }}>
        <div className="field"><label>Email</label>
          <input className="inp" name="email" type="email" required autoComplete="email" placeholder="you@studio.com" /></div>
        <div className="field"><label>Password</label>
          <input className="inp" name="password" type="password" required autoComplete="current-password" /></div>
        {error === "1" && <span style={{ color: "var(--wine)", fontSize: 12 }}>Invalid credentials, or your studio has been suspended.</span>}
        {error === "rate" && <span style={{ color: "var(--wine)", fontSize: 12 }}>Too many attempts — please wait a minute and try again.</span>}
        {reset && <span style={{ color: "var(--sage)", fontSize: 12 }}>Password updated — sign in with your new password.</span>}
        <button className="btn btn-primary" type="submit">Sign in</button>
        <div className="row between">
          <span className="hint">Guests use their personal /invite link.</span>
          <Link className="hint" href="/forgot-password" style={{ textDecoration: "underline" }}>Forgot password?</Link>
        </div>
      </form>
    </div>
  );
}
