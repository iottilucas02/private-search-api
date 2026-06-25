import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Private Search API",
  description: "Servico privado de pesquisa com fila, scraping e rastreabilidade de fontes."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
