import React from 'react';
import { ComicPanelData } from '../types';
import Spinner from './Spinner';

interface ComicPanelProps {
  panelData: ComicPanelData;
  imageUrl?: string;
  isLoading?: boolean;
  onGenerate: () => void;
}

const ComicPanel: React.FC<ComicPanelProps> = ({ panelData, imageUrl, isLoading, onGenerate }) => {
  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `SOP-Panel-${panelData.step}-${panelData.narration.substring(0, 20).replace(/\s/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-2xl flex flex-col">
      <div className="bg-indigo-600 text-white font-bold p-3 text-lg">
        Step {panelData.step}
      </div>
      <div className="p-4 flex-grow flex flex-col gap-4">
        <p className="bg-slate-100 p-3 rounded-md text-slate-700 italic border-l-4 border-slate-300">{panelData.narration}</p>
        <div className="aspect-square bg-slate-200 rounded-lg flex items-center justify-center overflow-hidden">
          {isLoading ? (
            <Spinner text="Generating art..." />
          ) : imageUrl ? (
            <img src={imageUrl} alt={`Comic panel for step ${panelData.step}`} className="w-full h-full object-cover" />
          ) : (
            <div className="text-center p-4">
              <p className="text-slate-500 mb-4">Click below to generate the visual for this step.</p>
              <button
                onClick={onGenerate}
                className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Generate Image
              </button>
            </div>
          )}
        </div>
        {imageUrl && !isLoading && (
          <div className="mt-2">
            <button
              onClick={handleDownload}
              className="w-full bg-teal-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-teal-600 transition-colors flex items-center justify-center gap-2"
              aria-label={`Download image for step ${panelData.step}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Download Panel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComicPanel;