import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InsureAI — Secure Agent Chat Studio",
  description:
    "Multi-tenant insurance AI chat system powered by Cerbos ABAC, MongoDB, and Azure OpenAI. Zero-trust data isolation for insurance agents.",
  keywords: ["insurance", "AI", "ABAC", "Cerbos", "MongoDB", "Zero-Trust"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛡️</text></svg>" />
      </head>
      <body className="h-full bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
