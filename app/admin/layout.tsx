"use client";

import AdminDashboard, { AdminSecao } from "@/components/admin/AdminDashboard";
import { usePathname } from "next/navigation";

const obterSecaoAtiva = (pathname: string): AdminSecao => {
  if (pathname.startsWith("/admin/alunos")) return "alunos";
  if (pathname.startsWith("/admin/matriculas")) return "matriculas";
  if (pathname.startsWith("/admin/turmas")) return "turmas";
  if (pathname.startsWith("/admin/quadras")) return "aluguel";
  if (pathname.startsWith("/admin/professores")) return "professores";
  return "solicitacoes";
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const secaoAtiva = obterSecaoAtiva(pathname);

  return (
    <>
      <AdminDashboard secaoAtiva={secaoAtiva} />
      <div className="hidden">{children}</div>
    </>
  );
}
