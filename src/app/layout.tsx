import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wedding Planner OS",
  description: "The operating system for professional wedding planners.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
