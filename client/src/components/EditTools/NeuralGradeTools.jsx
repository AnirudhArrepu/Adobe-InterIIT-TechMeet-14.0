import React, { useState, useEffect, useRef } from "react";
import { 
  Wand2, 
  GripHorizontal, 
  Loader2, 
  AlertCircle, 
  Palette,
  Check,
  LogOut // Added
} from "lucide-react";
import { useImage } from "../../context/ImageContext";

const API_BASE = "http://localhost:8001";

const NeuralGradeTools = () => {
  const { 
    image, 
    activeTool,
    setActiveTool, // Added
    gradingState, 
    setGradingState,
    commitImage // Added
  } = useImage();

  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState(null);

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // 1. Fetch Emotions
  useEffect(() => {
    if (activeTool === 'grade' && gradingState.emotions.length === 0) {
      fetchEmotions();
    }
  }, [activeTool]);

  const fetchEmotions = async () => {
    setIsInitializing(true);
    try {
      const res = await fetch(`${API_BASE}/emotions`);
      if (!res.ok) throw new Error("Failed to load styles");
      const data = await res.json();
      
      setGradingState({ 
        emotions: data.emotions || [],
        selectedEmotion: data.emotions?.[0] || null
      });
    } catch (err) {
      console.error(err);
      setError("Engine Offline");
    } finally {
      setIsInitializing(false);
    }
  };

  // 2. Handle Grading Logic
  const handleGrade = async () => {
    if (!image || !gradingState.selectedEmotion) return;
    
    setIsLoading(true);
    setError(null);
    setGradingState({ isGrading: true, results: [] });

    const formData = new FormData();
    formData.append('emotion', gradingState.selectedEmotion);
    formData.append('file', image);

    try {
      const res = await fetch(`${API_BASE}/grade`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error("Grading failed");
      const data = await res.json();
      
      setGradingState({ 
        results: data.results, 
        isGrading: false 
      });

    } catch (err) {
      console.error(err);
      setError("Processing Failed");
      setGradingState({ isGrading: false });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectEmotion = (emotion) => {
    setGradingState({ selectedEmotion: emotion });
  };

  // --- Exit Logic ---
  const handleExit = () => {
    setGradingState({ results: [], selectedEmotion: null, isGrading: false });
    setActiveTool(null);
  };

  // --- Drag Logic ---
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

  // --- Render ---
  if (activeTool !== 'grade') return null;

  return (
    <div
      className="absolute left-6 z-50 flex flex-col gap-2"
      style={{
        top: "50%",
        transform: `translate(${position.x}px, calc(-50% + ${position.y}px))`,
        cursor: isDragging ? "grabbing" : "default",
      }}
    >
      <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-800 p-1.5 rounded-xl shadow-2xl w-64 transition-all duration-300 flex flex-col max-h-[500px]">
        
        {/* Header */}
        <div
          onMouseDown={handleMouseDown}
          className="px-3 py-2.5 flex items-center justify-between cursor-grab active:cursor-grabbing group rounded-lg hover:bg-zinc-900 transition-colors mb-1 shrink-0"
        >
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 select-none group-hover:text-zinc-300 transition-colors flex items-center gap-2">
            Neural Grade
          </span>
          <GripHorizontal size={14} className="text-zinc-600 group-hover:text-zinc-400" />
        </div>

        {error && (
          <div className="mx-2 mb-2 p-2 bg-red-500/10 border border-red-500/20 rounded flex items-center gap-2 text-red-400 text-[10px] shrink-0">
            <AlertCircle size={12} />
            <span>{error}</span>
          </div>
        )}

        {isInitializing && (
           <div className="flex flex-col items-center justify-center py-6 text-zinc-500 gap-2">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-[10px] uppercase tracking-wide">Connecting Engine...</span>
           </div>
        )}

        {!isInitializing && (
          <>
            {/* Emotion List Panel */}
            <div className="bg-zinc-900/50 rounded-lg p-1 border border-zinc-800/50 overflow-hidden flex flex-col min-h-0">
               <div className="px-2 py-1.5 border-b border-zinc-800/50 mb-1">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                     <Palette size={10} /> Select Style
                  </span>
               </div>
               
               <div className="overflow-y-auto custom-scrollbar max-h-48 space-y-0.5 p-1">
                  {gradingState.emotions.map((emo) => {
                    const isSelected = gradingState.selectedEmotion === emo;
                    return (
                      <button
                        key={emo}
                        onClick={() => handleSelectEmotion(emo)}
                        className={`w-full text-left px-3 py-2 text-[11px] rounded-md transition-all flex items-center justify-between group ${
                          isSelected 
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" 
                            : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-transparent"
                        }`}
                      >
                        <span className="font-medium truncate">{emo}</span>
                        {isSelected && <Check size={10} className="text-blue-400" />}
                      </button>
                    );
                  })}
               </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-zinc-800/80 my-2 mx-1" />

            {/* Footer Action */}
            <div className="grid grid-cols-2 gap-2 mt-1">
               <button
                  onClick={handleExit}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium rounded-lg transition-colors border border-zinc-800"
               >
                  <LogOut size={12} />
                  Exit
               </button>
               <button
                  onClick={handleGrade}
                  disabled={isLoading || !image}
                  className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    isLoading || !image
                      ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-500 text-white"
                  }`}
               >
                  {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                  <span>Generate</span>
               </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NeuralGradeTools;