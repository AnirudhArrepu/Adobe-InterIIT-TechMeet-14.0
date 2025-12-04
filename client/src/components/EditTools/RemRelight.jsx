import React, { useState, useEffect, useRef } from "react";
import {
  Eraser,
  Sun,
  ChevronDown,
  ChevronRight,
  GripHorizontal,
  Loader2,
  AlertCircle,
  Lightbulb,
  Check,
  LogOut,
} from "lucide-react";
import { useImage } from "../../context/ImageContext";

// ====== REAL BACKEND SERVERS ======
const API_MASK = "http://localhost:7000"; // SAM2 segmentation
const API_INPAINT = "http://localhost:8002"; // LaMa inpainting
const API_RELIGHT = "http://localhost:8000"; // Marigold relighting

const RemRelightComponent = () => {
  const {
    image,
    activeTool,
    setActiveTool, // Added to close tool
    studioState,
    setStudioState,
    commitImage, // Added for History
  } = useImage();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // ========= Draggable State =========
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const toggleSection = (section) => {
    setStudioState((prev) => ({ ...prev, activeTab: section }));
  };

  // --- 1. INPAINT HANDLER ---
  const handleInpaint = async () => {
    if (!studioState.inpaintCoords) {
      setError("Please click on an object in the image first.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Convert image to blob if it's a string URL
      let imageBlob = image;
      if (typeof image === "string") {
        const response = await fetch(image);
        imageBlob = await response.blob();
      } else if (!(image instanceof Blob)) {
        throw new Error("Invalid image format");
      }

      // A. Get Mask from SAM2
      const form = new FormData();
      form.append("input_image", imageBlob, "image.png");
      form.append("x", studioState.inpaintCoords.x.toString());
      form.append("y", studioState.inpaintCoords.y.toString());

      const res = await fetch(`${API_MASK}/segment`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        throw new Error(`Segmentation failed: ${res.status}`);
      }

      const data = await res.json();

      if (data.error) {
        throw new Error("Mask generation failed.");
      }

      const maskBytes = new Uint8Array(data.mask_png);
      const maskBlob = new Blob([maskBytes], { type: "image/png" });

      // B. Inpaint with LaMa
      const formInpaint = new FormData();
      formInpaint.append("image", imageBlob, "image.png");
      formInpaint.append("mask", maskBlob, "mask.png");

      const res2 = await fetch(`${API_INPAINT}/inpaint`, {
        method: "POST",
        body: formInpaint,
      });

      if (!res2.ok) {
        throw new Error(`Inpainting failed: ${res2.status}`);
      }

      const inpaintBlob = await res2.blob();

      // C. Commit to History
      const file = new File([inpaintBlob], "inpainted.png", {
        type: "image/png",
      });
      commitImage(file);

      // D. Auto-switch to Relight & clear coords
      setStudioState((prev) => ({
        ...prev,
        activeTab: "relight",
        inpaintCoords: null,
      }));
    } catch (err) {
      console.error("Inpaint error:", err);
      setError(err.message || "Inpainting Failed");
    } finally {
      setIsLoading(false);
    }
  };
  // --- 2. RELIGHT HANDLER ---
  const handleRelight = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("input_image", image);
      form.append("az", studioState.relightParams.az);
      form.append("el", studioState.relightParams.el);
      form.append("intensity", studioState.relightParams.intensity);
      form.append("ambient", studioState.relightParams.ambient);
      form.append("spot_mode", "directional");
      form.append("spot_cone", studioState.relightParams.cone);
      form.append("spot_exponent", studioState.relightParams.exponent);

      const res = await fetch(`${API_RELIGHT}/infer`, {
        method: "POST",
        body: form,
      });

      const json = await res.json();
      const imgBlob = base64ToBlob(json.relit_image_base64, "image/png");

      // Commit to History
      const file = new File([imgBlob], "relit.png", { type: "image/png" });
      commitImage(file);
    } catch (err) {
      console.error(err);
      setError("Relighting Failed");
    } finally {
      setIsLoading(false);
    }
  };

  // --- EXIT HANDLERS ---
  const handleDone = () => {
    // Just close the tool, changes are already committed via buttons
    setActiveTool(null);
  };

  const handleExit = () => {
    // Reset state and close
    setStudioState({
      activeTab: "inpaint",
      inpaintedImage: null,
      inpaintCoords: null,
      isInpainting: false,
      relightParams: {
        az: 45,
        el: 30,
        intensity: 1.0,
        ambient: 0.2,
        cone: 8,
        exponent: 80,
      },
      isRelighting: false,
    });
    setActiveTool(null);
  };

  // --- HELPERS ---
  const base64ToBlob = (base64, type) => {
    const bin = atob(base64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type });
  };

  const updateRelightParam = (key, value) => {
    setStudioState((prev) => ({
      ...prev,
      relightParams: {
        ...prev.relightParams,
        [key]: parseFloat(value),
      },
    }));
  };

  // --- DRAG LOGIC ---
  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // --- RENDER ---
  if (activeTool !== "studio") return null;

  return (
    <div
      className="absolute left-6 z-50 flex flex-col gap-2"
      style={{
        top: "50%",
        transform: `translate(${position.x}px, calc(-50% + ${position.y}px))`,
        cursor: isDragging ? "grabbing" : "default",
      }}
    >
      <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-800 p-1.5 rounded-xl shadow-2xl w-64 transition-all duration-300 flex flex-col">
        {/* Header */}
        <div
          onMouseDown={handleMouseDown}
          className="px-3 py-2.5 flex items-center justify-between cursor-grab active:cursor-grabbing group rounded-lg hover:bg-zinc-900 transition-colors mb-1 shrink-0"
        >
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 select-none group-hover:text-zinc-300 transition-colors flex items-center gap-2">
            Studio
          </span>
          <GripHorizontal
            size={14}
            className="text-zinc-600 group-hover:text-zinc-400"
          />
        </div>

        {error && (
          <div className="mx-2 mb-2 p-2 bg-red-500/10 border border-red-500/20 rounded flex items-center gap-2 text-red-400 text-[10px] shrink-0">
            <AlertCircle size={12} />
            <span>{error}</span>
          </div>
        )}

        {/* --- Inpaint Section --- */}
        <div
          className={`border border-zinc-800/50 rounded-lg overflow-hidden mb-1 transition-colors ${
            studioState.activeTab === "inpaint"
              ? "bg-zinc-900/30"
              : "bg-transparent"
          }`}
        >
          <button
            onClick={() => toggleSection("inpaint")}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors ${
              studioState.activeTab === "inpaint"
                ? "text-zinc-200 bg-zinc-800/50"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30"
            }`}
          >
            <div className="flex items-center gap-2">
              <Eraser size={12} />
              <span>Remove Object</span>
            </div>
            {studioState.activeTab === "inpaint" ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
          </button>

          {studioState.activeTab === "inpaint" && (
            <div className="p-2 space-y-3 animate-in slide-in-from-top-1 duration-200">
              <div className="text-[10px] text-zinc-500 leading-tight px-1">
                Click on the object in the image you want to remove.
              </div>

              {studioState.inpaintCoords && (
                <div className="px-2 py-1 bg-zinc-950 rounded border border-zinc-800 text-[9px] font-mono text-zinc-400 text-center">
                  Target: {studioState.inpaintCoords.x},{" "}
                  {studioState.inpaintCoords.y}
                </div>
              )}

              <button
                onClick={handleInpaint}
                disabled={isLoading || !image}
                className={`w-full flex items-center justify-center gap-2 text-[11px] font-medium py-2 rounded transition-colors ${
                  isLoading || !image
                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    : "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30"
                }`}
              >
                {isLoading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  "Process Removal"
                )}
              </button>
            </div>
          )}
        </div>

        {/* --- Relight Section --- */}
        <div
          className={`border border-zinc-800/50 rounded-lg overflow-hidden transition-colors ${
            studioState.activeTab === "relight"
              ? "bg-zinc-900/30"
              : "bg-transparent"
          }`}
        >
          <button
            onClick={() => toggleSection("relight")}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors ${
              studioState.activeTab === "relight"
                ? "text-zinc-200 bg-zinc-800/50"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30"
            }`}
          >
            <div className="flex items-center gap-2">
              <Sun size={12} />
              <span>Relighting</span>
            </div>
            {studioState.activeTab === "relight" ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
          </button>

          {studioState.activeTab === "relight" && (
            <div className="p-2 space-y-3 animate-in slide-in-from-top-1 duration-200">
              <div className="grid grid-cols-2 gap-2 mb-1">
                <div className="bg-zinc-950 p-1.5 rounded border border-zinc-800 text-center">
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wide">
                    Azimuth
                  </div>
                  <div className="text-xs font-mono text-blue-400">
                    {Math.round(studioState.relightParams.az)}°
                  </div>
                </div>
                <div className="bg-zinc-950 p-1.5 rounded border border-zinc-800 text-center">
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wide">
                    Elevation
                  </div>
                  <div className="text-xs font-mono text-blue-400">
                    {Math.round(studioState.relightParams.el)}°
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 px-1">
                <Slider
                  label="Intensity"
                  value={studioState.relightParams.intensity}
                  min={0}
                  max={5}
                  step={0.1}
                  onChange={(v) => updateRelightParam("intensity", v)}
                />
                <Slider
                  label="Ambient"
                  value={studioState.relightParams.ambient}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) => updateRelightParam("ambient", v)}
                />
                <Slider
                  label="Spot Cone"
                  value={studioState.relightParams.cone}
                  min={1}
                  max={90}
                  step={1}
                  onChange={(v) => updateRelightParam("cone", v)}
                />
                <Slider
                  label="Exponent"
                  value={studioState.relightParams.exponent}
                  min={1}
                  max={200}
                  step={1}
                  onChange={(v) => updateRelightParam("exponent", v)}
                />
              </div>

              <div className="pt-1">
                <button
                  onClick={handleRelight}
                  disabled={isLoading || !image}
                  className={`w-full flex items-center justify-center gap-2 text-[11px] font-medium py-2 rounded transition-colors ${
                    isLoading || !image
                      ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Calculating...</span>
                    </>
                  ) : (
                    <>
                      <Lightbulb size={12} />
                      <span>Apply Lighting</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* --- Footer Controls --- */}
        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-zinc-800/50">
          <button
            onClick={handleExit}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium rounded-lg transition-colors border border-zinc-800"
          >
            <LogOut size={12} />
            Exit
          </button>
          <button
            onClick={handleDone}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 hover:text-emerald-400 text-xs font-medium rounded-lg transition-colors border border-emerald-500/20"
          >
            <Check size={12} />
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

const Slider = ({ label, value, min, max, step, onChange }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-[10px] text-zinc-500">
      <span>{label}</span>
      <span className="text-zinc-300 font-mono">{value}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
    />
  </div>
);

export default RemRelightComponent;
