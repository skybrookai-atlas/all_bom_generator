import React, { useRef, useState, useEffect } from "react";
import { PenTool, Type, Trash2, Check } from "lucide-react";

interface SignaturePadProps {
  onSave: (signatureData: string, acceptedName: string) => void;
  defaultName?: string;
}

const SIGNATURE_FONTS = [
  { name: "Cursive", fontClass: "font-signature-cursive", style: { fontFamily: "'Dancing Script', cursive" } },
  { name: "Elegant", fontClass: "font-signature-elegant", style: { fontFamily: "'Great Vibes', cursive" } },
  { name: "Modern", fontClass: "font-signature-modern", style: { fontFamily: "'Sacramento', cursive" } },
  { name: "Casual", fontClass: "font-signature-casual", style: { fontFamily: "'Caveat', cursive" } },
];

export function SignaturePad({ onSave, defaultName = "" }: SignaturePadProps) {
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typedName, setTypedName] = useState(defaultName);
  const [selectedFont, setSelectedFont] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Load Google Fonts for signatures
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500&family=Great+Vibes&family=Sacramento&family=Caveat:wght@500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Canvas drawing logic
  useEffect(() => {
    if (mode !== "draw" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI screens
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    ctx.strokeStyle = "#38bdf8"; // Tailwind sky-400
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [mode]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleConfirm = () => {
    if (mode === "draw") {
      if (!canvasRef.current || !hasDrawn) return;
      // Get signature as data URL
      const dataUrl = canvasRef.current.toDataURL("image/png");
      onSave(dataUrl, typedName || "Client Signature");
    } else {
      if (!typedName.trim()) return;
      // Create a canvas to render the text signature as an image
      const canvas = document.createElement("canvas");
      canvas.width = 600;
      canvas.height = 200;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#000000";
        // Map selected font index to exact font name
        const fontName = SIGNATURE_FONTS[selectedFont].name;
        let fontValue = "48px 'Dancing Script'";
        if (fontName === "Elegant") fontValue = "56px 'Great Vibes'";
        if (fontName === "Modern") fontValue = "64px 'Sacramento'";
        if (fontName === "Casual") fontValue = "52px 'Caveat'";

        ctx.font = fontValue;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(typedName, canvas.width / 2, canvas.height / 2);
        const dataUrl = canvas.toDataURL("image/png");
        onSave(dataUrl, typedName);
      }
    }
  };

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* Tab Switcher */}
      <div className="flex space-x-2 border-b border-brand-border/40 pb-2">
        <button
          type="button"
          onClick={() => setMode("draw")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === "draw"
              ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20"
              : "text-brand-text/60 hover:text-brand-text hover:bg-brand-border/20"
          }`}
        >
          <PenTool size={16} />
          <span>Draw Signature</span>
        </button>
        <button
          type="button"
          onClick={() => setMode("type")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === "type"
              ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20"
              : "text-brand-text/60 hover:text-brand-text hover:bg-brand-border/20"
          }`}
        >
          <Type size={16} />
          <span>Type Signature</span>
        </button>
      </div>

      {/* Inputs / Fields */}
      <div className="flex flex-col space-y-2">
        <label className="text-xs font-semibold text-brand-muted uppercase tracking-wider">
          Signatory Full Name
        </label>
        <input
          type="text"
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          placeholder="Enter your full name"
          className="w-full px-4 py-3 rounded-xl border border-brand-border/40 bg-brand-bg/50 text-brand-text placeholder-brand-text/30 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all font-semibold"
        />
      </div>

      {/* Signature Area */}
      {mode === "draw" ? (
        <div className="relative group">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-48 border border-dashed border-brand-border/40 rounded-xl bg-brand-bg/30 touch-none cursor-crosshair transition-all focus:border-brand-primary"
          />
          <div className="absolute top-3 right-3 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={clearCanvas}
              disabled={!hasDrawn}
              className="p-2 rounded-lg bg-brand-bg/80 border border-brand-border/40 text-brand-muted hover:text-rose-500 hover:border-rose-500/40 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-md"
              title="Clear signature"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none text-xs text-brand-muted/40 font-semibold uppercase tracking-wider">
            Draw your signature here
          </div>
        </div>
      ) : (
        <div className="flex flex-col space-y-4">
          {/* Cursive Font Selection */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SIGNATURE_FONTS.map((font, idx) => (
              <button
                key={font.name}
                type="button"
                onClick={() => setSelectedFont(idx)}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  selectedFont === idx
                    ? "border-brand-primary bg-brand-primary/5 text-brand-text"
                    : "border-brand-border/40 bg-brand-bg/20 text-brand-text/60 hover:border-brand-border hover:bg-brand-bg/40"
                }`}
              >
                <span className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1">
                  {font.name}
                </span>
                <span className="text-xl truncate max-w-full px-1 py-1" style={font.style}>
                  {typedName.trim() || "Signature"}
                </span>
              </button>
            ))}
          </div>

          {/* Cursive Preview */}
          <div className="w-full h-32 border border-brand-border/40 rounded-xl bg-brand-bg/30 flex items-center justify-center relative overflow-hidden">
            <span
              className="text-4xl text-brand-primary select-none px-4 py-2"
              style={SIGNATURE_FONTS[selectedFont].style}
            >
              {typedName.trim() || "Type your name above"}
            </span>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-brand-muted/40 font-semibold uppercase tracking-wider">
              Signature Preview
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-2 pt-2 border-t border-brand-border/40">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!typedName.trim() || (mode === "draw" && !hasDrawn)}
          className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-brand-primary text-white font-semibold shadow-lg shadow-brand-primary/25 hover:bg-brand-primary-hover hover:shadow-brand-primary/30 disabled:opacity-40 disabled:pointer-events-none transition-all"
        >
          <Check size={18} />
          <span>Confirm & Sign Quote</span>
        </button>
      </div>
    </div>
  );
}
