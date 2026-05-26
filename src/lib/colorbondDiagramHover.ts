import { useEffect, useState } from "react";
import type { ColorBondDiagramReference } from "./colorbondDiagramMapping";

const COLORBOND_DIAGRAM_HOVER_EVENT = "qsbom:colorbond-diagram-hover";

export function setColorBondDiagramHover(ref: ColorBondDiagramReference | null) {
  window.dispatchEvent(
    new CustomEvent<ColorBondDiagramReference | null>(COLORBOND_DIAGRAM_HOVER_EVENT, {
      detail: ref,
    }),
  );
}

export function useColorBondDiagramHover() {
  const [hoveredRef, setHoveredRef] = useState<ColorBondDiagramReference | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      setHoveredRef((event as CustomEvent<ColorBondDiagramReference | null>).detail ?? null);
    };
    window.addEventListener(COLORBOND_DIAGRAM_HOVER_EVENT, handler);
    return () => window.removeEventListener(COLORBOND_DIAGRAM_HOVER_EVENT, handler);
  }, []);

  return hoveredRef;
}
