import React, { createContext, useContext, useState, useEffect } from "react";

const ImageContext = createContext();

export const ImageProvider = ({ children }) => {
  // --- CORE IMAGE STATE ---
  const [image, setImage] = useState(null); 
  const [previewImage, setPreviewImage] = useState(null); 
  
  // --- HISTORY STATE ---
  const [history, setHistory] = useState([]); // Stores [Version 1, Version 2...]

  // --- TOOL STATE ---
  const [activeTool, setActiveTool] = useState("none");

  // --- SAM SESSION STATE ---
  const [sessionId, setSessionId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [samState, setSamState] = useState({
    points: [],
    bboxes: [],
    merged_bboxes: [],
    ocr_results: [],
  });

  // --- GRADING STATE ---
  const [gradingState, setGradingState] = useState({
    emotions: [],
    selectedEmotion: null,
    results: [],
    isGrading: false,
  });

  // --- STUDIO STATE ---
  const [studioState, setStudioState] = useState({
    activeTab: 'inpaint', 
    inpaintedImage: null, 
    inpaintCoords: null,
    isInpainting: false,
    relightParams: { az: 45, el: 30, intensity: 1.0, ambient: 0.2, cone: 8, exponent: 80 },
    isRelighting: false
  });

  // --- HISTORY ACTIONS ---

  // 1. Call on Initial Upload (Fixes "uploadNewImage is not a function")
  const uploadNewImage = (file) => {
    setImage(file);
    setHistory([file]); // Start history with Version 1 (Original)
  };

  // 2. Call on Apply/Confirm
  const commitImage = (newFile) => {
    setImage(newFile);
    setHistory(prev => [...prev, newFile]); // Append the new version to the list
  };

  // 3. Call to View Old Version
  const restoreFromHistory = (historyFile) => {
    setImage(historyFile);
    // We don't delete history here, we just change the active view.
  };

  // --- GLOBAL RESET LOGIC ---
  useEffect(() => {
    if (!image) {
      setHistory([]); 
      setSessionId(null);
      setSamState({ points: [], bboxes: [], merged_bboxes: [], ocr_results: [] });
      setPreviewImage(null);
      setGradingState(prev => ({ ...prev, results: [], selectedEmotion: null, isGrading: false }));
      setStudioState({
        activeTab: 'inpaint', inpaintedImage: null, inpaintCoords: null, isInpainting: false,
        relightParams: { az: 45, el: 30, intensity: 1.0, ambient: 0.2, cone: 8, exponent: 80 }, isRelighting: false
      });
    }
  }, [image]);

  const updateSamState = (newData) => { setSamState((prev) => ({ ...prev, ...newData })); };
  const updateGradingState = (newData) => { setGradingState((prev) => ({ ...prev, ...newData })); };
  const updateStudioState = (newData) => { setStudioState((prev) => ({ ...prev, ...newData })); };

  return (
    <ImageContext.Provider
      value={{
        // Core
        image, 
        setImage, // Internal use only
        uploadNewImage, // <--- EXPOSED: Fixes your error
        commitImage,    // <--- EXPOSED: Adds new versions
        previewImage, setPreviewImage,
        
        // History
        history, 
        restoreFromHistory,

        // Tools
        activeTool, setActiveTool,

        // SAM Data
        sessionId, setSessionId, isProcessing, setIsProcessing,
        samState, setSamState: updateSamState,

        // Grading Data
        gradingState, setGradingState: updateGradingState,

        // Studio Data
        studioState, setStudioState: updateStudioState
      }}
    >
      {children}
    </ImageContext.Provider>
  );
};

export const useImage = () => {
  return useContext(ImageContext);
};