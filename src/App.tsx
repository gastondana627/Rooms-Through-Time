import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import * as fal from '@fal-ai/serverless-client'; // We'll use this for the Python integration too

// Your API keys from the .env file
const API_KEY = import.meta.env.VITE_GOOGLE_AI_API_KEY;

const App: React.FC = () => {
    // --- EXISTING STATE ---
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [mode, setMode] = useState<'generate' | 'redesign'>('generate');
    const [selectedCategory, setSelectedCategory] = useState<string>('Modern');
    const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    // --- NEW STATE FOR MAGIC EDIT ---
    const [segments, setSegments] = useState<any[] | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const categories = ['Modern', 'Minimalist', 'Bohemian', 'Coastal', 'Industrial', 'Farmhouse'];

    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, []);

    // --- ALL YOUR EXISTING FUNCTIONS (stopCamera, parseDataUrl, etc.) ---
    // (No changes needed in the functions below, they are included for completeness)
    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
    };

    const parseDataUrl = (dataUrl: string): { mimeType: string; data: string } | null => {
        const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!match) return null;
        return { mimeType: match[1], data: match[2] };
    };

    const handleGenerateImage = async () => {
        // ... (This function remains unchanged)
        if (API_KEY === "YOUR_GOOGLE_AI_API_KEY") {
            setError("Please replace 'YOUR_GOOGLE_AI_API_KEY' in the code with your actual API key.");
            return;
        }
        setLoading(true);
        setError(null);
        setImageUrl(null);
        setCapturedImage(null);
        setSegments(null); // Clear segments when generating a new image
        try {
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: `A high-resolution, photorealistic image of a ${selectedCategory} style room.`,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/jpeg',
                    aspectRatio: '16:9',
                },
            });

            if (response.generatedImages && response.generatedImages.length > 0) {
                const base64Image = response.generatedImages[0].image.imageBytes;
                setImageUrl(`data:image/jpeg;base64,${base64Image}`);
            } else {
                throw new Error("No image was generated.");
            }
        } catch (err) {
            console.error(err);
            setError("Failed to generate image. Please check your API key and try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleStartCamera = async () => { /* ... (unchanged) ... */ };
    const handleTakePicture = () => { /* ... (unchanged) ... */ };
    const handleRedesignImage = async () => { /* ... (unchanged) ... */ };
    const switchMode = (newMode: 'generate' | 'redesign') => { /* ... (unchanged, but let's add segment clearing) ... */
        setMode(newMode);
        setError(null);
        setImageUrl(null);
        setCapturedImage(null);
        stopCamera();
        setSegments(null); // Also clear segments when switching modes
    };
    const dataUrlToFile = async (dataUrl: string, fileName: string): Promise<File> => { /* ... (unchanged) ... */ };
    const handleSaveImage = () => { /* ... (unchanged) ... */ };
    const handleShareImage = async () => { /* ... (unchanged) ... */ };


    // --- NEW FUNCTIONS FOR PYTHON BACKEND INTEGRATION ---

    const handleSegmentImage = async () => {
        if (!imageUrl) return;
        setLoading(true);
        setError(null);
        setSegments(null);
        try {
            const response = await fetch('http://127.0.0.1:8000/segment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_url: imageUrl }),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            setSegments(result.segments); // Save the array of detected objects
        } catch (err) {
            console.error(err);
            setError("Failed to segment image. Is the Python server running?");
        } finally {
            setLoading(false);
        }
    };

    const handleRecolorObject = async (segment: any) => {
        if (!imageUrl) return;

        // In a real app, you'd use a color picker. For now, we'll use a cool purple.
        const newColor: [number, number, number] = [139, 92, 246];

        setLoading(true);
        setError(null);
        try {
            const response = await fetch('http://127.0.0.1:8000/recolor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_url: imageUrl,
                    mask: segment,
                    color: newColor,
                }),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            setImageUrl(result.image_url); // Update UI with the recolored image
            setSegments(null); // Exit editing mode
        } catch (err) {
            console.error(err);
            setError("Failed to recolor object.");
        } finally {
            setLoading(false);
        }
    };


    // --- UPDATED RENDER FUNCTIONS ---

    const renderContent = () => {
        if (loading) {
            return ( <div className="...loading spinner...">...</div> ); // Your existing loading spinner JSX
        }

        // NEW: Render the image with clickable segments on top
        if (imageUrl && segments) {
            return (
                <div className="relative w-full h-full">
                    <img src={imageUrl} alt="Segmented room" className="w-full h-full object-contain" />
                    {segments.map((segment, index) => (
                        <div
                            key={index}
                            title={`Click to recolor: ${segment.label}`}
                            className="absolute top-0 left-0 w-full h-full opacity-40 hover:opacity-60 cursor-pointer transition-opacity"
                            style={{
                                WebkitMaskImage: `url(data:image/png;base64,${segment.mask})`,
                                WebkitMaskSize: 'contain',
                                WebkitMaskPosition: 'center',
                                WebkitMaskRepeat: 'no-repeat',
                                maskImage: `url(data:image/png;base64,${segment.mask})`,
                                maskSize: 'contain',
                                maskPosition: 'center',
                                maskRepeat: 'no-repeat',
                                backgroundColor: '#8B5CF6', // A purple tint for the mask overlay
                            }}
                            onClick={() => handleRecolorObject(segment)}
                        />
                    ))}
                </div>
            );
        }

        if (isCameraActive) {
            return <video ref={videoRef} className="w-full h-full object-contain" autoPlay playsInline muted />;
        }
        if (imageUrl) {
            return <img src={imageUrl} alt="Generated room" className="w-full h-full object-contain" />;
        }
        if (capturedImage) {
            return <img src={capturedImage} alt="Captured room for redesign" className="w-full h-full object-contain" />;
        }
        return ( <div className="...placeholder...">...</div> ); // Your existing placeholder JSX
    };

    // ... (renderActionButton remains unchanged)

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans">
            {/* ... (header and main sections are mostly unchanged) ... */}
            <main className="w-full max-w-5xl flex-1 flex flex-col bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
                {/* ... (unchanged UI for mode switch and categories) ... */}
                <div className="flex-1 bg-gray-900 p-2 min-h-[300px] sm:min-h-[400px] lg:min-h-[500px]">
                    <div className="bg-black w-full h-full rounded-lg flex items-center justify-center relative">
                        {renderContent()}
                        <canvas ref={canvasRef} className="hidden"></canvas>
                    </div>
                </div>

                {error && <div className="p-4 bg-red-900 text-red-200 text-center">{error}</div>}

                <footer className="p-6 border-t border-gray-700">
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                        <div className="sm:col-span-1"></div>
                        <div className="sm:col-span-1">
                           {renderActionButton()}
                        </div>
                        <div className="sm:col-span-1 flex justify-center sm:justify-end space-x-3">
                             {imageUrl && (
                                <>
                                    <button onClick={handleSaveImage} className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                        <span>Save</span>
                                    </button>
                                    
                                    {/* --- NEW MAGIC EDIT BUTTON --- */}
                                    <button onClick={handleSegmentImage} className="flex items-center space-x-2 bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                        <span>Magic Edit</span>
                                    </button>

                                    {navigator.share && (
                                        <button onClick={handleShareImage} className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg>
                                            <span>Share</span>
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}

export default App;
