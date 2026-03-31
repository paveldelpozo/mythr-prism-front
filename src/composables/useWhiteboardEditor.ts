import { ref } from 'vue';
import {
  createEmptyWhiteboardState,
  sanitizeWhiteboardState,
  type WhiteboardPoint,
  type WhiteboardState,
  type WhiteboardStroke,
  type WhiteboardTool
} from '../types/whiteboard';

interface UseWhiteboardEditorOptions {
  onChange?: (nextState: WhiteboardState) => void;
}

const cloneState = (state: WhiteboardState): WhiteboardState => sanitizeWhiteboardState(state);

export const useWhiteboardEditor = (options: UseWhiteboardEditorOptions = {}) => {
  const activeTool = ref<WhiteboardTool>('draw');
  const selectedColor = ref('#ef4444');
  const selectedWidth = ref(6);
  const whiteboardState = ref<WhiteboardState>(createEmptyWhiteboardState());
  const activeStroke = ref<WhiteboardStroke | null>(null);

  const emitChange = () => {
    options.onChange?.(cloneState(whiteboardState.value));
  };

  const setState = (nextState: WhiteboardState) => {
    whiteboardState.value = cloneState(nextState);
    activeStroke.value = null;
  };

  const beginStroke = (point: WhiteboardPoint) => {
    activeStroke.value = {
      tool: activeTool.value,
      color: selectedColor.value,
      width: Math.max(1, Math.round(selectedWidth.value)),
      points: [point, point]
    };
  };

  const appendPoint = (point: WhiteboardPoint) => {
    const stroke = activeStroke.value;
    if (!stroke) {
      return;
    }

    if (stroke.tool === 'draw' || stroke.tool === 'erase') {
      stroke.points.push(point);
      return;
    }

    stroke.points[1] = point;
  };

  const commitStroke = () => {
    const stroke = activeStroke.value;
    if (!stroke || stroke.points.length < 2) {
      activeStroke.value = null;
      return;
    }

    const sanitizedStroke = sanitizeWhiteboardState({
      strokes: [stroke]
    }).strokes[0];

    if (!sanitizedStroke) {
      activeStroke.value = null;
      return;
    }

    whiteboardState.value = {
      strokes: [...whiteboardState.value.strokes, sanitizedStroke]
    };
    activeStroke.value = null;
    emitChange();
  };

  const clear = () => {
    if (whiteboardState.value.strokes.length === 0) {
      return;
    }

    whiteboardState.value = createEmptyWhiteboardState();
    activeStroke.value = null;
    emitChange();
  };

  const undo = () => {
    if (whiteboardState.value.strokes.length === 0) {
      return;
    }

    whiteboardState.value = {
      strokes: whiteboardState.value.strokes.slice(0, -1)
    };
    activeStroke.value = null;
    emitChange();
  };

  return {
    activeStroke,
    activeTool,
    selectedColor,
    selectedWidth,
    whiteboardState,
    appendPoint,
    beginStroke,
    clear,
    commitStroke,
    setState,
    undo
  };
};
