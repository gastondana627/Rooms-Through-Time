/* src/App.tsx */
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import * as fal from '@fal-ai/serverless-client';
import { segment, recolor, reconstruct } from './api';


/* --------------------------------------------------------------
   Do **NOT** import '@google/model-viewer' – the component is loaded
   from the <script> tag in index.html.  The TypeScript declaration
   lives in src/model-viewer.d.ts, so the JSX tag is recognised.
-------------------------------------------------------------- */

const API_KEY = import.meta.env.VITE_GOOGLE_AI_API_KEY;

/* ==============================================================
   MAIN COMPONENT
   ============================================================== */
const App: React.FC = () => {
  // -------------------------- STATE --------------------------
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const categories = [
    'Modern',
    'Minimalist',
    'Bohemian',
    'Coastal',
    'Industrial',
    'Farmhouse',
  ];

  // -------------------------- CAMERA HOOK --------------------------
  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      if (isCameraActive && videoRef.current) {
        setError(null);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false,
          });
          const video = videoRef.current;
          requestAnimationFrame(() => {
            if (video) {
              video.srcObject = stream;
              video.onloadedmetadata = () => {
                video
                  .play()
                  .catch(err => {
                    console.error('Video play failed:', err);
                    setError('Could not start camera feed.');
                  });
              };
            }
          });
        } catch (err: any) {
          console.error('Camera access error:', err.name, err.message);
          if (
            err.name === 'NotAllowedError' ||
            err.name === 'PermissionDeniedError'
          ) {
            setError('Camera access was denied.');
          } else if (
            err.name === 'NotReadableError' ||
            err.name === 'TrackStartError'
          ) {
            setError('Camera is already in use by another app.');
          } else {
            setError('Could not access camera.');
          }
          setIsCameraActive(false);
        }
      }
    };
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [isCameraActive]);

  const stopCamera = () => setIsCameraActive(false);

  // -------------------------- HELPERS --------------------------
  const parseDataUrl = (dataUrl: string) => {
    const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return null;
    return { mimeType: match[1], data: match[2] };
  };

  // -------------------------- AI HANDLERS --------------------------

  /** ------------ Generate a fresh image (Imagen) ------------ */
  const handleGenerateImage = async () => {
    setLoading(true);
    setError(null);
    setImageUrl(null);
    setCapturedImage(null);
    setSegments(null);
    setReconstructionUrl(null);
    setModelInfo(null);
    try {
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: `A high‑resolution, photorealistic image of a ${selectedCategory} style room.`,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '16:9',
        },
      });
      if (response.generatedImages?.[0]?.image?.imageBytes) {
        const base64Image = response.generatedImages[0].image.imageBytes;
        setImageUrl(`data:image/jpeg;base64,${base64Image}`);
      } else {
        throw new Error('No image was generated.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to generate image.');
    } finally {
      setLoading(false);
    }
  };

  /** ------------ Camera controls ------------ */
  const handleStartCamera = () => {
    setError(null);
    setCapturedImage(null);
    setImageUrl(null);
    setSegments(null);
    setReconstructionUrl(null);
    setModelInfo(null);
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

  /** ------------ Redesign (Gemini → Imagen) ------------ */
  const handleRedesignImage = async () => {
    if (!capturedImage) {
      setError('Please capture an image first.');
      return;
    }
    setLoading(true);
    setError(null);
    setImageUrl(null);
    setReconstructionUrl(null);
    setModelInfo(null);

    const parsed = parseDataUrl(capturedImage);
    if (!parsed) {
      setError('Invalid image format.');
      setLoading(false);
      return;
    }

    try {
      /* ---- Gemini: vision input, **text‑only** output ---- */
      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: parsed.data,
                  mimeType: 'image/jpeg',
                },
              },
              {
                text: `Give me a concise description (max 30 words) of how this room would look after being redesigned in a ${selectedCategory} style.`,
              },
            ],
          },
        ],
        config: { responseModalities: [Modality.TEXT] },
      });

      const textPart = geminiResponse.candidates?.[0]?.content?.parts?.find(
        (p: any) => p.text,
      );
      if (!textPart?.text) {
        throw new Error('Gemini did not return a redesign description.');
      }
      const redesignPrompt = textPart.text.trim();
      console.log('🔎 Gemini redesign prompt:', redesignPrompt);

      /* ---- Imagen: generate the new image from the prompt ---- */
      const imagenResponse = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: redesignPrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '16:9',
        },
      });

      if (imagenResponse.generatedImages?.[0]?.image?.imageBytes) {
        const base64Image = imagenResponse.generatedImages[0].image.imageBytes;
        setImageUrl(`data:image/jpeg;base64,${base64Image}`);
      } else {
        throw new Error('Imagen failed to generate a redesign image.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to image.');
    } finally {
      setLoading(false);
      setCapturedImage(null);
    }
  };

  /** ------------ Mode switch ------------ */
  const switchMode = (m: 'generate' | 'redesign') => {
    setMode(m);
    setError(null);
    setImageUrl(null);
    setCapturedImage(null);
    setSegments(null);
    setReconstructionUrl(null);
    setModelInfo(null);
    stopCamera();
  };

  /** ------------ Utility for sharing / saving ------------ */
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
    if (!imageUrl || !navigator.share) {
      alert('Web Share not supported.');
      return;
    }
    try {
      const file = await dataUrlToFile(imageUrl, `ai-room-${selectedCategory}.jpeg`);
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'AI Room Design',
          text: `Check out this ${selectedCategory} room!`,
          files: [file],
        });
      }
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  /** ------------ Segmentation (using api.ts) ------------ */
  const handleSegmentImage = async () => {
    if (!imageUrl) return;
    setLoading(true);
    setError(null);
    setSegments(null);
    try {
      // ✅ CHANGED: Pass data as an object
      const result = await segment({ image_url: imageUrl });
      setSegments(result.segments);
    } catch (err) {
      console.error(err);
      setError('Segmentation failed.');
    } finally {
      setLoading(false);
    }
  };

  /** ------------ Recolour (using api.ts) ------------ */
  const handleRecolorObject = async (segment: any) => {
    if (!imageUrl) return;
    setLoading(true);
    setError(null);
    try {
      // ✅ CHANGED: Pass data as an object
      const result = await recolor({
        image_url: imageUrl,
        mask: segment,
        color: [139, 92, 246],
      });
      setImageUrl(result.image_url);
      setSegments(null);
    } catch (err) {
      console.error(err);
      setError('Recolor failed.');
    } finally {
      setLoading(false);
    }
  };

  /** ------------ 3‑D Reconstruction (using api.ts) ------------ */
  const handleReconstructImage = async () => {
    if (!imageUrl) {
      setError('Please generate or capture an image first.');
      return;
    }
    setLoading(true);
    setError(null);
    setReconstructionUrl(null);
    setModelInfo(null);
    try {
      // ✅ CHANGED: Pass data as an object
      const result = await reconstruct({ image_url: imageUrl });
      setReconstructionUrl(result.reconstruction_url);
      setModelInfo(result.model_info);
    } catch (err) {
      console.error('Reconstruct error:', err);
      setError('3D reconstruction failed.');
    } finally {
      setLoading(false);
    }
  };

  /** ------------ 3D Model Utility Functions ------------ */
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

  // -------------------------- RENDER --------------------------
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-white">
          <svg className="animate-spin h-10 w-10" viewBox="0 0 24 24" />
          <p className="mt-4 text-lg">Processing…</p>
        </div>
      );
    }

    if (reconstructionUrl) {
      return (
        <model-viewer
          src={reconstructionUrl}
          alt="3D Room Reconstruction"
          camera-controls
          auto-rotate
          style={{ width: '100%', height: '100%' }}
          onError={e => {
            console.error('model-viewer load error:', e);
            setError('Unable to load the 3‑D model. Please try again later.');
            setReconstructionUrl(null);
          }}
        />
      );
    }

    if (imageUrl && segments) {
      return (
        <div className="relative w-full h-full">
          <img src={imageUrl} className="w-full h-full object-contain" />
          {segments.map((s, i) => (
            <div
              key={i}
              onClick={() => handleRecolorObject(s)}
              style={{
                WebkitMaskImage: `url(data:image/png;base64,${s.mask})`,
                maskImage: `url(data:image/png;base64,${s.mask})`,
                backgroundColor: '#8B5CF6',
              }}
              className="absolute inset-0 opacity-40 hover:opacity-60 cursor-pointer"
            />
          ))}
        </div>
      );
    }

    if (isCameraActive)
      return (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain"
        />
      );
    if (imageUrl) return <img src={imageUrl} className="w-full h-full object-contain" />;
    if (capturedImage) return <img src={capturedImage} className="w-full h-full object-contain" />;

    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        Your image will appear here
      </div>
    );
  };

  const renderActionButton = () => {
    if (mode === 'generate') {
      return (
        <button
          onClick={handleGenerateImage}
          disabled={loading}
          className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg"
        >
          Generate Image
        </button>
      );
    }

    if (mode === 'redesign') {
      if (isCameraActive) {
        return (
          <button
            onClick={handleTakePicture}
            className="w-full bg-red-600 text-white font-bold py-3 px-4 rounded-lg"
          >
            Take Picture
          </button>
        );
      }
      if (capturedImage) {
        return (
          <button
            onClick={handleRedesignImage}
            disabled={loading}
            className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg"
          >
            Redesign Image
          </button>
        );
      }
      return (
        <button
          onClick={handleStartCamera}
          className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg"
        >
          Scan My Room
        </button>
      );
    }

    return null;
  };

  // -------------------------- RETURN --------------------------
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4">
      {/* Header */}
      <header className="w-full max-w-5xl text-center mb-6">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
          AI Room Designer
        </h1>
        <p className="text-gray-400 mt-2">
          Create or reimagine your perfect space with AI.
        </p>
      </header>

      {/* Main content */}
      <main className="w-full max-w-5xl flex-1 flex flex-col bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Controls */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex bg-gray-900 rounded-lg p-1 space-x-1 mb-6">
            <button
              onClick={() => switchMode('generate')}
              className={`w-1/2 py-2.5 rounded-lg ${
                mode === 'generate' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              Generate New
            </button>
            <button
              onClick={() => switchMode('redesign')}
              className={`w-1/2 py-2.5 rounded-lg ${
                mode === 'redesign' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              Redesign My Room
            </button>
          </div>

          <h2 className="text-xl mb-3 text-gray-200">Choose a Style</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setSelectedCategory(c)}
                className={`px-4 py-2 rounded-lg ${
                  selectedCategory === c ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Preview / canvas */}
        <div className="flex-1 bg-gray-900 p-2 min-h-[300px]">
          <div className="bg-black w-full h-full rounded-lg flex items-center justify-center relative">
            {renderContent()}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="p-4 bg-red-900 text-red-200 text-center">{error}</div>
        )}

        {/* Footer actions */}
        <footer className="p-6 border-t border-gray-700">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div />
            <div>{renderActionButton()}</div>
            <div className="flex justify-center sm:justify-end space-x-3">
              {imageUrl && (
                <>
                  <button
                    onClick={handleSaveImage}
                    className="bg-gray-700 hover:bg-gray-600 py-2 px-4 rounded-lg"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleSegmentImage}
                    className="bg-pink-600 hover:pink-700 py-2 px-4 rounded-lg"
                  >
                    Magic Edit
                  </button>
                  <button
                    onClick={handleReconstructImage}
                    className="bg-yellow-600 hover:bg-yellow-700 py-2 px-4 rounded-lg"
                  >
                    Reconstruct in 3D
                  </button>
                  {navigator.share && (
                    <button
                      onClick={handleShareImage}
                      className="bg-gray-700 hover:bg-gray-600 py-2 px-4 rounded-lg"
                    >
                      Share
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Enhanced 3D Model Controls */}
          {reconstructionUrl && modelInfo && (
            <div className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-600">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white">3D Model Ready</h3>
                <button
                  onClick={() => setShowModelDetails(!showModelDetails)}
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  {showModelDetails ? 'Hide Details' : 'Show Details'}
                </button>
              </div>

              <div className="flex flex-wrap gap-3 mb-3">
                <button
                  onClick={handleDownloadGLB}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                >
                  Download GLB File
                </button>
                <button
                  onClick={handleOpenGLB}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  Open in New Tab
                </button>
                <button
                  onClick={handleCopyGLBUrl}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
                >
                  Copy URL
                </button>
              </div>

              {showModelDetails && modelInfo && (
                <div className="text-sm text-gray-300 space-y-1">
                  <p><strong>Model:</strong> {modelInfo.model_used}</p>
                  <p><strong>File Size:</strong> {modelInfo.file_size ? `${Math.round(modelInfo.file_size / 1024)} KB` : 'Unknown'}</p>
                  <p><strong>Format:</strong> {modelInfo.content_type || 'GLB'}</p>
                  <p><strong>Direct URL:</strong>{' '}
                    <a
                      href={modelInfo.direct_download}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 ml-1 break-all"
                    >
                      {modelInfo.direct_download}
                    </a>
                  </p>
                </div>
              )}
            </div>
          )}
        </footer>
      </main>
    </div>
  );
};

export default App;