import React, { useState, useEffect, useRef } from "react";
import { 
  RotateCcw, 
  Undo2, 
  Download, 
  ScanText, 
  GripHorizontal, 
  Activity, 
  CheckCircle2, 
  AlertCircle,
  FileImage,
  X,
  Save,
  Edit3,
  Check,
  LogOut // Added for Exit icon
} from "lucide-react";
import { useImage } from "../../context/ImageContext";

const API_URL = "http://localhost:5000/sam";
const NGROK_HEADERS = { "ngrok-skip-browser-warning": "true" };

const SAMButtonsComponent = () => {
  const { 
    image, 
    setImage, 
    commitImage,
    sessionId, 
    setSessionId, 
    samState, 
    setSamState,
    activeTool,
    setActiveTool // <--- Added: To close the tool
  } = useImage(); 
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showOcrPanel, setShowOcrPanel] = useState(false);
  const [editableOcr, setEditableOcr] = useState([]);

  // Draggable State
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // --- API Logic ---

  const createSession = async (file) => {
    setIsLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_URL}/create_session`, { 
        method: "POST", 
        headers: NGROK_HEADERS,
        body: formData 
      });
      
      if (!res.ok) throw new Error("Backend connection failed");
      const data = await res.json();
      setSessionId(data.session_id);
    } catch (err) {
      console.error("SAM Init Error:", err);
      setError("Connection Failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API_URL}/clear_session?session_id=${sessionId}`, { 
        method: "POST",
        headers: NGROK_HEADERS
      });
      const data = await res.json();
      setSamState(data);
    } catch (err) { console.error(err); }
  };

  const handleRemoveLast = async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API_URL}/remove_last_point?session_id=${sessionId}`, { 
        method: "POST",
        headers: NGROK_HEADERS 
      });
      const data = await res.json();
      setSamState(data);
    } catch (err) { console.error(err); }
  };

  const handleExport = () => {
    const data = { 
        session_id: sessionId, 
        points: samState.points, 
        bboxes: samState.bboxes,
        merged_bboxes: samState.merged_bboxes,
        timestamp: new Date().toISOString() 
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sam_export_${sessionId?.substring(0, 8)}.json`;
    a.click();
  };

  const handleOCR = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/get_ocr?session_id=${sessionId}`, {
        headers: NGROK_HEADERS 
      });
      
      const data = await res.json();
      setSamState({ ocr_results: data.ocr_results });
      setEditableOcr(data.ocr_results.map(item => ({
        ...item,
        target_text: item.target_text || "" 
      })));
      setShowOcrPanel(true);
    } catch (err) { 
        console.error("OCR Error:", err);
        setError("OCR Failed"); 
    } finally { 
        setIsLoading(false); 
    }
  };

  const handleApplyOCR = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/update_ocr`, {
        method: 'POST',
        headers: { ...NGROK_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          ocr_results: editableOcr
        })
      });

      if (!res.ok) throw new Error("Failed to update text");

      const imageRes = await fetch(`${API_URL}/get_edited_image?session_id=${sessionId}`, {
        headers: NGROK_HEADERS
      });
      const imageBlob = await imageRes.blob();
      const newFile = new File([imageBlob], "ocr_edited.png", { type: "image/png" });

      commitImage(newFile); 
      setShowOcrPanel(false);
      setSamState({ ocr_results: [] }); 

    } catch (err) {
      console.error("OCR Update Error", err);
      setError("Update Failed");
    } finally {
      setIsLoading(false);
    }
  };

  // --- EXIT HANDLERS ---
  
  const handleDone = () => {
    // 1. Clear Backend Session (Optional, but good practice)
    // 2. Clear Frontend State
    setSessionId(null);
    setSamState({ points: [], bboxes: [], merged_bboxes: [], ocr_results: [] });
    // 3. Close Tool
    setActiveTool(null);
  };

  const handleCancel = () => {
    // Just close the tool without saving pending points
    // (Note: Committed OCR changes are already in history)
    setSessionId(null);
    setSamState({ points: [], bboxes: [], merged_bboxes: [], ocr_results: [] });
    setActiveTool(null);
  };

  const handleInputChange = (index, value) => {
    const newOcr = [...editableOcr];
    newOcr[index].target_text = value;
    setEditableOcr(newOcr);
  };

  // --- Hooks ---
  useEffect(() => {
    if (image && !sessionId && activeTool === 'sam') {
      createSession(image);
    }
    if (!image) setShowOcrPanel(false);
  }, [image, activeTool]);

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

  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  // --- RENDER ---
  
  if (activeTool !== 'sam') return null;

  const isDisabled = !sessionId || isLoading;
  
  const getStatusBadge = () => {
    if (error) return <Badge color="text-red-400 bg-red-400/10" icon={<AlertCircle size={10}/>} text="Error" />;
    if (isLoading) return <Badge color="text-yellow-400 bg-yellow-400/10" icon={<Activity size={10} className="animate-pulse"/>} text="Processing" />;
    if (sessionId) return <Badge color="text-emerald-400 bg-emerald-400/10" icon={<CheckCircle2 size={10}/>} text="Ready" />;
    if (image) return <Badge color="text-blue-400 bg-blue-400/10" icon={<Activity size={10}/>} text="Uploading" />;
    return <Badge color="text-zinc-500 bg-zinc-800" icon={<FileImage size={10}/>} text="No Image" />;
  };

  return (
    <div
      className="absolute left-6 z-50 flex flex-col gap-2"
      style={{
        top: "50%",
        transform: `translate(${position.x}px, calc(-50% + ${position.y}px))`,
        cursor: isDragging ? "grabbing" : "default",
      }}
    >
      <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-800 p-1.5 rounded-xl shadow-2xl w-64 transition-all duration-300">
        
        {/* Header */}
        <div
          onMouseDown={handleMouseDown}
          className="px-3 py-2.5 flex items-center justify-between cursor-grab active:cursor-grabbing group rounded-lg hover:bg-zinc-900 transition-colors mb-1"
        >
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 select-none group-hover:text-zinc-300 transition-colors">
            SAM Toolkit
          </span>
          <GripHorizontal size={14} className="text-zinc-600 group-hover:text-zinc-400" />
        </div>

        {/* Tools */}
        <div className={`grid grid-cols-2 gap-1 mb-2 ${isDisabled ? "opacity-40 pointer-events-none grayscale" : ""}`}>
          <ToolButton icon={<RotateCcw size={13} />} label="Clear" onClick={handleClear} />
          <ToolButton icon={<Undo2 size={13} />} label="Undo" onClick={handleRemoveLast} />
          <ToolButton icon={<Download size={13} />} label="Export" onClick={handleExport} />
          <ToolButton 
            icon={<ScanText size={13} />} 
            label="OCR" 
            onClick={handleOCR} 
            active={showOcrPanel}
          />
        </div>

        {/* OCR Panel */}
        {showOcrPanel && (
           <div className="mb-2 bg-zinc-900/80 rounded-lg border border-zinc-800 overflow-hidden flex flex-col max-h-64">
              <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800">
                 <span className="text-[10px] font-semibold text-blue-400 flex items-center gap-1">
                    <Edit3 size={10} /> DETECTED TEXT
                 </span>
                 <button onClick={() => setShowOcrPanel(false)} className="text-zinc-500 hover:text-zinc-300">
                    <X size={12} />
                 </button>
              </div>
              
              <div className="overflow-y-auto p-2 space-y-2 custom-scrollbar">
                  {editableOcr.length === 0 ? (
                      <div className="text-center text-[10px] text-zinc-500 py-2">No text detected</div>
                  ) : (
                      editableOcr.map((item, idx) => (
                        <div key={idx} className="bg-zinc-950 p-2 rounded border border-zinc-800/50">
                            <div className="text-[10px] text-zinc-500 mb-1 truncate" title={item.ocr}>
                                Detect: <span className="text-zinc-400">"{item.ocr}"</span>
                            </div>
                            <input 
                                type="text" 
                                placeholder="Replacement text..."
                                value={item.target_text}
                                onChange={(e) => handleInputChange(idx, e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-blue-500/50 placeholder:text-zinc-700"
                            />
                        </div>
                      ))
                  )}
              </div>

              <div className="p-2 border-t border-zinc-800 bg-zinc-900">
                  <button 
                    onClick={handleApplyOCR}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium py-1.5 rounded transition-colors disabled:opacity-50"
                  >
                    {isLoading ? <Activity size={12} className="animate-spin" /> : <Check size={12} />}
                    Apply Changes
                  </button>
              </div>
           </div>
        )}

        <div className="h-px bg-zinc-800/80 my-2 mx-1" />

        {/* Stats */}
        <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800/50 mb-2">
           <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Session Info</span>
              {getStatusBadge()}
           </div>
           
           <div className="space-y-2">
              <InfoRow label="Session ID" value={sessionId ? "#" + sessionId.substring(0,8) : "-"} isMono={true} />
              <div className="h-px bg-zinc-800/50 my-1" />
              <InfoRow label="Points" value={samState.points?.length || 0} />
              <InfoRow label="Bounding Boxes" value={samState.bboxes?.length || 0} />
              <InfoRow label="Merged Boxes" value={samState.merged_bboxes?.length || 0} />
           </div>
        </div>

        {/* NEW: Session Actions Footer */}
        <div className="grid grid-cols-2 gap-2 mt-1">
            <button 
                onClick={handleCancel}
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

// ... Sub Components (ToolButton, Badge, InfoRow) remain same ...
const ToolButton = ({ icon, label, onClick, active }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`flex items-center justify-center gap-2 px-2 py-2 text-xs rounded-md transition-all duration-200 border border-transparent ${
        active 
        ? "bg-blue-500/10 text-blue-400 border-blue-500/20" 
        : "text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700"
    }`}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </button>
);

const Badge = ({ color, icon, text }) => (
  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${color}`}>
    {icon}
    <span className="text-[10px] font-bold uppercase tracking-wide">{text}</span>
  </div>
);

const InfoRow = ({ label, value, isMono = false }) => (
  <div className="flex items-center justify-between text-[11px]">
    <span className="text-zinc-500 font-medium">{label}</span>
    <span className={`text-zinc-300 ${isMono ? "font-mono text-[10px]" : "font-semibold"}`}>
      {value}
    </span>
  </div>
);

export default SAMButtonsComponent;