import { useState, useCallback, useRef } from 'react';

export function useUndoRedo(maxHistory = 20) {
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const isApplying = useRef(false);

  const pushAction = useCallback((action) => {
    // action = { undo: async () => {...}, redo: async () => {...}, description: string }
    if (isApplying.current) return;
    setUndoStack(prev => [...prev.slice(-(maxHistory - 1)), action]);
    setRedoStack([]);
  }, [maxHistory]);

  const undo = useCallback(async () => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const action = prev[prev.length - 1];
      isApplying.current = true;
      action.undo().finally(() => { isApplying.current = false; });
      setRedoStack(r => [...r, action]);
      return prev.slice(0, -1);
    });
  }, []);

  const redo = useCallback(async () => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const action = prev[prev.length - 1];
      isApplying.current = true;
      action.redo().finally(() => { isApplying.current = false; });
      setUndoStack(u => [...u, action]);
      return prev.slice(0, -1);
    });
  }, []);

  return {
    pushAction,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}
