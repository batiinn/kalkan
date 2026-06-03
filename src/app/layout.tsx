import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kalkan — Ücretsiz Web Güvenlik Tarayıcısı",
  description:
    "Sitenizin güvenliğini saniyeler içinde ücretsiz tarayın: SSL/TLS, güvenlik header'ları, SPF/DMARC, çerez güvenliği, açıkta kalan dosyalar ve subdomain keşfi. Türkçe, puanlı, açık kaynak.",
  keywords: ["web güvenlik tarama", "ssl kontrol", "güvenlik header", "dmarc", "kvkk", "ücretsiz güvenlik testi"],
  openGraph: {
    title: "Kalkan — Ücretsiz Web Güvenlik Tarayıcısı",
    description: "Sitenizin güvenliğini saniyeler içinde Türkçe ve ücretsiz tarayın.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
