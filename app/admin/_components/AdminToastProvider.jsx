import { Toast } from '@base-ui/react/toast';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

export function AdminToastProvider({ children }) {
  return (
    <Toast.Provider timeout={4000} limit={3}>
      {children}
      <Toast.Viewport className="adminToastViewport">
        <AdminToastList />
      </Toast.Viewport>
    </Toast.Provider>
  );
}

export function useAdminToast() {
  return Toast.useToastManager();
}

function AdminToastList() {
  const toastManager = Toast.useToastManager();
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {toastManager.toasts.map((toast) => (
        <Toast.Root
          key={toast.id}
          toast={toast}
          render={(
            <motion.div
              className={`adminToast adminToast-${toast.type || 'success'}`}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
              transition={reduceMotion ? { duration: 0.12 } : { type: 'spring', stiffness: 340, damping: 28 }}
              drag={reduceMotion ? false : 'x'}
              dragElastic={0.1}
              dragConstraints={{ left: 0 }}
              onUpdate={(latest) => {
                if (Number(latest.x) > 100) toastManager.close(toast.id);
              }}
            >
              <span className="adminToastIcon" aria-hidden="true">{toast.type === 'error' ? '!' : '✓'}</span>
              <span className="adminToastCopy">
                <Toast.Title className="adminToastTitle" />
                <Toast.Description className="adminToastDescription" />
              </span>
              <Toast.Close className="adminToastClose" aria-label="關閉提示">×</Toast.Close>
            </motion.div>
          )}
        />
      ))}
    </AnimatePresence>
  );
}
