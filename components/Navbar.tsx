"use client";
import Link from "next/link";
import { motion } from "framer-motion";

export function Navbar() {
  return (
    <motion.header 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="border-b border-slate-800 bg-slate-950/70 backdrop-blur-lg fixed top-0 w-full z-50"
    >
      <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="font-bold text-2xl tracking-tighter text-white">
          Arena<span className="text-orange-500">.Pro</span>
        </div>
        <Link href="/admin" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
          Área do Professor
        </Link>
      </div>
    </motion.header>
  );
}