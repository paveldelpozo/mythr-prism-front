import { describe, expect, it, vi } from 'vitest';
import { useWhiteboardEditor } from './useWhiteboardEditor';

describe('composables/useWhiteboardEditor', () => {
  it('mantiene trazo libre y comandos undo/clear sin regresion', () => {
    const onChange = vi.fn();
    const editor = useWhiteboardEditor({ onChange });

    editor.activeTool.value = 'draw';
    editor.beginStroke({ x: 0.1, y: 0.2 });
    editor.appendPoint({ x: 0.3, y: 0.4 });
    editor.appendPoint({ x: 0.6, y: 0.8 });
    editor.commitStroke();

    expect(editor.whiteboardState.value.strokes).toHaveLength(1);
    expect(editor.whiteboardState.value.strokes[0]?.tool).toBe('draw');
    expect(editor.whiteboardState.value.strokes[0]?.points.length).toBeGreaterThan(2);

    editor.undo();
    expect(editor.whiteboardState.value.strokes).toHaveLength(0);

    editor.beginStroke({ x: 0.2, y: 0.2 });
    editor.appendPoint({ x: 0.5, y: 0.5 });
    editor.commitStroke();
    editor.clear();

    expect(editor.whiteboardState.value.strokes).toHaveLength(0);
    expect(onChange).toHaveBeenCalled();
  });

  it.each(['arrow', 'circle', 'rect', 'line'] as const)(
    'crea forma basica %s con interaccion click+drag',
    (tool) => {
      const editor = useWhiteboardEditor();
      editor.activeTool.value = tool;
      editor.selectedColor.value = '#22c55e';
      editor.selectedWidth.value = 10;

      editor.beginStroke({ x: 0.2, y: 0.2 });
      editor.appendPoint({ x: 0.7, y: 0.8 });
      editor.commitStroke();

      expect(editor.whiteboardState.value.strokes).toHaveLength(1);
      const stroke = editor.whiteboardState.value.strokes[0];
      expect(stroke?.tool).toBe(tool);
      expect(stroke?.color).toBe('#22c55e');
      expect(stroke?.width).toBe(10);
      expect(stroke?.points).toEqual([
        { x: 0.2, y: 0.2 },
        { x: 0.7, y: 0.8 }
      ]);
    }
  );
});
