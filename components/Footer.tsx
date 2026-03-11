"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Instagram } from "lucide-react";

export function Footer() {
  return (
    <footer className="py-32 px-6 text-center max-w-3xl mx-auto space-y-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-5xl font-bold mb-6 text-white">Pronto para a areia?</h2>
        <p className="text-slate-400 text-xl mb-10">
          Escolha seu nível e venha suar a camisa com a gente.
        </p>
        
        <div className="flex justify-center gap-4">
          <Link href="/agendar">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-3 bg-white text-slate-950 font-bold py-5 px-10 rounded-full transition-all hover:bg-slate-200"
            >
              Ver Grade de Horários
              {/* Removemos o text-orange-500 daqui */}
              <ArrowRight className="w-6 h-6" />
            </motion.button>
          </Link>
        </div>
      </motion.div>
      
      <div className="pt-20 mt-20 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between text-slate-500 text-sm">
        <p>© 2026 Arena Pro. Todos os direitos reservados.</p>
        <div className="flex gap-4 mt-4 md:mt-0">
          <motion.a whileHover={{ y: -3, color: "#f97316" }} href="#" className="transition-colors">
            <Instagram className="w-6 h-6" />
          </motion.a>
        </div>
      </div>
    </footer>
  );
}