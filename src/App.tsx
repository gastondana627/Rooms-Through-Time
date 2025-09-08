/* src/App.tsx */
import React, { useState, useRef, useEffect } from 'react';
// ✅ UPDATED: Add the new getDesignerQuote function
import { segment, recolor, reconstruct, generateVoiceover, generateFalImage, redesignFalImage, getDesignerQuote } from './api';

const App: React.FC = () => {
  // --- STATE ---
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<'generate' | 'redesign'>('generate');
  const [selectedCategory, setSelectedCategory] = useState<string>('Modern');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [segments, setSegments] = useState<any[] | null>(null);
  const [reconstructionUrl, setReconstructionUrl] = useState<string | null>(null);
  const [modelInfo, setModelInfo] = useState<any>(null);
  const [showModelDetails, setShowModelDetails] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(false);
  
  // ✅ NEW: Add state to hold the designer quote
  const [quote, setQuote] = useState<string | null>(null);

  // --- REFS & CONSTANTS ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const categories = ['Modern', 'Minimalist', 'Bohemian', 'Coastal', 'Industrial', 'Farmhouse'];

  // --- EFFECTS ---
  
  // Camera Effect
  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      if (isCameraActive && videoRef.current) {
        setError(null);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
          const video = videoRef.current;
          requestAnimationFrame(() => {
            if (video) {
              video.srcObject = stream;
              video.onloadedmetadata = () => { video.play().catch(err => { console.error('Video play failed:', err); setError('Could not start camera feed.'); }); };
            }
          });
        } catch (err: any) {
          console.error('Camera access error:', err.name, err.message);
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') { setError('Camera access was denied.'); }
          else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') { setError('Camera is already in use by another app.'); }
          else { setError('Could not access camera.'); }
          setIsCameraActive(false);
        }
      }
    };
    startCamera();
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, [isCameraActive]);

  // ✅ NEW: Quote Fetcher Effect
  useEffect(() => {
    if (loading) {
      setQuote(null); // Reset previous quote
      getDesignerQuote()
        .then(data => setQuote(data.quote))
        .catch(err => {
          console.error("Failed to fetch quote:", err);
          setQuote("Design is thinking made visual."); // Fallback quote
        });
    }
  }, [loading]);


  // --- HELPERS ---
  const stopCamera = () => setIsCameraActive(false);

  const resetStateForNewImage = () => {
    setImageUrl(null);
    setCapturedImage(null);
    setSegments(null);
    setReconstructionUrl(null);
    setModelInfo(null);
    setAudioUrl(null);
  };
  
  // --- HANDLERS ---
  const handleGenerateImage = async () => {
    setLoading(true);
    setError(null);
    resetStateForNewImage();
    try {
      const prompt = `A high-resolution, photorealistic image of a ${selectedCategory} style room.`;
      const result = await generateFalImage({ prompt });
      setImageUrl(result.image_url);
    } catch (err) {
      console.error(err);
      setError('Failed to generate image from backend.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleStartCamera = () => {
    setError(null);
    resetStateForNewImage();
    setIsCameraActive(true);
  };
  
  const handleTakePicture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const handleRedesignImage = async () => {
    if (!capturedImage) { setError('Please capture an image first.'); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await redesignFalImage({
        image_url: capturedImage,
        prompt: `Give me a concise description (max 30 words) of how this room would look after being redesigned in a ${selectedCategory} style.`
      });
      setImageUrl(result.image_url);
    } catch (err) { 
      console.error(err); 
      setError('Failed to redesign image.'); 
    } finally { 
      setLoading(false); 
      setCapturedImage(null); 
    }
  };

  const switchMode = (m: 'generate' | 'redesign') => {
    setMode(m);
    setError(null);
    resetStateForNewImage();
    stopCamera();
  };

  const dataUrlToFile = async (dataUrl: string, fileName: string): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], fileName, { type: blob.type });
  };

  const handleSaveImage = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `ai-room-${selectedCategory.toLowerCase()}.jpeg`;
    link.click();
  };

  const handleShareImage = async () => {
    if (!imageUrl || !navigator.share) { alert('Web Share not supported.'); return; }
    try {
      const file = await dataUrlToFile(imageUrl, `ai-room-${selectedCategory}.jpeg`);
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'AI Room Design', text: `Check out this ${selectedCategory} room!`, files: [file] });
      }
    } catch (err) { console.error('Share error:', err); }
  };

  const handleSegmentImage = async () => {
    if (!imageUrl) return;
    setLoading(true); setError(null); setSegments(null);
    try {
      const result = await segment({ image_url: imageUrl });
      setSegments(result.masks);
    } catch (err) { console.error(err); setError('Segmentation failed.');
    } finally { setLoading(false); }
  };

  const handleRecolorObject = async (segment: any) => {
    if (!imageUrl) return;
    setLoading(true); setError(null);
    try {
      // The recolor logic is client-side, so it needs to be handled differently
      // This is a placeholder for now as the `recolor` function in api.ts is a simple proxy
      // For a real implementation, this would involve more complex client-side logic or a dedicated backend endpoint
      console.log("Recoloring is a placeholder.", segment);
    } catch (err) { console.error(err); setError('Recolor failed.');
    } finally { setLoading(false); }
  };

  const handleReconstructImage = async () => {
    if (!imageUrl) { setError('Please generate or capture an image first.'); return; }
    setLoading(true); setError(null); setReconstructionUrl(null); setModelInfo(null);
    try {
      const result = await reconstruct({ image_url: imageUrl });
      setReconstructionUrl(result.reconstruction_url);
      setModelInfo(result.model_info);
    } catch (err) { console.error('Reconstruct error:', err); setError('3D reconstruction failed.');
    } finally { setLoading(false); }
  };
  
  const handleGenerateAudio = async () => {
    if (!imageUrl) return;
    setIsAudioLoading(true);
    setError(null);
    try {
        const audioData = await generateVoiceover({ image_url: imageUrl, style: selectedCategory });
        setAudioUrl(audioData.voiceover_url + `?t=${new Date().getTime()}`);
    } catch (err) {
        console.error("Audio generation failed:", err);
        setError("Failed to generate audio description.");
    } finally {
        setIsAudioLoading(false);
    }
  };

  const handleDownloadGLB = () => {
    if (modelInfo?.direct_download) {
      const link = document.createElement('a');
      link.href = modelInfo.direct_download;
      link.download = `room-3d-model.glb`;
      link.target = '_blank';
      link.click();
    }
  };

  const handleOpenGLB = () => {
    if (modelInfo?.direct_download) {
      window.open(modelInfo.direct_download, '_blank');
    }
  };

  const handleCopyGLBUrl = () => {
    if (modelInfo?.direct_download) {
      navigator.clipboard.writeText(modelInfo.direct_download);
      alert('GLB URL copied to clipboard!');
    }
  };

  // --- RENDER LOGIC ---
  const renderContent = () => {
    // ✅ UPDATED: The loading state now displays the quote
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-white">
          <svg className="animate-spin h-10 w-10 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <p className="mt-4 text-lg">Processing…</p>
          {quote && (
            <p className="mt-4 text-sm text-gray-400 italic text-center max-w-xs">
              "{quote}"
            </p>
          )}
        </div>
      );
    }
    if (reconstructionUrl) { return ( <model-viewer src={reconstructionUrl} alt="3D Room Reconstruction" camera-controls auto-rotate style={{ width: '100%', height: '100%' }} onError={e => { console.error('model-viewer load error:', e); setError('Unable to load the 3‑D model.'); setReconstructionUrl(null); }} /> ); }
    if (imageUrl && segments) { return ( <div className="relative w-full h-full"><img src={imageUrl} className="w-full h-full object-contain" alt="Room for editing"/>{segments.map((s, i) => ( <div key={i} onClick={() => handleRecolorObject(s)} style={{ WebkitMaskImage: `url(${s.mask})`, maskImage: `url(${s.mask})`, backgroundColor: 'rgba(139, 92, 246, 0.7)', }} className="absolute inset-0 opacity-80 hover:opacity-100 transition-opacity cursor-pointer" /> ))}</div> ); }
    if (isCameraActive) return ( <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" /> );
    if (imageUrl) return <img src={imageUrl} className="w-full h-full object-contain" alt="Generated or redesigned room"/>;
    if (capturedImage) return <img src={capturedImage} className="w-full h-full object-contain" alt="User's room for redesign"/>;
    return ( <div className="flex items-center justify-center h-full text-gray-400">Your image will appear here</div> );
  };

  const renderActionButton = () => {
    if (mode === 'generate') { return ( <button onClick={handleGenerateImage} disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg disabled:bg-indigo-800 disabled:cursor-not-allowed">Generate Image</button> ); }
    if (mode === 'redesign') {
      if (isCameraActive) { return ( <button onClick={handleTakePicture} className="w-full bg-red-600 text-white font-bold py-3 px-4 rounded-lg">Take Picture</button> ); }
      if (capturedImage) { return ( <button onClick={handleRedesignImage} disabled={loading} className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg disabled:bg-green-800 disabled:cursor-not-allowed">Redesign Image</button> ); }
      return ( <button onClick={handleStartCamera} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg">Scan My Room</button> );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 font-sans">
      <header className="w-full max-w-5xl text-center mb-6">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">AI Room Designer</h1>
        <p className="text-gray-400 mt-2">Create or reimagine your perfect space with AI.</p>
      </header>
      <main className="w-full max-w-5xl flex-1 flex flex-col bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <div className="flex bg-gray-900 rounded-lg p-1 space-x-1 mb-6">
            <button onClick={() => switchMode('generate')} className={`w-1/2 py-2.5 rounded-lg transition-colors ${ mode === 'generate' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700' }`}>Generate New</button>
            <button onClick={() => switchMode('redesign')} className={`w-1/2 py-2.5 rounded-lg transition-colors ${ mode === 'redesign' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700' }`} >Redesign My Room</button>
          </div>
          <h2 className="text-xl mb-3 text-gray-200">Choose a Style</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {categories.map(c => ( <button key={c} onClick={() => setSelectedCategory(c)} className={`px-4 py-2 rounded-lg transition-colors ${ selectedCategory === c ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600' }`} >{c}</button>))}
          </div>
        </div>
        <div className="flex-1 bg-gray-900 p-2 min-h-[400px] md:min-h-[500px]">
          <div className="bg-black w-full h-full rounded-lg flex items-center justify-center relative">
            {renderContent()}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>
        {error && (<div className="p-4 bg-red-900 text-red-200 text-center">{error}</div>)}
        <footer className="p-6 border-t border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="flex justify-center md:justify-start space-x-3 order-3 md:order-1 mt-4 md:mt-0">
              {imageUrl && !reconstructionUrl && (
                <>
                  <button onClick={handleSaveImage} className="bg-gray-700 hover:bg-gray-600 py-2 px-4 rounded-lg transition-colors">Save</button>
                  {navigator.share && (<button onClick={handleShareImage} className="bg-gray-700 hover:bg-gray-600 py-2 px-4 rounded-lg transition-colors">Share</button>)}
                </>
              )}
            </div>
            <div className="order-1 md:order-2">{renderActionButton()}</div>
            <div className="flex justify-center md:justify-end space-x-3 flex-wrap gap-2 order-2 md:order-3">
              {imageUrl && !reconstructionUrl && (
                <>
                  <button onClick={handleSegmentImage} className="bg-pink-600 hover:bg-pink-700 py-2 px-4 rounded-lg transition-colors">Magic Edit</button>
                  <button onClick={handleReconstructImage} className="bg-yellow-600 hover:bg-yellow-700 py-2 px-4 rounded-lg transition-colors">Reconstruct in 3D</button>
                  {!audioUrl && (
                    <button onClick={handleGenerateAudio} disabled={isAudioLoading} className="bg-cyan-600 hover:bg-cyan-700 py-2 px-4 rounded-lg disabled:bg-cyan-800 disabled:cursor-not-allowed transition-colors">
                      {isAudioLoading ? 'Describing...' : 'Describe Room'}
                    </button>
                  )}
                  {audioUrl && (
                    <button onClick={() => new Audio(audioUrl).play()} className="bg-green-600 hover:bg-green-700 py-2 px-4 rounded-lg transition-colors">
                      ▶️ Play Description
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          {reconstructionUrl && modelInfo && (
             <div className="mt-6 p-4 bg-gray-900 rounded-lg border border-gray-700">
               <div className="flex items-center justify-between mb-3">
                 <h3 className="text-lg font-semibold text-white">3D Model Ready</h3>
                 <button onClick={() => { setReconstructionUrl(null); setModelInfo(null); }} className="text-gray-400 hover:text-white">Close</button>
               </div>
               <div className="flex flex-wrap gap-3 mb-3">
                 <button onClick={handleDownloadGLB} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg">Download GLB</button>
                 <button onClick={handleOpenGLB} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">Open in New Tab</button>
                 <button onClick={handleCopyGLBUrl} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg">Copy URL</button>
               </div>
             </div>
           )}
        </footer>
      </main>
    </div>
  );
};

export default App;