import React, { useState, useCallback, useRef } from 'react';
import { ComicPanelData } from './types';
import { initializeAi, analyzeSop, generateImagePanel } from './services/geminiService';
import Header from './components/Header';
import Spinner from './components/Spinner';
import ComicPanel from './components/ComicPanel';

declare const mammoth: any;
declare const html2canvas: any;

type AppStep = 'API_KEY' | 'COMPANY_NAME' | 'UPLOAD_SOP' | 'GENERATE_PANELS' | 'VIEW_COMIC';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('API_KEY');
  const [apiKey, setApiKey] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [sopText, setSopText] = useState<string>('');
  const [panels, setPanels] = useState<ComicPanelData[]>([]);
  const [images, setImages] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [generatingImageId, setGeneratingImageId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const comicRef = useRef<HTMLDivElement>(null);

  const handleApiKeySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (apiKey.trim()) {
      try {
        initializeAi(apiKey);
        setStep('COMPANY_NAME');
        setError(null);
      } catch (err: any) {
        setError(err.message);
      }
    } else {
      setError("Please enter a valid API Key.");
    }
  };

  const handleCompanyNameSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (companyName.trim()) {
      setStep('UPLOAD_SOP');
      setError(null);
    } else {
      setError("Please enter a company name.");
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            setCompanyLogo(event.target?.result as string);
        };
        reader.readAsDataURL(file);
    } else {
        setCompanyLogo(null);
        e.target.value = '';
    }
  };

    const addImageOverlays = (
        baseImageUrl: string,
        companyName: string,
        logoUrl: string | null,
        workerDialog: string,
        characterDialog: string,
        step: number,
    ): Promise<string> => {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context'));
            }

            const baseImage = new Image();
            baseImage.crossOrigin = 'anonymous';

            baseImage.onload = () => {
                canvas.width = baseImage.width;
                canvas.height = baseImage.height;
                ctx.drawImage(baseImage, 0, 0);

                // --- Helper Functions (Robust Implementation) ---
                const calculateWrappedTextHeight = (context: CanvasRenderingContext2D, text: string, maxWidth: number, lineHeight: number): number => {
                    if (!text?.trim()) return 0;
                
                    const words = text.split(' ');
                    let line = '';
                    let lines = 1;
                
                    for (let n = 0; n < words.length; n++) {
                        const testLine = line + words[n] + ' ';
                        const metrics = context.measureText(testLine);
                        const testWidth = metrics.width;
                        
                        if (testWidth > maxWidth && n > 0) {
                            lines++;
                            line = words[n] + ' ';
                        } else {
                            line = testLine;
                        }
                    }
                    return lines * lineHeight;
                };

                const wrapText = (context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
                    const words = text.split(' ');
                    let line = '';
                    
                    for (let n = 0; n < words.length; n++) {
                        const testLine = line + words[n] + ' ';
                        const metrics = context.measureText(testLine);
                        const testWidth = metrics.width;
                        
                        if (testWidth > maxWidth && n > 0) {
                            context.fillText(line.trim(), x, y);
                            line = words[n] + ' ';
                            y += lineHeight;
                        } else {
                            line = testLine;
                        }
                    }
                    context.fillText(line.trim(), x, y);
                };

                const drawRoundedRect = (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
                    context.beginPath();
                    context.moveTo(x + radius, y);
                    context.lineTo(x + width - radius, y);
                    context.quadraticCurveTo(x + width, y, x + width, y + radius);
                    context.lineTo(x + width, y + height - radius);
                    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
                    context.lineTo(x + radius, y + height);
                    context.quadraticCurveTo(x, y + height, x, y + height - radius);
                    context.lineTo(x, y + radius);
                    context.quadraticCurveTo(x, y, x + radius, y);
                    context.closePath();
                    context.fill();
                };

                const calculateBoxHeight = (context: CanvasRenderingContext2D, text: string, maxWidth: number) => {
                    const padding = canvas.width * 0.02;
                    const titleFontSize = Math.max(canvas.width * 0.03, 20);
                    const textFontSize = Math.max(canvas.width * 0.025, 18);
                    const lineHeight = textFontSize * 1.2;
                    const titleBottomMargin = titleFontSize * 0.4;
                    
                    context.font = `${textFontSize}px sans-serif`;
                    const wrappedTextHeight = calculateWrappedTextHeight(context, text, maxWidth - padding * 2, lineHeight);
                    const textHeight = wrappedTextHeight > 0 ? titleBottomMargin + wrappedTextHeight : 0;
                    return padding * 2 + titleFontSize + textHeight;
                };

                const drawTextBox = (
                    context: CanvasRenderingContext2D,
                    title: string,
                    text: string,
                    x: number,
                    y: number,
                    width: number,
                    height: number,
                    bgColor: string,
                    titleColor: string,
                    textColor: string,
                ) => {
                    const padding = canvas.width * 0.02;
                    const titleFontSize = Math.max(canvas.width * 0.03, 20);
                    const textFontSize = Math.max(canvas.width * 0.025, 18);
                    const lineHeight = textFontSize * 1.2;
                    const titleBottomMargin = titleFontSize * 0.4;
                    const radius = 10;
                    
                    context.fillStyle = bgColor;
                    drawRoundedRect(context, x, y, width, height, radius);

                    context.fillStyle = titleColor;
                    context.font = `bold ${titleFontSize}px sans-serif`;
                    context.textBaseline = 'top';
                    context.fillText(title, x + padding, y + padding);

                    if (text?.trim()){
                        context.fillStyle = textColor;
                        context.font = `${textFontSize}px sans-serif`;
                        wrapText(context, text, x + padding, y + padding + titleFontSize + titleBottomMargin, width - padding * 2, lineHeight);
                    }
                };

                // --- Draw Step Bar (TOP) ---
                const stepBarHeight = Math.max(canvas.height * 0.09, 50);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(0, 0, canvas.width, stepBarHeight);

                ctx.fillStyle = 'white';
                const stepFontSize = Math.max(stepBarHeight * 0.5, 24);
                ctx.font = `bold ${stepFontSize}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`Langkah ${step}`, canvas.width / 2, stepBarHeight / 2);

                // --- Bottom Bar (for company info) ---
                const barHeight = Math.max(canvas.height * 0.08, 40);

                // --- Draw Dialogues (BOTTOM, above the company bar) ---
                const dialoguePadding = canvas.width * 0.03;
                const boxWidth = canvas.width / 2 - dialoguePadding * 1.5;

                if (workerDialog) {
                    const workerText = `"${workerDialog}"`;
                    const workerBoxHeight = calculateBoxHeight(ctx, workerText, boxWidth);
                    const workerY = canvas.height - barHeight - workerBoxHeight - dialoguePadding;
                    drawTextBox(ctx, 'Tips Pekerja:', workerText, dialoguePadding, workerY, boxWidth, workerBoxHeight, 'rgba(239, 246, 255, 0.9)', '#0c4a6e', '#1e3a8a');
                }
                if (characterDialog) {
                    const characterText = `"${characterDialog}"`;
                    const characterBoxHeight = calculateBoxHeight(ctx, characterText, boxWidth);
                    const characterY = canvas.height - barHeight - characterBoxHeight - dialoguePadding;
                    drawTextBox(ctx, 'Catatan Maskot:', characterText, canvas.width / 2 + dialoguePadding / 2, characterY, boxWidth, characterBoxHeight, 'rgba(254, 252, 232, 0.9)', '#713f12', '#78350f');
                }

                // --- Draw Bottom Bar (drawn last to be on top) ---
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

                ctx.fillStyle = 'white';
                const fontSize = Math.max(barHeight * 0.4, 16);
                ctx.font = `bold ${fontSize}px sans-serif`;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.fillText(companyName, canvas.width - 20, canvas.height - barHeight / 2);

                if (logoUrl) {
                    const logoImage = new Image();
                    logoImage.onload = () => {
                        const logoHeight = barHeight * 0.8;
                        const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
                        const logoY = canvas.height - barHeight + (barHeight - logoHeight) / 2;
                        ctx.drawImage(logoImage, 20, logoY, logoWidth, logoHeight);
                        resolve(canvas.toDataURL('image/png'));
                    };
                    logoImage.onerror = () => {
                        console.error("Logo image failed to load.");
                        resolve(canvas.toDataURL('image/png'));
                    };
                    logoImage.src = logoUrl;
                } else {
                    resolve(canvas.toDataURL('image/png'));
                }
            };

            baseImage.onerror = () => {
                reject(new Error('Base image failed to load for canvas processing.'));
            };
            baseImage.src = baseImageUrl;
        });
    };


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);
    setSopText('');
    setLoading(true);

    const reader = new FileReader();

    const docxType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    if (file.type === docxType) {
        reader.onload = async (event) => {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            if (arrayBuffer) {
                try {
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    setSopText(result.value);
                } catch (err) {
                    console.error("Error parsing .docx file:", err);
                    setError("Failed to parse the .docx file. It might be corrupted or in an unsupported format.");
                } finally {
                    setLoading(false);
                }
            }
        };
        reader.onerror = () => {
            setError("Failed to read the .docx file.");
            setLoading(false);
        };
        reader.readAsArrayBuffer(file);
    } else if (file.type === "text/plain") {
        reader.onload = (event) => {
            const text = event.target?.result as string;
            setSopText(text);
            setLoading(false);
        };
        reader.onerror = () => {
            setError("Failed to read the .txt file.");
            setLoading(false);
        };
        reader.readAsText(file);
    } else {
        setError(`Unsupported file type. Please upload a .txt or .docx file.`);
        setFileName('');
        setLoading(false);
    }
  };

  const handleAnalyzeSop = async () => {
    if (!sopText) {
      setError("Please upload and process an SOP document first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const analyzedPanels = await analyzeSop(sopText, companyName);
      setPanels(analyzedPanels);
      setStep('GENERATE_PANELS');
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred during analysis.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImage = useCallback(async (panel: ComicPanelData) => {
    setGeneratingImageId(panel.step);
    setError(null);
    try {
      const imageUrl = await generateImagePanel(panel.visualPrompt);
      const finalImageUrl = await addImageOverlays(
        imageUrl, 
        companyName, 
        companyLogo, 
        panel.workerDialog, 
        panel.characterDialog,
        panel.step
      );
      setImages(prev => ({ ...prev, [panel.step]: finalImageUrl }));
    } catch (err: any) {
      setError(`Failed to generate image for step ${panel.step}: ${err.message}`);
    } finally {
      setGeneratingImageId(null);
    }
  }, [companyName, companyLogo]);
  
  const handleDownload = async () => {
    if (!comicRef.current) return;
    setIsDownloading(true);
    setError(null);
    try {
      const canvas = await html2canvas(comicRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8fafc',
      });
      const image = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.href = image;
      link.download = `SOP-Comic-${companyName.replace(/\s+/g, '-')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to download comic:", err);
      setError("Sorry, there was an issue creating the download file.");
    } finally {
      setIsDownloading(false);
    }
  };

  const resetState = () => {
    setStep('API_KEY');
    setApiKey('');
    setCompanyName('');
    setSopText('');
    setPanels([]);
    setImages({});
    setLoading(false);
    setGeneratingImageId(null);
    setError(null);
    setFileName('');
    setCompanyLogo(null);
  };

  const renderContent = () => {
    switch (step) {
      case 'API_KEY':
        return (
          <div className="w-full max-w-md">
            <h2 className="text-2xl font-bold text-center mb-1">Enter Your API Key</h2>
            <p className="text-slate-600 text-center mb-6">Please provide your Google Gemini API Key to continue.</p>
            <form onSubmit={handleApiKeySubmit} className="bg-white p-8 rounded-xl shadow-lg space-y-6">
              <div>
                <label htmlFor="api-key" className="block text-sm font-medium text-slate-700 mb-1">Gemini API Key</label>
                <input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API Key"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors">
                Save and Continue
              </button>
            </form>
          </div>
        );
      case 'COMPANY_NAME':
        return (
          <div className="w-full max-w-md">
            <h2 className="text-2xl font-bold text-center mb-1">Welcome!</h2>
            <p className="text-slate-600 text-center mb-6">Let's start by entering your company's name.</p>
            <form onSubmit={handleCompanyNameSubmit} className="bg-white p-8 rounded-xl shadow-lg space-y-6">
              <div>
                <label htmlFor="company-name" className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                <input
                  id="company-name"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Enter Company Name"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Logo (Optional)</label>
                <div className="mt-1 flex items-center space-x-4">
                  {companyLogo && <img src={companyLogo} alt="Company logo preview" className="h-12 w-12 object-contain rounded-md bg-slate-100 p-1"/>}
                  <label htmlFor="company-logo-input" className="relative flex-grow cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                    <span className="flex justify-center items-center w-full px-4 py-3 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">
                      Choose File
                    </span>
                    <input id="company-logo-input" name="company-logo" type="file" className="sr-only" accept="image/png, image/jpeg" onChange={handleLogoChange} />
                  </label>
                </div>
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors">
                Continue
              </button>
            </form>
          </div>
        );
      case 'UPLOAD_SOP':
        return (
          <div className="w-full max-w-lg">
            <h2 className="text-2xl font-bold text-center mb-1">Upload SOP Document</h2>
            <p className="text-slate-600 text-center mb-6">Upload a document (.txt or .docx) containing the SOP.</p>
            <div className="bg-white p-8 rounded-xl shadow-lg space-y-6">
                <div className="relative border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-indigo-500 transition-colors">
                  <input
                    type="file"
                    accept=".txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="text-indigo-500">
                      <svg className="mx-auto h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {fileName ? `Selected: ${fileName}` : "Click to upload a document"}
                  </p>
                </div>

              <button
                onClick={handleAnalyzeSop}
                disabled={!sopText || loading}
                className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {loading ? <Spinner size="6" text={fileName ? 'Processing Document...' : ''}/> : 'Analyze SOP'}
              </button>
            </div>
          </div>
        );
      case 'GENERATE_PANELS':
        return (
          <div className="w-full">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold">Generate Comic Panels</h2>
              <p className="text-slate-600 mt-2">Click 'Generate Image' on each panel. The AI will create a visual based on the SOP step.</p>
              {Object.keys(images).length === panels.length && panels.length > 0 && (
                 <button onClick={() => setStep('VIEW_COMIC')} className="mt-4 bg-green-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-600 transition-colors">
                    View Full Comic Strip
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
              {panels.map(panel => (
                <ComicPanel
                  key={panel.step}
                  panelData={panel}
                  imageUrl={images[panel.step]}
                  isLoading={generatingImageId === panel.step}
                  onGenerate={() => handleGenerateImage(panel)}
                />
              ))}
            </div>
          </div>
        );
        case 'VIEW_COMIC':
          return (
             <div className="w-full">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold">Your SOP Comic Strip for {companyName}</h2>
                  <p className="text-slate-600 mt-2">Here is the complete visual guide for your procedure. You can now save or print this page.</p>
                   <button onClick={resetState} className="mt-4 mx-2 bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-colors">
                        Start Over
                    </button>
                    <button 
                        onClick={handleDownload} 
                        disabled={isDownloading}
                        className="mt-4 mx-2 bg-teal-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-teal-600 transition-colors disabled:bg-slate-400 flex-none inline-flex items-center justify-center"
                    >
                      {isDownloading ? <Spinner size="5" /> : 'Download as Image'}
                    </button>
                </div>
                <div className="space-y-8" ref={comicRef}>
                    {panels.sort((a,b) => a.step - b.step).map(panel => (
                        <div key={panel.step} className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col md:flex-row items-stretch">
                            <div className="md:w-1/3 bg-indigo-700 text-white flex flex-col items-center justify-center p-6">
                                <span className="text-6xl font-black">{panel.step}</span>
                                <span className="text-xl font-bold">STEP</span>
                            </div>
                            <div className="md:w-2/3 flex flex-col lg:flex-row">
                                <div className="lg:w-1/2 p-4 aspect-square">
                                     <img src={images[panel.step]} alt={`Comic panel for step ${panel.step}`} className="w-full h-full object-cover rounded-lg shadow-md" />
                                </div>
                                <div className="lg:w-1/2 p-4 flex flex-col justify-center space-y-4">
                                    <p className="bg-slate-100 p-3 rounded-md text-slate-700 italic border-l-4 border-slate-300">{panel.narration}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
             </div>
          );
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-6 py-12 flex flex-col items-center justify-center">
        {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 w-full max-w-2xl rounded-r-lg" role="alert">
              <p className="font-bold">Error</p>
              <p>{error}</p>
            </div>
        )}
        {renderContent()}
      </main>
      <footer className="text-center py-4 text-sm text-slate-500">
        Powered by React, Tailwind, and Gemini AI
      </footer>
    </div>
  );
};

export default App;