"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar, Sun, Users, CalendarDays } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function Hero() {
  const [logado, setLogado] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function verificar() {
      const { data: { session } } = await supabase.auth.getSession();
      setLogado(!!session);
      setCarregando(false);
    }
    verificar();
  }, []);
  
  return (
    <section className="pt-40 pb-20 px-6 max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center min-h-[90vh]">
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="space-y-8 relative z-10"
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 text-orange-400 text-sm font-semibold border border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.15)]"
        >
          <Sun className="w-4 h-4" />
          <span>Aulas com energia total</span>
        </motion.div>
        
        <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] text-white">
          Domine a areia. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-400 to-red-500 bg-300% animate-gradient">
            Evolua seu jogo.
          </span>
        </h1>
        
        <p className="text-lg text-slate-400 max-w-md leading-relaxed">
          Aprenda os fundamentos, melhore seu condicionamento físico e faça parte da melhor comunidade de futevôlei da região.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          {carregando ? (
            <div className="w-full sm:w-auto h-14 bg-slate-800 rounded-full animate-pulse"></div>
          ) : logado ? (
            <Link href="/agenda" className="w-full sm:w-auto">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-bold py-4 px-8 rounded-full shadow-[0_0_30px_rgba(249,115,22,0.3)] transition-shadow hover:shadow-[0_0_40px_rgba(249,115,22,0.5)]"
              >
                <CalendarDays className="w-5 h-5" />
                Minha Agenda
              </motion.button>
            </Link>
          ) : (
            <Link href="/aula-experimental" className="w-full sm:w-auto">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-bold py-4 px-8 rounded-full shadow-[0_0_30px_rgba(249,115,22,0.3)] transition-shadow hover:shadow-[0_0_40px_rgba(249,115,22,0.5)]"
              >
                <Users className="w-5 h-5" />
                Agendar Aula Experimental
              </motion.button>
            </Link>
          )}
          
          <Link href="/agendar-quadra" className="w-full sm:w-auto">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 border border-slate-700 text-white font-bold py-4 px-8 rounded-full transition-colors hover:bg-slate-800"
            >
              <Calendar className="w-5 h-5 text-orange-500" />
              Alugar Quadra
            </motion.button>
          </Link>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.3 }}
        className="relative"
      >
        <div className="absolute inset-0 bg-orange-500/20 blur-[100px] rounded-full -z-10" />
        
        <motion.div 
          animate={{ y: [0, -15, 0] }} 
          transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          className="relative h-[550px] w-full rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl"
        >
          <Image 
            src="https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?q=80&w=1000&auto=format&fit=crop" 
            alt="Atleta jogando futevôlei" 
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1, type: "spring" }}
          className="absolute -bottom-8 -left-8 bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl flex items-center gap-5 hidden md:flex"
        >
          <div className="bg-gradient-to-br from-sky-400 to-blue-600 p-4 rounded-full text-white shadow-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-white font-bold text-2xl">+200</p>
            <p className="text-slate-400 text-sm font-medium">Alunos na areia</p>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}