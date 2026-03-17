export interface Perfil {
  id: string;
  nome: string;
  email: string;
  whatsapp: string;
  tipo: 'aluno' | 'professor' | 'admin';
  nivel?: string;
  permitir_nova_experimental?: boolean;
  cpf?: string;
  data_nascimento?: string;
  contato_emergencia?: string;
  cep?: string;
  rua?: string;
  numero?: string;
  sexo?: string;
  necessidade_especial?: string;
  objetivo?: string;
}

export interface DadosCompletarPerfil {
  cpf: string;
  data_nascimento: string;
  cep: string;
  rua: string;
  numero: string;
  contato_emergencia: string;
  senha?: string;
}

export interface ProfessorResumo {
  id: string;
  nome: string;
}

export interface Matricula {
  id: number;
  perfil_id: string;
  turma_id: number;
  status: 'experimental' | 'ativo' | 'inativo' | 'aguardando_dados' | 'aguardando_pagamento' | 'pendente' | 'aguardando_aceite_professor';
  data_inicio?: string | null;
  status_pos_aceite?: 'ativo' | 'aguardando_dados' | 'aguardando_pagamento' | null;
  professor_indicacao_id?: string | null;
  ultima_recusa_professor_id?: string | null;
  ultima_recusa_observacao?: string | null;
  ultima_recusa_em?: string | null;
  perfis?: Perfil; 
  turmas?: Turma; 
}

export interface Turma {
  id: number;
  dia_semana: string;
  horario: string;
  nivel: string;
  professor_id: string | null;
  professor?: ProfessorResumo | null;
  vagas_totais: number;
  ativa?: boolean;
  matriculas?: Matricula[];
}

export interface DadosTurma {
  dia_semana: string;
  horario: string;
  nivel: string;
  professor_id: string;
  vagas_totais: number;
}

export interface DadosAgendamento {
  nome: string;
  email: string;
  whatsapp: string;
  senha?: string;
  confirmarSenha?: string;
}

export interface HorarioQuadra {
  id: number;
  dia_semana: string;
  horario_inicio: string;
  horario_fim: string;
  preco: string;
}

export interface ReservaQuadra {
  horario_inicio: string;
}

export interface DiaSeletor {
  id: number;
  dataReal: string;
  nomeDiaBanco: string;
  nomeDiaVisual: string;
  dataVisual: string;
}

export interface DadosLogin {
  identificador: string; // Pode ser e-mail ou WhatsApp
  senha: string;
}

export interface DadosNovoProfessor {
  nome: string;
  email: string;
  whatsapp: string;
  senha: string;
}

export interface SolicitacaoAula {
  id: string;
  created_at: string;
  tipo_solicitacao?: "experimental" | "matricula";
  nome_aluno: string;
  perfil_id?: string | null;
  telefone_aluno: string;
  data_nascimento?: string | null;
  horarios_preferencia: string;
  professor_preferido_id: string | null;
  professor_responsavel_id: string | null;
  professor_origem_transferencia_id?: string | null;
  turma_sugerida_id?: number | null;
  ultima_recusa_repasse_por_id?: string | null;
  ultima_recusa_repasse_observacao?: string | null;
  ultima_recusa_repasse_em?: string | null;
  data_aula_experimental?: string | null;
  professor_preferido?: ProfessorResumo | null;
  professor_responsavel?: ProfessorResumo | null;
  professor_origem_transferencia?: ProfessorResumo | null;
  ultima_recusa_repasse_por?: ProfessorResumo | null;
  status:
    | 'pendente'
    | 'aguardando_aceite_professor'
    | 'agendado'
    | 'aprovada_para_matricula'
    | 'faltou'
    | 'cancelado'
    | 'nao_vai_continuar'
    | 'matricula_em_andamento';
  nivel_experiencia?: string;
  ultimo_contato_whatsapp_em?: string | null;
  resultado_experimental_em?: string | null;
}
