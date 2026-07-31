import { redirect } from "next/navigation";
import { resetPassword } from "@/server/services/passwordReset";

async function doReset(formData: FormData) {
  "use server";
  const token = String(formData.get("token"));
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) redirect(`/reset-password/${token}?error=short`);
  if (password !== confirm) redirect(`/reset-password/${token}?error=match`);
  const ok = await resetPassword(token, password);
  redirect(ok ? "/login?reset=1" : `/reset-password/${token}?error=invalid`);
}

export default async function ResetPassword({ params, searchParams }: {
  params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const messages: Record<string, string> = {
    short: "Password must be at least 8 characters.",
    match: "Passwords don't match.",
    invalid: "This reset link is invalid, already used, or expired — request a new one.",
  };
  return (
    <div className="login">
      <form action={doReset} className="card pad frm" style={{ width: "100%", maxWidth: 380 }}>
        <h1 className="section-t" style={{ marginBottom: 0 }}>Choose a new password</h1>
        <input type="hidden" name="token" value={token} />
        <div className="field"><label>New password</label>
          <input className="inp" name="password" type="password" required minLength={8} autoComplete="new-password" /></div>
        <div className="field"><label>Confirm password</label>
          <input className="inp" name="confirm" type="password" required autoComplete="new-password" /></div>
        {error && <span style={{ color: "var(--wine)", fontSize: 12 }}>{messages[error] ?? "Something went wrong."}</span>}
        <button className="btn btn-primary" type="submit">Update password</button>
      </form>
    </div>
  );
}
