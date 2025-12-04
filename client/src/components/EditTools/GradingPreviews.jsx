import React, { useState, useEffect, useRef } from "react";
import { GripHorizontal, CheckCircle2 } from "lucide-react"; // Removed unused imports
import { useImage } from "../../context/ImageContext";

const GradingPreviews = () => {
  const { image, activeTool, gradingState, previewImage, setPreviewImage } = useImage();

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const [originalUrl, setOriginalUrl] = useState(null);

  // Generate Original URL
  useEffect(() => {
    if (image) {
      const url = URL.createObjectURL(image);
      setOriginalUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setOriginalUrl(null);
    }
  }, [image]);

  // Drag Logic
  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
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

  // Render Conditions
  if (activeTool !== "grade" || gradingState.results.length === 0) return null;

  return (
    <div
      className="absolute right-80 z-50 flex flex-col gap-2"
      style={{
        top: "50%",
        transform: `translate(${position.x}px, calc(-50% + ${position.y}px))`,
        cursor: isDragging ? "grabbing" : "default",
      }}
    >
      <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-800 p-1.5 rounded-xl shadow-2xl w-40 transition-all duration-300">
        
        {/* Header */}
        <div
          onMouseDown={handleMouseDown}
          className="px-3 py-2.5 flex items-center justify-between cursor-grab active:cursor-grabbing group rounded-lg hover:bg-zinc-900 transition-colors mb-1"
        >
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 select-none group-hover:text-zinc-300 transition-colors flex items-center gap-2">
            Variants
          </span>
          <GripHorizontal size={14} className="text-zinc-600 group-hover:text-zinc-400" />
        </div>

        {/* Thumbnail List */}
        <div className="space-y-2 p-1 max-h-[600px] overflow-y-auto custom-scrollbar">
          
          {/* Original Image Item */}
          <div
            onClick={() => setPreviewImage(null)}
            className={`relative aspect-video w-full rounded-lg overflow-hidden border-2 cursor-pointer transition-all group ${
              previewImage === null
                ? "border-blue-500 ring-2 ring-blue-500/20"
                : "border-zinc-800 hover:border-zinc-600"
            }`}
          >
            {originalUrl && (
              <img
                src={originalUrl}
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                alt="Original"
              />
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-[2px] px-2 py-1 flex items-center justify-between">
              <span className="text-[10px] font-medium text-white">Original</span>
              {previewImage === null && <CheckCircle2 size={10} className="text-blue-400" />}
            </div>
          </div>

          {/* Generated Variants */}
          {gradingState.results.map((resultSrc, idx) => {
            const isSelected = previewImage === resultSrc;
            return (
              <div
                key={idx}
                onClick={() => setPreviewImage(resultSrc)}
                className={`relative aspect-video w-full rounded-lg overflow-hidden border-2 cursor-pointer transition-all group ${
                  isSelected
                    ? "border-blue-500 ring-2 ring-blue-500/20"
                    : "border-zinc-800 hover:border-zinc-600"
                }`}
              >
                <img
                  src={resultSrc}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  alt={`Variant ${idx + 1}`}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-[2px] px-2 py-1 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-white">V{idx + 1}</span>
                  {isSelected && <CheckCircle2 size={10} className="text-blue-400" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GradingPreviews;