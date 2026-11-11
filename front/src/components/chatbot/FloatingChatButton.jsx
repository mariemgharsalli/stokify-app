import { IconMessageChatbot, IconX } from "@tabler/icons-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLandingLang } from "../../pages/landing/LandingLangContext";

export default function FloatingChatButton({ onClick, hasUnread, isOpen }) {
  const { t } = useLandingLang();
  const reduce = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={t.stokiOpen}
      className="fixed bottom-6 right-6 z-[90] flex h-14 w-14 items-center justify-center rounded-full shadow-2xl max-[480px]:bottom-4 max-[480px]:right-4"
      style={{
        background: isOpen
          ? "var(--color-background-secondary, var(--bg-input))"
          : "linear-gradient(135deg, #f97316, #fb923c)",
        boxShadow: isOpen ? "none" : "0 8px 32px rgba(249,115,22,0.4)",
      }}
      whileHover={reduce || isOpen ? undefined : { scale: 1.08 }}
      whileTap={reduce ? undefined : { scale: 0.94 }}
      animate={{ scale: isOpen ? 0.95 : 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
    >
      {!isOpen && !reduce && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: "rgba(249,115,22,0.3)" }}
          animate={{ scale: [1, 1.35], opacity: [0.55, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
        />
      )}

      <AnimatePresence mode="wait" initial={false}>
        {isOpen ? (
          <motion.span
            key="close"
            initial={reduce ? false : { opacity: 0, rotate: -40, scale: 0.8 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, rotate: 40, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            style={{ color: "var(--color-text-primary, var(--text-primary))" }}
          >
            <IconX size={22} stroke={2} aria-hidden="true" />
          </motion.span>
        ) : (
          <motion.span
            key="open"
            initial={reduce ? false : { opacity: 0, rotate: 40, scale: 0.8 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, rotate: -40, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            style={{ color: "#fff" }}
          >
            <IconMessageChatbot size={22} stroke={1.75} aria-hidden="true" />
          </motion.span>
        )}
      </AnimatePresence>

      {hasUnread && !isOpen && (
        <motion.span
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
          style={{ background: "#22c55e" }}
          initial={reduce ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 16 }}
        >
          •
        </motion.span>
      )}
    </motion.button>
  );
}
