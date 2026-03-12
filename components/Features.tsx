"use client";
import { MapPin, Trophy, Users } from "lucide-react";
import { motion, Variants } from "framer-motion";

export function Features() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.2 } }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    show: { 
      opacity: 1, 
      y: 0, 
      transition: { 
        type: "spring", // Agora o TS sabe que este "spring" é o valor correto
        stiffness: 50 
      } 
    }
  };

  const featuresList = [
    { title: "Metodologia Própria", desc: "Do saque ao shark attack, aprenda o passo a passo com didática aprovada.", icon: Trophy, color: "text-amber-400" },
    { title: "Turmas Reduzidas", desc: "Máximo de 6 alunos por quadra para garantir a atenção que você merece.", icon: Users, color: "text-sky-400" },
    { title: "Areia Padrão Ouro", desc: "Quadras com areia tratada, fofinha e infraestrutura completa para o pós-treino.", icon: MapPin, color: "text-orange-500" },
  ];

  return (
    <section className="py-32 relative">
      <div className="absolute inset-0 bg-slate-900/30 transform -skew-y-2 z-0" />
      
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-20 space-y-4"
        >
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white">Estrutura de ponta</h2>
          <p className="text-slate-400 text-lg">Tudo o que você precisa para chegar ao próximo nível.</p>
        </motion.div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
          className="grid md:grid-cols-3 gap-8"
        >
          {featuresList.map((feature, idx) => (
            <motion.div 
              key={idx} 
              variants={itemVariants}
              whileHover={{ y: -10, scale: 1.02 }}
              // Mudamos o hover:border-orange para hover:border-slate-600
              className="bg-slate-900/50 backdrop-blur-sm p-8 rounded-[2rem] border border-slate-800 hover:border-slate-600 transition-colors group relative overflow-hidden"
            >
            
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <feature.icon className={`w-12 h-12 mb-8 relative z-10 ${feature.color}`} />
              <h3 className="text-2xl font-bold mb-4 text-white relative z-10">{feature.title}</h3>
              <p className="text-slate-400 leading-relaxed relative z-10">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}