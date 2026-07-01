import { motion, useReducedMotion } from 'framer-motion';

export function AppLoader() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className="appLoader"
      initial={{ opacity: 1 }}
      exit={{
        opacity: 0,
        transition: { duration: shouldReduceMotion ? 0.12 : 0.42, ease: 'easeInOut' },
      }}
      aria-label="頁面載入中"
      role="status"
    >
      <motion.div
        className="loaderSigil"
        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.92, y: 12 }}
        animate={shouldReduceMotion ? false : { opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
      >
        <span>TC</span>
      </motion.div>
      <motion.div
        className="loaderCopy"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
        animate={shouldReduceMotion ? false : { opacity: 1, y: 0 }}
        transition={{ duration: 0.58, delay: 0.18, ease: 'easeOut' }}
      >
        <p className="eyebrow">Now Opening</p>
        <h1>To Be Clarify</h1>
        <small>午夜沙龍準備中</small>
      </motion.div>
      <motion.div
        className="loaderLine"
        initial={shouldReduceMotion ? false : { scaleX: 0 }}
        animate={shouldReduceMotion ? false : { scaleX: 1 }}
        transition={{ duration: 1.05, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
      />
    </motion.div>
  );
}
