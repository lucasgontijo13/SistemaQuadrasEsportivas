import { Matricula } from "@/types";

export const statusMatriculasComPrazo = [
  "aguardando_aceite_professor",
  "aguardando_dados",
  "aguardando_pagamento",
] as const;

export type StatusMatriculaComPrazo = (typeof statusMatriculasComPrazo)[number];

const prazoHorasPorStatus: Record<StatusMatriculaComPrazo, number> = {
  aguardando_aceite_professor: 24,
  aguardando_dados: 72,
  aguardando_pagamento: 120,
};

export const matriculaTemPrazoExpiracao = (
  status?: Matricula["status"] | null
): status is StatusMatriculaComPrazo =>
  statusMatriculasComPrazo.includes(status as StatusMatriculaComPrazo);

export const obterPrazoHorasMatricula = (status: StatusMatriculaComPrazo) =>
  prazoHorasPorStatus[status];

export const obterPrazoLabelMatricula = (status: StatusMatriculaComPrazo) => {
  const prazoHoras = obterPrazoHorasMatricula(status);
  if (prazoHoras === 24) return "24h";
  if (prazoHoras % 24 === 0) {
    const dias = prazoHoras / 24;
    return `${dias} dia${dias > 1 ? "s" : ""}`;
  }

  return `${prazoHoras}h`;
};

export const obterDataReferenciaStatusMatricula = (matricula: {
  status_em?: string | null;
  created_at?: string | null;
}) => matricula.status_em || matricula.created_at || null;

const normalizarData = (valor?: string | null) => {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
};

export const calcularHorasEmAbertoMatricula = (
  dataReferencia?: string | null,
  agora = new Date()
) => {
  const dataBase = normalizarData(dataReferencia);
  if (!dataBase) return null;

  return Math.max(0, Math.floor((agora.getTime() - dataBase.getTime()) / (1000 * 60 * 60)));
};

export const obterResumoPrazoMatricula = (
  status: StatusMatriculaComPrazo,
  dataReferencia?: string | null,
  agora = new Date()
) => {
  const horasEmAberto = calcularHorasEmAbertoMatricula(dataReferencia, agora);
  if (horasEmAberto === null) return null;

  const prazoHoras = obterPrazoHorasMatricula(status);

  return {
    prazoHoras,
    horasEmAberto,
    vencida: horasEmAberto >= prazoHoras,
  };
};

export const formatarTempoAbertoPendencia = (horas: number) => {
  if (horas >= 24) {
    const dias = Math.floor(horas / 24);
    return `${dias} dia${dias > 1 ? "s" : ""}`;
  }

  return `${Math.max(1, horas)}h`;
};

export const obterLabelStatusPendencia = (status: StatusMatriculaComPrazo) => {
  if (status === "aguardando_aceite_professor") return "Aguardando aceite";
  if (status === "aguardando_dados") return "Aguardando dados";
  return "Aguardando pagamento";
};
