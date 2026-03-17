"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  UserCheck,
} from "lucide-react";

import { Matricula, SolicitacaoAula } from "@/types";
import { buscarMinhaAgenda } from "@/services/agendaService";
import {
  buscarContextoSolicitacoesAluno,
  ContextoSolicitacoesAluno,
} from "@/services/solicitacaoAlunoService";

const ORDEM_DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const formatarDataCurta = (valor?: string | null) => {
  if (!valor) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${valor}T12:00:00`));
};

const obterClasseSolicitacao = (solicitacao: SolicitacaoAula) => {
  if (solicitacao.status === "agendado") {
    return "border-cyan-500/20 bg-cyan-500/10 text-cyan-300";
  }

  if (solicitacao.status === "aprovada_para_matricula" || solicitacao.status === "matricula_em_andamento") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (solicitacao.status === "faltou") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  }

  if (solicitacao.status === "aguardando_aceite_professor") {
    return "border-violet-500/20 bg-violet-500/10 text-violet-300";
  }

  return "border-orange-500/20 bg-orange-500/10 text-orange-300";
};

const obterLabelSolicitacao = (solicitacao: SolicitacaoAula) => {
  const ehMatricula = (solicitacao.tipo_solicitacao || "experimental") === "matricula";

  if (ehMatricula) {
    if (solicitacao.status === "aguardando_aceite_professor") return "Aguardando aceite";
    if (solicitacao.status === "matricula_em_andamento") return "Plano em montagem";
    return "Solicitação enviada";
  }

  if (solicitacao.status === "agendado") return "Experimental agendada";
  if (solicitacao.status === "faltou") return "Faltou na experimental";
  if (solicitacao.status === "aprovada_para_matricula") return "Pronto para matrícula";
  if (solicitacao.status === "matricula_em_andamento") return "Plano em montagem";
  if (solicitacao.status === "aguardando_aceite_professor") return "Aguardando aceite";
  return "Solicitação enviada";
};

const obterDescricaoSolicitacao = (solicitacao: SolicitacaoAula) => {
  const ehMatricula = (solicitacao.tipo_solicitacao || "experimental") === "matricula";

  if (ehMatricula) {
    if (solicitacao.status === "aguardando_aceite_professor") {
      return "Seu pedido de matrícula já foi direcionado e aguarda o aceite do professor responsável.";
    }

    if (solicitacao.status === "matricula_em_andamento") {
      return "Seu plano está sendo montado pela equipe com base nos horários escolhidos.";
    }

    return "Recebemos seu pedido de retorno ou matrícula. Em breve a equipe entra em contato.";
  }

  if (solicitacao.status === "agendado") {
    return solicitacao.data_aula_experimental
      ? `Sua aula experimental está marcada para ${formatarDataCurta(solicitacao.data_aula_experimental)}.`
      : "Sua aula experimental já foi marcada.";
  }

  if (solicitacao.status === "faltou") {
    return "Sua aula experimental não aconteceu. Aguarde novo contato da equipe para remarcar ou encerrar o fluxo.";
  }

  if (solicitacao.status === "aprovada_para_matricula") {
    return "Você já pode seguir para a montagem do plano com a equipe.";
  }

  if (solicitacao.status === "matricula_em_andamento") {
    return "Seu plano está sendo montado pela equipe.";
  }

  if (solicitacao.status === "aguardando_aceite_professor") {
    return "Sua solicitação foi direcionada para um professor e está aguardando aceite.";
  }

  return "Recebemos sua solicitação e ela já está em andamento com a equipe.";
};

const obterLabelStatusMatricula = (status: Matricula["status"]) => {
  if (status === "experimental") return "Experimental";
  if (status === "ativo") return "Liberado";
  if (status === "aguardando_dados") return "Aguardando dados";
  if (status === "aguardando_pagamento") return "Aguardando pagamento";
  if (status === "aguardando_aceite_professor") return "Aguardando aceite";
  return "Em andamento";
};

const obterClasseStatusMatricula = (status: Matricula["status"]) => {
  if (status === "experimental") return "border-cyan-500/20 bg-cyan-500/10 text-cyan-300";
  if (status === "ativo") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  if (status === "aguardando_dados") return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  if (status === "aguardando_pagamento") return "border-orange-500/20 bg-orange-500/10 text-orange-300";
  if (status === "aguardando_aceite_professor") return "border-violet-500/20 bg-violet-500/10 text-violet-300";
  return "border-slate-700 bg-slate-900 text-slate-300";
};

const obterRotuloReferenciaMatricula = (status: Matricula["status"]) => {
  if (status === "experimental") return "Data da aula";
  if (status === "ativo") return "Início do plano";
  return "Liberação";
};

const obterTextoReferenciaMatricula = (aula: Matricula) => {
  if (aula.status === "experimental") {
    return aula.data_inicio ? formatarDataCurta(aula.data_inicio) : "A definir";
  }

  if (aula.status === "ativo") {
    return aula.data_inicio ? formatarDataCurta(aula.data_inicio) : "Já liberado";
  }

  if (aula.status === "aguardando_dados") {
    return "Após concluir seus dados";
  }

  if (aula.status === "aguardando_pagamento") {
    return "Após confirmar o pagamento";
  }

  if (aula.status === "aguardando_aceite_professor") {
    return "Após o aceite do professor";
  }

  return "Em andamento";
};

const ordenarAulas = (aulas: Matricula[]) =>
  [...aulas].sort((a, b) => {
    const diaA = ORDEM_DIAS_SEMANA.indexOf(a.turmas?.dia_semana || "");
    const diaB = ORDEM_DIAS_SEMANA.indexOf(b.turmas?.dia_semana || "");

    if (diaA !== diaB) return diaA - diaB;
    return (a.turmas?.horario || "").localeCompare(b.turmas?.horario || "");
  });

export default function AgendaPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [minhasAulas, setMinhasAulas] = useState<Matricula[]>([]);
  const [contextoAluno, setContextoAluno] = useState<ContextoSolicitacoesAluno | null>(null);

  useEffect(() => {
    async function carregarDados() {
      try {
        const [aulas, contexto] = await Promise.all([
          buscarMinhaAgenda(),
          buscarContextoSolicitacoesAluno(),
        ]);
        setMinhasAulas(aulas);
        setContextoAluno(contexto);
      } catch {
        router.push("/entrar");
      } finally {
        setCarregando(false);
      }
    }

    carregarDados();
  }, [router]);

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (contextoAluno?.perfil && contextoAluno.perfil.tipo !== "aluno") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 pb-20">
        <main className="max-w-2xl mx-auto px-6 pt-10">
          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/40 p-8 text-center">
            <CalendarDays className="mx-auto mb-4 h-10 w-10 text-orange-500" />
            <h1 className="text-2xl font-bold text-white">Esta área é voltada para alunos</h1>
            <p className="mt-2 text-sm text-slate-400">
              Para acompanhar o dia a dia da operação, use o painel da equipe.
            </p>
            <Link
              href={contextoAluno.perfil.tipo === "admin" || contextoAluno.perfil.tipo === "professor" ? "/admin" : "/"}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-slate-200"
            >
              Ir para o painel
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const solicitacaoAtiva = contextoAluno?.solicitacaoAtiva || null;
  const mostrarSolicitarMatricula =
    contextoAluno?.perfil?.tipo === "aluno" && !!contextoAluno?.podeSolicitarMatricula;
  const mostrarSolicitarExperimental =
    contextoAluno?.perfil?.tipo === "aluno" && !!contextoAluno?.podeSolicitarExperimental;

  const aulasOrdenadas = ordenarAulas(minhasAulas);
  const aulasPorDia = ORDEM_DIAS_SEMANA.map((dia) => ({
    dia,
    aulas: aulasOrdenadas.filter((aula) => aula.turmas?.dia_semana === dia),
  })).filter((grupo) => grupo.aulas.length > 0);

  const naoTemNadaParaMostrar = !solicitacaoAtiva && aulasPorDia.length === 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-orange-500 selection:text-white pb-20">
      <main className="max-w-4xl mx-auto px-6 pt-10 space-y-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-white">
            <CalendarDays className="h-8 w-8 text-orange-500" />
            Minha Agenda
          </h1>
          <p className="mt-2 text-slate-400">
            Veja o andamento da sua solicitação e os dias em que você está marcado para treinar.
          </p>
        </motion.div>

        {solicitacaoAtiva && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2rem] border border-slate-800 bg-slate-900 p-6 sm:p-8"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Minha solicitação</p>
                <h2 className="mt-2 text-2xl font-bold text-white">
                  {(solicitacaoAtiva.tipo_solicitacao || "experimental") === "matricula"
                    ? "Solicitação de Matrícula"
                    : "Aula Experimental"}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                  {obterDescricaoSolicitacao(solicitacaoAtiva)}
                </p>
              </div>

              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${obterClasseSolicitacao(
                  solicitacaoAtiva
                )}`}
              >
                {obterLabelSolicitacao(solicitacaoAtiva)}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {solicitacaoAtiva.professor_preferido?.nome && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Professor escolhido</p>
                  <p className="mt-1 text-sm font-medium text-slate-200">{solicitacaoAtiva.professor_preferido.nome}</p>
                </div>
              )}

              {solicitacaoAtiva.professor_responsavel?.nome && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Atendimento atual</p>
                  <p className="mt-1 text-sm font-medium text-slate-200">{solicitacaoAtiva.professor_responsavel.nome}</p>
                </div>
              )}

              {solicitacaoAtiva.data_aula_experimental && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Data da aula</p>
                  <p className="mt-1 text-sm font-medium text-slate-200">
                    {formatarDataCurta(solicitacaoAtiva.data_aula_experimental)}
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 sm:col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Horários informados</p>
                <p className="mt-1 text-sm font-medium text-slate-200">{solicitacaoAtiva.horarios_preferencia}</p>
              </div>

              {solicitacaoAtiva.ultima_recusa_repasse_observacao && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-300">Último retorno da equipe</p>
                  <p className="mt-1 text-sm text-slate-100">{solicitacaoAtiva.ultima_recusa_repasse_observacao}</p>
                </div>
              )}
            </div>
          </motion.section>
        )}

        {aulasPorDia.length > 0 ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-white">Minhas aulas</h2>
              <p className="mt-1 text-sm text-slate-400">
                Aqui você acompanha os dias da semana em que já está marcado para treinar.
              </p>
            </div>

            <div className="space-y-4">
              {aulasPorDia.map((grupo, index) => (
                <motion.div
                  key={grupo.dia}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-[2rem] border border-slate-800 bg-slate-900/60 p-5 sm:p-6"
                >
                  <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">{grupo.dia}</h3>
                      <p className="text-xs text-slate-500">
                        {grupo.aulas.length} aula{grupo.aulas.length > 1 ? "s" : ""} neste dia
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {grupo.aulas.map((aula) => (
                      <div
                        key={aula.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <span
                                className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${obterClasseStatusMatricula(
                                  aula.status
                                )}`}
                              >
                                {obterLabelStatusMatricula(aula.status)}
                              </span>
                              <span className="inline-flex items-center rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                                {aula.turmas?.nivel || "Turma"}
                              </span>
                            </div>

                            <h4 className="mt-3 flex items-center gap-2 text-lg font-bold text-white">
                              <Clock className="h-4 w-4 text-orange-500" />
                              {aula.turmas?.horario?.substring(0, 5) || "Horário a definir"}
                            </h4>
                            <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
                              <UserCheck className="h-4 w-4 text-orange-500" />
                              Professor {aula.turmas?.professor?.nome || "A definir"}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300 sm:min-w-[180px]">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              {obterRotuloReferenciaMatricula(aula.status)}
                            </p>
                            <p className="mt-1 font-medium text-white">
                              {obterTextoReferenciaMatricula(aula)}
                            </p>
                          </div>
                        </div>

                        {aula.status !== "ativo" && aula.status !== "experimental" && (
                          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                            Sua vaga já está separada, mas ainda existe uma pendência antes de entrar na aula.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        ) : !naoTemNadaParaMostrar ? (
          <section className="rounded-[2rem] border border-slate-800 bg-slate-900/30 p-8 text-center">
            <Clock className="mx-auto mb-4 h-10 w-10 text-slate-600" />
            <h2 className="text-xl font-bold text-white">Suas aulas ainda não apareceram aqui</h2>
            <p className="mt-2 text-sm text-slate-400">
              Assim que a equipe marcar sua aula experimental ou confirmar seus horários fixos, tudo vai aparecer nesta página.
            </p>
          </section>
        ) : (
          <section className="rounded-[2rem] border border-slate-800 bg-slate-900/30 p-8 text-center">
            <CalendarDays className="mx-auto mb-4 h-12 w-12 text-slate-700" />
            <h2 className="text-xl font-bold text-white">Você ainda não tem aulas marcadas</h2>
            <p className="mt-2 text-sm text-slate-400">
              Quando quiser começar ou voltar a treinar, você pode pedir tudo por aqui.
            </p>

            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {mostrarSolicitarMatricula ? (
                <Link
                  href="/solicitar-matricula"
                  className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-orange-600"
                >
                  Solicitar Matrícula
                </Link>
              ) : null}

              {mostrarSolicitarExperimental ? (
                <Link
                  href="/aula-experimental"
                  className="inline-flex items-center justify-center rounded-xl bg-slate-800 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-700"
                >
                  Solicitar Experimental
                </Link>
              ) : null}

              {!mostrarSolicitarMatricula && !mostrarSolicitarExperimental ? (
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-xl bg-slate-800 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-700"
                >
                  Voltar ao início
                </Link>
              ) : null}
            </div>
          </section>
        )}

        {minhasAulas.some((aula) => aula.status === "aguardando_dados") && (
          <section className="rounded-[2rem] border border-orange-500/20 bg-orange-500/10 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-400" />
              <div>
                <p className="font-bold text-white">Falta completar seus dados</p>
                <p className="mt-1 text-sm text-orange-100/80">
                  Sua matrícula já avançou, mas ainda falta finalizar algumas informações para liberar o acesso completo.
                </p>
                <Link
                  href="/perfil"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-white transition-colors hover:text-orange-200"
                >
                  Ir para meu perfil <CheckCircle2 className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
