import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  title: "Personal Deal Scout",
  description: "Private real estate deal sourcing and acquisitions manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" data-scroll-behavior="smooth">
      <head><script dangerouslySetInnerHTML={{ __html: `try{const c=localStorage.getItem("deal-scout-theme-color-v1")||localStorage.getItem("deal-scout-map-rank-color");if(/^#[0-9a-f]{6}$/i.test(c||"")){localStorage.setItem("deal-scout-theme-color-v1",c);document.documentElement.dataset.themeColor=c;document.documentElement.style.setProperty("--accent",c)}}catch{}` }} /></head>
      <body className="min-h-full flex flex-col">
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
