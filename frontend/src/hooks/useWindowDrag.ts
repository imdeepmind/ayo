import { useCallback, useEffect, useState } from 'react';

export function useWindowDrag() {
  const [dragging, setDragging] = useState(false);

  const stopDragging = useCallback(() => setDragging(false), []);

  useEffect(() => {
    window.addEventListener('mouseup', stopDragging);
    window.addEventListener('blur', stopDragging);
    return () => {
      window.removeEventListener('mouseup', stopDragging);
      window.removeEventListener('blur', stopDragging);
    };
  }, [stopDragging]);

  const dragHandlers = {
    onMouseDown: useCallback(() => setDragging(true), []),
    onMouseUp: stopDragging,
    onMouseLeave: stopDragging,
  };

  return {
    dragging,
    cursorClass: dragging ? 'cursor-grabbing' : '',
    dragHandlers,
  };
}
