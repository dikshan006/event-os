import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requestPasswordReset } from "@/server/services/passwordReset";
import { rateLimit } from "@/lib/ratelimit";

async function request(formData: FormData) {
  "use server";
  const ip = ((await headers()).get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (rateLimit(`forgot:${ip}`, 5, 60_000)) {
    await requestPasswordReset(String(formData.get("email") ?? ""));
  }
  // Always the same outcome — never reveals whether the account exists.
  redirect("/forgot-password?sent=1");
}

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  return (
    <div className="login">
      <form action={request} className="card pad frm" style={{ width: "100%", maxWidth: 380 }}>
        <h1 className="section-t" style={{ marginBottom: 0 }}>Reset your password</h1>
        {sent ? (
          <p className="sub">If an account exists for that address, a reset link is on its way. The link is valid for 60 minutes.</p>
        ) : (
          <>
            <p className="sub">Enter your account email and we&apos;ll send a reset link.</p>
            <div className="field"><label>Email</label>
              <input className="inp" name="email" type="email" required autoComplete="email" /></div>
            <button className="btn btn-primary" type="submit">Send reset link</button>
          </>
        )}
        <a className="hint" href="/login" style={{ textDecoration: "underline" }}>Back to sign in</a>
      </form>
    </div>
  );
}
