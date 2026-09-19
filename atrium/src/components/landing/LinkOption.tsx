'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { CreateForm } from './CreateForm';

/**
 * Le départ depuis un lien d'annonce, replié par défaut.
 *
 * Il reste disponible, mais il ne peut pas aboutir si le site refuse la
 * lecture de la page. L'import de photos, lui, aboutit toujours : c'est donc
 * lui qui occupe le premier écran, et le lien qui attend qu'on le demande.
 */
export function LinkOption() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex w-full flex-col items-center">
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.div
            key="form"
            className="flex w-full justify-center"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="w-full pt-2">
              <CreateForm />
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="toggle"
            type="button"
            onClick={() => setOpen(true)}
            className="text-caption text-muted underline decoration-line-strong underline-offset-4
                       transition-colors duration-quick hover:text-ink hover:decoration-ink/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            ou partir d’un lien d’annonce
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
