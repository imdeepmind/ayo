import { useEffect, useRef, useState, type ReactNode } from 'react';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

const ANIM_MS = 200;

// Modal is an animated overlay shell shared by all dialogs. It stays mounted
// through the exit animation so closing feels as smooth as opening.
export default function Modal({ isOpen, onClose, children, className = '' }: ModalProps) {
  const [rendered, setRendered] = useState(isOpen);
  const [visible, setVisible] = useState(isOpen);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRendered(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }

    setVisible(false);
    timerRef.current = window.setTimeout(() => setRendered(false), ANIM_MS);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [isOpen]);

  if (!rendered) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
      onMouseDown={onClose}
    >
      <div
        className={`w-full rounded-2xl bg-surface-elevated p-6 border border-border dark:border-border-strong transition-all duration-200 ${className} ${
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
