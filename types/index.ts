export interface Perfil {
  id: string;
  nome: string;
  email: string;
  whatsapp: string;
  tipo: 'aluno' | 'professor' | 'admin';
  nivel?: string;
  cpf?: string;
  data_nascimento?: string;
  contato_emergencia?: string;
}

export interface Matricula {
  id: number;
  perfil_id: string;
  turma_id: number;
  status: 'experimental' | 'ativo' | 'inativo' | 'aguardando_dados' | 'aguardando_pagamento'; // Adicionado 'aguardando_pagamento'
  perfis?: Perfil; 
  turmas?: Turma; 
}

export interface Turma {
  id: number;
  dia_semana: string;
  horario: string;
  nivel: string;
  professor: string;
  vagas_totais: number;
  matriculas?: Matricula[];
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

export interface Perfil {
  id: string;
  nome: string;
  email: string;
  whatsapp: string;
  tipo: 'aluno' | 'professor' | 'admin';
  nivel?: string;
  cpf?: string;
  data_nascimento?: string;
  contato_emergencia?: string;
  cep?: string;
  rua?: string;
  numero?: string;
}

export interface DadosCompletarPerfil {
  senha?: string;
  cpf: string;
  data_nascimento: string;
  cep: string;
  rua: string;
  numero: string;
  contato_emergencia: string;
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