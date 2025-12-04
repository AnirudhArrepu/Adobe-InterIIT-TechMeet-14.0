import HistoryComponent from "./components/history";
import { FileUpload } from "./components/ui/file-upload";
import { FloatingDock } from "./components/ui/floating-dock";
import { PromptBox } from "./components/ui/prompt";
import { useImage } from "./context/ImageContext";
import SAMButtonsComponent from "./components/EditTools/samTools";
import NeuralGradeTools from "./components/EditTools/NeuralGradeTools";
import GradingPreviews from "./components/EditTools/GradingPreviews";
import RemRelightComponent from "./components/EditTools/RemRelight";

export default function App() {
  const { setImage } = useImage();
  return (
    <div className="h-screen w-full flex bg-black">
      <div className="flex-1 flex flex-col relative">
        
        {/* <SAMButtonsComponent 
            onClear={() => console.log("Clear")}
            onRemoveLast={() => console.log("Remove")}
            onExport={() => console.log("Export")}
            onOCR={() => console.log("OCR")}
        /> */}
        <SAMButtonsComponent />
        <NeuralGradeTools />
        <GradingPreviews />
        <RemRelightComponent />

        {/* left uses remaining space */}
        <div className="flex-[4] bg-zinc-950 flex items-center justify-center">
          <FileUpload onChange={(file) => setImage(file)} />
        </div>
        <div className="flex-[2] bg-zinc-950 flex flex-col justify-center items-center gap-4">
          <FloatingDock />
          <PromptBox />
        </div>
      </div>

      <div className="w-72 h-full bg-zinc-700 flex-shrink-0">
        {" "}
        {/* fixed 256px */}
        <HistoryComponent fixedWidth={256} origWidth={200} origHeight={200} />
      </div>
    </div>
  );
}