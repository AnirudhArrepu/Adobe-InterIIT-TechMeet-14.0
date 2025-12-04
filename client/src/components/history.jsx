import React, { useState, useEffect } from "react";
import { useImage } from "../context/ImageContext";
import { IconScissors, IconPhoto, IconCurrentLocation } from "@tabler/icons-react";

export default function HistoryComponent() {
  const { history, restoreFromHistory, image } = useImage();

  // DEBUG: Check if history updates
  useEffect(() => {
    console.log("History Updated:", history);
  }, [history]);

  // Create a reversed copy for display (Newest First)
  // We use useMemo to avoid re-calculating on every render if history hasn't changed
  const reversedHistory = React.useMemo(() => {
    return history ? [...history].reverse() : [];
  }, [history]);

  return (
    <div className="h-full flex flex-col bg-zinc-950 pr-6 pl-6 pt-8 pb-12 border-l border-zinc-800">
      {/* Header */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center gap-2 mb-1">
            <p className="text-zinc-300 text-base font-medium">Versions</p>
            {history.length > 0 && (
                <span className="bg-zinc-800 text-zinc-400 text-[10px] px-2 py-0.5 rounded-full">
                    {history.length}
                </span>
            )}
        </div>
        <p className="text-zinc-500 text-xs leading-relaxed">
          Original file is Version 1. Tap to restore.
        </p>
      </div>

      {reversedHistory.length === 0 ? (
        // Empty State
        <div className="flex-1 flex flex-col items-center justify-center p-4 border-2 border-dashed border-zinc-800/50 rounded-xl">
          <IconScissors className="w-12 h-12 text-zinc-800 mb-4" stroke={1.5} />
          <p className="text-zinc-600 text-sm font-medium text-center">No history yet.</p>
        </div>
      ) : (
        // List
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2">
          <div className="flex flex-col gap-4">
            {reversedHistory.map((file, index) => {
              // Calculate actual version number (1-based)
              // index 0 in reversed array = length in original array
              const versionNumber = history.length - index;
              
              // Check active state by comparing file object reference
              const isActive = file === image; 

              return (
                <HistoryThumbnail 
                    key={index} // Using index is safe here as list order is stable relative to history
                    file={file} 
                    version={versionNumber}
                    isActive={isActive}
                    onRestore={() => restoreFromHistory(file)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component for individual history items
const HistoryThumbnail = ({ file, version, onRestore, isActive }) => {
    const [previewUrl, setPreviewUrl] = useState(null);

    useEffect(() => {
        if (!file) return;
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
        
        // Cleanup memory when component unmounts or file changes
        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);

    return (
        <div 
            onClick={onRestore} 
            className={`group cursor-pointer relative transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
        >
            <div className={`relative w-full aspect-video bg-zinc-900 rounded-lg overflow-hidden border transition-all duration-200 ${isActive ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-zinc-800 group-hover:border-zinc-600'}`}>
                {previewUrl ? (
                    <img src={previewUrl} alt={`V${version}`} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-800">
                        <IconPhoto size={24} />
                    </div>
                )}
                
                {/* Active Badge */}
                {isActive && (
                    <div className="absolute top-2 right-2 bg-emerald-500/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1 backdrop-blur-sm">
                        <IconCurrentLocation size={10} /> Active
                    </div>
                )}
            </div>
            
            <div className="flex justify-between items-center mt-2 px-1">
                <p className={`text-xs font-medium transition-colors ${isActive ? 'text-emerald-400' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                    Version {version} {version === 1 ? '(Original)' : ''}
                </p>
                <span className="text-[10px] text-zinc-600 font-mono">
                    {(file.size / 1024).toFixed(0)} KB
                </span>
            </div>
        </div>
    );
};