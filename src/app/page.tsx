import { redirect } from "next/navigation";
import { auth, type SessionUser } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user) redirect("/login");
  redirect(user.role === "ADMIN" ? "/admin" : "/studio");
}
