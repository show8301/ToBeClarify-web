import { motion, useReducedMotion } from 'framer-motion';
import loadingLogo from '../assets/LogoJellyfish.png';

export function AppLoader({ isDataLoading = true, isIntroLoading = true, onRevealComplete }) {
  const shouldReduceMotion = useReducedMotion();
  const isReady = !isDataLoading && !isIntroLoading;
  const revealProgress = shouldReduceMotion ? 1 : isReady ? 1 : isDataLoading ? 0.45 : 0.68;
  const revealInset = `${100 - revealProgress * 100}%`;
  const revealTransition = {
    duration: shouldReduceMotion ? 0 : isReady ? 0.36 : isDataLoading ? 2.2 : 1.45,
    ease: [0.22, 1, 0.36, 1],
  };

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
        <div className="loaderLogo">
          <img className="loaderLogoBase" src={loadingLogo} alt="" />
          <motion.div
            className="loaderLogoFill"
            initial={shouldReduceMotion ? false : { clipPath: 'inset(100% 0 0 0)' }}
            animate={{ clipPath: `inset(${revealInset} 0 0 0)` }}
            transition={revealTransition}
            onAnimationComplete={() => {
              if (isReady) onRevealComplete?.();
            }}
          >
            <img src={loadingLogo} alt="" />
          </motion.div>
          <motion.div
            className="loaderWaterline"
            initial={shouldReduceMotion ? false : { top: '100%', opacity: 0 }}
            animate={{
              top: revealInset,
              opacity: isReady || shouldReduceMotion ? 0 : 0.86,
            }}
            transition={revealTransition}
            aria-hidden="true"
          />
        </div>
      </motion.div>
      <motion.div
        className="loaderCopy"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
        animate={shouldReduceMotion ? false : { opacity: 1, y: 0 }}
        transition={{ duration: 0.58, delay: 0.18, ease: 'easeOut' }}
      >
        <p className="eyebrow"></p>
        <h1>Lucid Dream</h1>
        <small>正在編織一個新的夢</small>
      </motion.div>
      <motion.div
        className="loaderLine"
        initial={shouldReduceMotion ? false : { scaleX: 0 }}
        animate={{ scaleX: revealProgress }}
        transition={{ ...revealTransition, delay: shouldReduceMotion ? 0 : 0.28 }}
      />
    </motion.div>
  );
}
