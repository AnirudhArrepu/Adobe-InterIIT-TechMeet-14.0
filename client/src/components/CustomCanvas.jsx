import React, { useRef, useEffect, useState } from 'react';
import { useImage } from '../context/ImageContext';

const API_URL = "http://localhost:5000/sam";

const SAMCanvas = ({ imageFile }) => {
  const canvasRef = useRef(null);
  const { sessionId, samState, setSamState, setIsProcessing } = useImage();
  const [imageObj, setImageObj] = useState(null);

  // 1. Load Image
  useEffect(() => {
    if (!imageFile) return;
    const img = new Image();
    img.src = URL.createObjectURL(imageFile);
    img.onload = () => setImageObj(img);
  }, [imageFile]);

  // 2. Draw
  useEffect(() => {
    if (!canvasRef.current || !imageObj) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Internal resolution = Actual Image Resolution
    canvas.width = imageObj.width;
    canvas.height = imageObj.height;

    // Draw Base Image
    ctx.drawImage(imageObj, 0, 0);

    // Draw Merged Boxes (Red)
    if (samState.merged_bboxes) {
        ctx.strokeStyle = '#ef4444'; 
        ctx.lineWidth = Math.max(2, imageObj.width / 300); // Scale line width
        samState.merged_bboxes.forEach(bbox => {
            ctx.strokeRect(bbox.x1, bbox.y1, bbox.x2 - bbox.x1, bbox.y2 - bbox.y1);
        });
    }

    // Draw Points (Green)
    if (samState.points) {
        ctx.fillStyle = '#10b981'; 
        const pointRadius = Math.max(3, imageObj.width / 200); // Scale point size
        samState.points.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, pointRadius, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // Draw OCR (Blue)
    if (samState.ocr_results) {
        samState.ocr_results.forEach(result => {
            const [x1, y1, x2, y2] = result.crop_coord;
            ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
            ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = Math.max(1, imageObj.width / 400);
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        });
    }

  }, [imageObj, samState]);

  // 3. Handle Click (Coordinate Mapping)
  const handleCanvasClick = async (e) => {
    if (!sessionId || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Map CSS pixels (screen) to Canvas pixels (internal resolution)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    setIsProcessing(true);
    try {
        const response = await fetch(`${API_URL}/add_point`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, point: { x, y } })
        });
        const data = await response.json();
        setSamState(data);
    } catch (error) { console.error(error); } 
    finally { setIsProcessing(false); }
  };

  // STRICTLY mimicking the original <img> styles
  return (
    <canvas 
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="w-full h-auto max-h-[400px] object-contain rounded-md cursor-crosshair"
    />
  );
};

export default SAMCanvas;