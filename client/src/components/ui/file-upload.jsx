import { cn } from "../../lib/utils";
import React, { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  IconUpload,
  IconX,
  IconCheck,
  IconArrowBackUp,
} from "@tabler/icons-react";
import { useDropzone } from "react-dropzone";
import { useImage } from "../../context/ImageContext";

const API_URL = "http://localhost:5000/sam";
const NGROK_HEADERS = { "ngrok-skip-browser-warning": "true" };

const mainVariant = {
  initial: { x: 0, y: 0 },
  animate: { x: 0, y: 0, opacity: 0.99 },
};

const secondaryVariant = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
};

export const FileUpload = ({ onChange }) => {
  // 1. Get Context Values
  const {
    image,
    setImage,
    uploadNewImage, // History Init
    commitImage, // History Save
    previewImage,
    setPreviewImage,
    sessionId,
    setSessionId,
    samState,
    setSamState,
    setGradingState,

    // STUDIO STATE
    activeTool,
    studioState,
    setStudioState,
    setIsProcessing,
  } = useImage();

  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  // 2. Canvas Refs & State
  const canvasRef = useRef(null);
  const [imageObj, setImageObj] = useState(null);
  const [isDraggingSun, setIsDraggingSun] = useState(false);

  const handleFileChange = (newFiles) => {
    setFiles(newFiles);
    // ✅ Initialize History
    uploadNewImage(newFiles[0]);
    onChange && onChange(newFiles[0]);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const { getRootProps, isDragActive } = useDropzone({
    multiple: false,
    noClick: true,
    maxFiles: 1,
    maxSize: 150 * 1024 * 1024,
    accept: { "image/*": [] },
    onDrop: handleFileChange,
    onDropRejected: (error) => console.log(error),
  });

  // 3. Load Image Object
  useEffect(() => {
    // Priority: Preview > Context Image
    const currentSource = previewImage || image;

    if (!currentSource) return;

    const img = new Image();
    img.crossOrigin = "anonymous";

    if (typeof currentSource === "string") {
      img.src = currentSource;
    } else {
      img.src = URL.createObjectURL(currentSource);
    }

    img.onload = () => {
      setImageObj(img);
    };
  }, [image, previewImage]);

  // --- DRAWING LOGIC (The Brain) ---
  useEffect(() => {
    if (!canvasRef.current || !imageObj) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    canvas.width = imageObj.width;
    canvas.height = imageObj.height;

    // A. Draw Base Image
    ctx.drawImage(imageObj, 0, 0);

    // B. SAM Overlays (Only if SAM is active AND not previewing)
    if (activeTool === "sam" && !previewImage) {
      if (samState?.merged_bboxes) {
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = Math.max(3, imageObj.width / 300);
        samState.merged_bboxes.forEach((bbox) => {
          ctx.strokeRect(
            bbox.x1,
            bbox.y1,
            bbox.x2 - bbox.x1,
            bbox.y2 - bbox.y1
          );
        });
      }
      if (samState?.points) {
        ctx.fillStyle = "#10b981";
        const pointRadius = Math.max(4, imageObj.width / 200);
        samState.points.forEach((point) => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, pointRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "white";
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }
      if (samState?.ocr_results) {
        samState.ocr_results.forEach((result) => {
          const [x1, y1, x2, y2] = result.crop_coord;
          ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
          ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = Math.max(2, imageObj.width / 400);
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        });
      }
    }

    // C. STUDIO Overlays (Inpaint & Relight)
    if (activeTool === "studio") {
      // 1. Inpaint Marker (Red Target)
      if (studioState.activeTab === "inpaint" && studioState.inpaintCoords) {
        const { x, y } = studioState.inpaintCoords;
        const radius = Math.max(5, imageObj.width / 150);

        // Outer Ring
        ctx.strokeStyle = "#ef4444"; // Red-500
        ctx.lineWidth = Math.max(2, imageObj.width / 400);
        ctx.beginPath();
        ctx.arc(x, y, radius * 1.5, 0, Math.PI * 2);
        ctx.stroke();

        // Inner Dot
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(x, y, radius / 2, 0, Math.PI * 2);
        ctx.fill();
        console.log("Drawing Inpaint Marker at:", x, y);
      }

      // 2. Relight Gizmo (Sun & Ray)
      if (studioState.activeTab === "relight") {
        const { az, el } = studioState.relightParams;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        // Calculate Sun Position from Params
        const maxDist = Math.min(cx, cy) * 0.8;
        const dist = maxDist * (1 - el / 90);
        const angleRad = az * (Math.PI / 180);

        const sunX = cx + dist * Math.cos(angleRad);
        const sunY = cy - dist * Math.sin(angleRad);

        // Draw Line (Ray)
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(sunX, sunY);
        ctx.strokeStyle = "rgba(253, 224, 71, 0.6)";
        ctx.lineWidth = Math.max(2, imageObj.width / 400);
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw Sun Handle
        const sunRadius = Math.max(8, imageObj.width / 100);
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(253, 224, 71, 0.9)";
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, [imageObj, samState, previewImage, activeTool, studioState]);

  // --- INTERACTION HANDLERS ---

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      rectWidth: rect.width,
      rectHeight: rect.height,
    };
  };

  const handleMouseDown = (e) => {
    if (activeTool === "studio" && studioState.activeTab === "relight") {
      setIsDraggingSun(true);
    }
  };

  const handleMouseMove = (e) => {
    if (
      activeTool === "studio" &&
      studioState.activeTab === "relight" &&
      isDraggingSun
    ) {
      const coords = getCanvasCoords(e);
      const cx = coords.rectWidth / 2;
      const cy = coords.rectHeight / 2;
      const mouseX = e.clientX - canvasRef.current.getBoundingClientRect().left;
      const mouseY = e.clientY - canvasRef.current.getBoundingClientRect().top;

      const dx = mouseX - cx;
      const dy = cy - mouseY;

      // 1. Azimuth (Angle)
      let angleRad = Math.atan2(dy, dx);
      let angleDeg = angleRad * (180 / Math.PI);
      if (angleDeg < 0) angleDeg += 360;

      // 2. Elevation (Distance)
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = Math.min(cx, cy) * 0.8;
      let elevation = 90 * (1 - dist / maxDist);
      elevation = Math.max(0, Math.min(90, elevation));

      setStudioState((prev) => ({
        ...prev,
        relightParams: {
          ...prev.relightParams,
          az: angleDeg,
          el: elevation,
        },
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDraggingSun(false);
  };

  const handleCanvasClick = async (e) => {
    // 1. SAM Logic
    if (activeTool === "sam" && sessionId && !previewImage) {
      const { x, y } = getCanvasCoords(e);
      setIsProcessing(true);
      try {
        const response = await fetch(`${API_URL}/add_point`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...NGROK_HEADERS,
          },
          body: JSON.stringify({
            session_id: sessionId,
            point: { x: Math.round(x), y: Math.round(y) },
          }),
        });
        const data = await response.json();
        setSamState(data);
      } catch (error) {
        console.error(error);
      } finally {
        setIsProcessing(false);
      }
    }

    // In handleCanvasClick function, around line where studio inpaint logic is:
    // 2. Studio Inpaint Logic
    if (activeTool === "studio" && studioState.activeTab === "inpaint") {
      const { x, y } = getCanvasCoords(e);
      console.log("Setting inpaint coords:", x, y); // Debug log
      setStudioState((prev) => ({
        ...prev,
        inpaintCoords: { x: Math.round(x), y: Math.round(y) },
      }));
    }
  };

  // --- CONFIRM / CANCEL ---
  const handleConfirmPreview = async () => {
    if (!previewImage) return;
    try {
      const res = await fetch(previewImage, { headers: NGROK_HEADERS });
      const blob = await res.blob();
      const file = new File([blob], "edited.png", { type: "image/png" });

      // ✅ Save Version to History
      commitImage(file);

      setFiles([file]);
      setPreviewImage(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelPreview = () => {
    setPreviewImage(null);
  };

  return (
    <div className="w-full" {...getRootProps()}>
      <motion.div
        onClick={files.length === 0 && !image ? handleClick : undefined}
        className="p-10 group/file block rounded-lg cursor-pointer w-full relative overflow-hidden"
      >
        <input
          ref={fileInputRef}
          id="file-upload-handle"
          type="file"
          accept="image/*"
          onChange={(e) => handleFileChange(Array.from(e.target.files || []))}
          className="hidden"
        />
        <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,white,transparent)]">
          <GridPattern />
        </div>
        <div className="flex flex-col items-center justify-center">
          <div>
            {(files.length > 0 || image) && (
              <motion.div
                className={cn(
                  "relative z-40 bg-white dark:bg-neutral-900 flex flex-col items-start justify-start p-4 w-full mx-auto rounded-md",
                  "shadow-sm"
                )}
              >
                {/* Header Controls */}
                <div className="absolute top-2 right-2 z-50 flex gap-2">
                  {previewImage ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConfirmPreview();
                        }}
                        className="bg-emerald-500 text-white p-1.5 rounded-full shadow-lg hover:bg-emerald-600 transition-colors flex items-center gap-1 px-3"
                      >
                        <IconCheck className="h-4 w-4" />
                        <span className="text-xs font-bold">APPLY</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelPreview();
                        }}
                        className="bg-neutral-700 text-neutral-300 p-1.5 rounded-full shadow-lg hover:bg-neutral-600 transition-colors"
                      >
                        <IconArrowBackUp className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFiles([]);
                        setImage(null);
                        setPreviewImage(null);
                        onChange && onChange(null);
                      }}
                      className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 p-1 rounded-full shadow-md hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                    >
                      <IconX className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className={cn(
                    "w-full h-auto max-h-[400px] object-contain rounded-md transition-all duration-300",
                    previewImage
                      ? "cursor-default"
                      : activeTool === "studio" &&
                        studioState.activeTab === "relight"
                      ? "cursor-move"
                      : "cursor-crosshair"
                  )}
                />
              </motion.div>
            )}
          </div>

          {/* Empty State */}
          {files.length === 0 && !image && (
            <>
              <p className="relative z-20 font-sans font-bold text-neutral-700 dark:text-neutral-300 text-base">
                Upload file
              </p>
              <p className="relative z-20 font-sans font-normal text-neutral-400 dark:text-neutral-400 text-base mt-2">
                Drag or drop your files here or click to upload
              </p>
              <div className="relative w-full mt-10 max-w-xl mx-auto">
                <motion.div
                  variants={mainVariant}
                  className={cn(
                    "relative z-40 bg-white dark:bg-neutral-900 flex items-center justify-center h-32 mt-4 w-full max-w-[8rem] mx-auto rounded-md",
                    "shadow-[0px_10px_50px_rgba(0,0,0,0.1)]"
                  )}
                >
                  {isDragActive ? (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-neutral-600 flex flex-col items-center"
                    >
                      Drop it
                      <IconUpload className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                    </motion.p>
                  ) : (
                    <IconUpload className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                  )}
                </motion.div>
                <motion.div
                  variants={secondaryVariant}
                  className="absolute opacity-0 border border-dashed border-sky-400 inset-0 z-30 bg-transparent flex items-center justify-center h-32 mt-4 w-full max-w-[8rem] mx-auto rounded-md"
                ></motion.div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export function GridPattern() {
  const columns = 41;
  const rows = 11;
  return (
    <div className="flex bg-gray-100 dark:bg-neutral-900 shrink-0 flex-wrap justify-center items-center gap-x-px gap-y-px scale-105">
      {Array.from({ length: rows }).map((_, row) =>
        Array.from({ length: columns }).map((_, col) => (
          <div
            key={`${col}-${row}`}
            className={`w-10 h-10 flex shrink-0 rounded-[2px] ${
              (row * columns + col) % 2 === 0
                ? "bg-gray-50 dark:bg-neutral-950"
                : "bg-gray-50 dark:bg-neutral-950 shadow-[0px_0px_1px_3px_rgba(255,255,255,1)_inset] dark:shadow-[0px_0px_1px_3px_rgba(0,0,0,1)_inset]"
            }`}
          />
        ))
      )}
    </div>
  );
}
