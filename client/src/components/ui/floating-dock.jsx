/**
 * Note: Use position fixed according to your needs
 * Desktop navbar is better positioned at the bottom
 * Mobile navbar is better positioned at bottom right.
 **/

import { cn } from "../../lib/utils";
import { IconLayoutNavbarCollapse, IconAlertTriangle, IconTrash, IconCheck } from "@tabler/icons-react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import {
  IconBrandGithub,
  IconBrandX,
  IconExchange,
  IconHome,
  IconNewSection,
  IconTerminal2,
} from "@tabler/icons-react";

import { useRef, useState } from "react";
import { useImage } from "../../context/ImageContext"; // 1. Import Context

export const FloatingDock = ({
  items: propsItems, // Renamed to avoid confusion, we will generate our own items
  desktopClassName,
  mobileClassName,
}) => {
  const { 
    activeTool, setActiveTool, 
    sessionId, setSessionId, setSamState,
    previewImage, setPreviewImage, commitImage,
    studioState, setStudioState, setGradingState
  } = useImage();

  const [pendingTool, setPendingTool] = useState(null);
  const [showWarning, setShowWarning] = useState(false);

  // --- Dirty Check Logic ---
  const isDirty = () => {
    // SAM: Active session
    if (activeTool === 'sam' && sessionId) return true;
    // Grade: Generated preview
    if (activeTool === 'grade' && previewImage) return true;
    // Studio: Generated preview OR intermediate inpaint result
    if (activeTool === 'studio' && (previewImage || studioState.inpaintedImage)) return true;
    return false;
  };

  const requestSwitch = (tool) => {
    if (activeTool === tool) return;
    
    if (activeTool !== 'none' && isDirty()) {
      setPendingTool(tool);
      setShowWarning(true);
    } else {
      setActiveTool(tool);
    }
  };

  const resetTools = () => {
    setSessionId(null);
    setSamState({ points: [], bboxes: [], merged_bboxes: [], ocr_results: [] });
    setPreviewImage(null);
    setGradingState(prev => ({ ...prev, results: [], selectedEmotion: null, isGrading: false }));
    setStudioState({
        activeTab: 'inpaint', inpaintedImage: null, inpaintCoords: null, isInpainting: false,
        relightParams: { az: 45, el: 30, intensity: 1.0, ambient: 0.2, cone: 8, exponent: 80 }, isRelighting: false
    });
  };

  const handleDiscard = () => {
    resetTools();
    setActiveTool(pendingTool);
    setShowWarning(false);
    setPendingTool(null);
  };

  const handleApply = async () => {
    // 1. Commit Preview if exists
    if (previewImage) {
        try {
            const res = await fetch(previewImage, { headers: { "ngrok-skip-browser-warning": "true" } });
            const blob = await res.blob();
            const file = new File([blob], "edited.png", { type: "image/png" });
            commitImage(file);
        } catch (e) { console.error(e); }
    } 
    // 2. Commit Intermediate Studio state (e.g. removed object but didn't relight)
    else if (activeTool === 'studio' && studioState.inpaintedImage) {
        commitImage(studioState.inpaintedImage);
    }
    
    // 3. Then Discard/Reset to clear the session and switch
    handleDiscard();
  };

  // --- Navigation Links ---
  const links = [
    {
      title: "SAM Tool",
      icon: <IconHome className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
      href: "#",
      onClick: () => requestSwitch("sam"),
    },
    {
      title: "Neural Grade",
      icon: <IconTerminal2 className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
      href: "#",
      onClick: () => requestSwitch("grade"),
    },
    {
      title: "Studio (Relight)",
      icon: <IconNewSection className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
      href: "#",
      onClick: () => requestSwitch("studio"), // 3rd Button -> Studio
    },
    {
      title: "Aceternity UI",
      icon: (
        <img
          src="https://assets.aceternity.com/logo-dark.png"
          width={20}
          height={20}
          alt="Aceternity Logo"
        />
      ),
      href: "#",
    },
    {
      title: "Changelog",
      icon: <IconExchange className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
      href: "#",
    },
    {
      title: "Twitter",
      icon: <IconBrandX className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
      href: "#",
    },
    {
      title: "GitHub",
      icon: <IconBrandGithub className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
      href: "#",
    },
  ];

  return (
    <>
      <FloatingDockDesktop items={links} className={desktopClassName} />
      <FloatingDockMobile items={links} className={mobileClassName} />
      
      {/* --- WARNING POPUP --- */}
      <AnimatePresence>
        {showWarning && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-zinc-950 border border-zinc-800 p-6 rounded-xl shadow-2xl w-80 max-w-full"
                >
                    <div className="flex flex-col items-center text-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                            <IconAlertTriangle className="text-yellow-500 w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-zinc-100 font-semibold text-sm">Unsaved Changes</h3>
                            <p className="text-zinc-500 text-xs mt-1">
                                You have unsaved work in the current tool. Do you want to apply these changes or discard them?
                            </p>
                        </div>
                        
                        <div className="flex gap-2 w-full mt-2">
                            <button 
                                onClick={handleDiscard}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 text-xs font-medium rounded-lg transition-colors"
                            >
                                <IconTrash size={14} />
                                Discard
                            </button>
                            <button 
                                onClick={handleApply}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-emerald-900/20"
                            >
                                <IconCheck size={14} />
                                Apply
                            </button>
                        </div>
                        <button 
                            onClick={() => setShowWarning(false)}
                            className="text-[10px] text-zinc-600 hover:text-zinc-400 mt-1"
                        >
                            Cancel and stay
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </>
  );
};

const FloatingDockMobile = ({ items, className }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("relative block md:hidden", className)}>
      <AnimatePresence>
        {open && (
          <motion.div
            layoutId="nav"
            className="absolute inset-x-0 bottom-full mb-2 flex flex-col gap-2"
          >
            {items.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10, transition: { delay: idx * 0.05 } }}
                transition={{ delay: (items.length - 1 - idx) * 0.05 }}
              >
                <button
                  onClick={item.onClick}
                  key={item.title}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 dark:bg-neutral-900 border-none cursor-pointer"
                >
                  <div className="h-4 w-4">{item.icon}</div>
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 dark:bg-neutral-800"
      >
        <IconLayoutNavbarCollapse className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
      </button>
    </div>
  );
};

const FloatingDockDesktop = ({ items, className }) => {
  let mouseX = useMotionValue(Infinity);
  // Removed internal links array definition to respect props
  
  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={cn(
        "mx-auto hidden h-16 items-end gap-4 rounded-2xl bg-gray-50 px-4 pb-3 md:flex dark:bg-zinc-900",
        className
      )}
    >
      {items.map((item) => (
        <IconContainer mouseX={mouseX} key={item.title} {...item} />
      ))}
    </motion.div>
  );
};

function IconContainer({ mouseX, title, icon, href, onClick }) {
  let ref = useRef(null);

  let distance = useTransform(mouseX, (val) => {
    let bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  let widthTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40]);
  let heightTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40]);
  let widthTransformIcon = useTransform(distance, [-150, 0, 150], [20, 40, 20]);
  let heightTransformIcon = useTransform(distance, [-150, 0, 150], [20, 40, 20]);

  let width = useSpring(widthTransform, { mass: 0.1, stiffness: 150, damping: 12 });
  let height = useSpring(heightTransform, { mass: 0.1, stiffness: 150, damping: 12 });
  let widthIcon = useSpring(widthTransformIcon, { mass: 0.1, stiffness: 150, damping: 12 });
  let heightIcon = useSpring(heightTransformIcon, { mass: 0.1, stiffness: 150, damping: 12 });

  const [hovered, setHovered] = useState(false);

  return (
    <button onClick={onClick} className="focus:outline-none bg-transparent border-none cursor-pointer p-0">
      <motion.div
        ref={ref}
        style={{ width, height }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative flex aspect-square items-center justify-center rounded-full bg-gray-200 dark:bg-neutral-800"
      >
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 10, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 2, x: "-50%" }}
              className="absolute -top-8 left-1/2 w-fit rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs whitespace-pre text-neutral-700 dark:border-neutral-900 dark:bg-neutral-800 dark:text-white"
            >
              {title}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div style={{ width: widthIcon, height: heightIcon }} className="flex items-center justify-center">
          {icon}
        </motion.div>
      </motion.div>
    </button>
  );
}