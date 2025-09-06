import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";

// 🔴 PROBLEM 1: API Key access
// process.env does not work in a build-less setup like this.
// Replace the placeholder below with your actual API key.
// WARNING: Do not commit your API key to a public repository.
const API_KEY = "YOUR_GOOGLE_AI_API_KEY";

const App: React.FC = () => {
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [mode, setMode] = useState<'generate' | 'redesign'>('generate');
    const [selectedCategory, setSelectedCategory] = useState<string>('Modern');
    const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const categories = ['Modern', 'Minimalist', 'Bohemian', 'Coastal', 'Industrial', 'Farmhouse'];

    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, []);

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
        if (API_KEY === "YOUR_GOOGLE_AI_API_KEY") {
            setError("Please replace 'YOUR_GOOGLE_AI_API_KEY' in the code with your actual API key.");
            return;
        }
        setLoading(true);
        setError(null);
        setImageUrl(null);
        setCapturedImage(null);
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

    const handleStartCamera = async () => {
        // 🟢 FIX: Improved camera request with better error handling.
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                // This constraint prefers the back camera but falls back to any available camera.
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current?.play().catch(e => console.error("Video play failed:", e));
                    };
                    setIsCameraActive(true);
                    setCapturedImage(null);
                    setImageUrl(null);
                    setError(null);
                }
            } catch (err: any) {
                // Provide more specific error messages
                console.error("Camera access error:", err.name, err.message);
                if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                    setError("Camera access denied. Please enable it in your browser settings for this site.");
                } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                    setError("No camera found on this device.");
                } else {
                    setError("Could not access camera. Please ensure it's not in use by another app.");
                }
            }
        } else {
            setError("Your browser does not support camera access.");
        }
    };

    const handleTakePicture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg');
                setCapturedImage(dataUrl);
                stopCamera();
            }
        }
    };

    const handleRedesignImage = async () => {
        if (!capturedImage) {
            setError("Please capture an image first.");
            return;
        }
        if (API_KEY === "YOUR_GOOGLE_AI_API_KEY") {
            setError("Please replace 'YOUR_GOOGLE_AI_API_KEY' in the code with your actual API key.");
            return;
        }
        setLoading(true);
        setError(null);
        setImageUrl(null);

        const parsedImage = parseDataUrl(capturedImage);
        if (!parsedImage) {
            setError("Invalid image format.");
            setLoading(false);
            return;
        }

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: {
                    parts: [
                        { inlineData: { data: parsedImage.data, mimeType: parsedImage.mimeType } },
                        { text: `Redesign this room in a ${selectedCategory} style. Keep the original room structure and furniture layout but change the wall colors, furniture style, decorations, and lighting to match the new style.` },
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });

            const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
            if (imagePart?.inlineData) {
                const { data, mimeType } = imagePart.inlineData;
                setImageUrl(`data:${mimeType};base64,${data}`);
            } else {
                throw new Error("The AI did not return a redesigned image.");
            }
        } catch (err) {
            console.error(err);
            setError("Failed to redesign image. Please check your API key and try again.");
        } finally {
            setLoading(false);
            setCapturedImage(null);
        }
    };

    const switchMode = (newMode: 'generate' | 'redesign') => {
        setMode(newMode);
        setError(null);
        setImageUrl(null);
        setCapturedImage(null);
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
        link.download = `ai-room-${selectedCategory.toLowerCase().replace(' ', '-')}.jpeg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleShareImage = async () => {
        if (!imageUrl || !navigator.share) {
            alert("Web Share API is not available on your browser.");
            return;
        }
        try {
            const file = await dataUrlToFile(imageUrl, `ai-room-${selectedCategory.toLowerCase()}.jpeg`);
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'AI Room Design',
                    text: `Check out this ${selectedCategory} room I designed!`,
                    files: [file],
                });
            } else {
                setError("Your browser doesn't support sharing files.");
            }
        } catch (error) {
            console.error('Error sharing:', error);
            setError("Could not share the image.");
        }
    };

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-white">
                    <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-4 text-lg">Designing your space...</p>
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
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="mt-2 text-lg">Your image will appear here</p>
                </div>
            </div>
        );
    };

    const renderActionButton = () => {
        if (mode === 'generate') {
            return (
                <button
                    onClick={handleGenerateImage}
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors duration-300 shadow-lg text-lg"
                >
                    Generate Image
                </button>
            );
        }
        if (mode === 'redesign') {
            if (isCameraActive) {
                return <button onClick={handleTakePicture} className="w-full bg-red-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700 transition-colors duration-300 shadow-lg text-lg">Take Picture</button>;
            }
            if (capturedImage) {
                return <button onClick={handleRedesignImage} disabled={loading} className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 disabled:bg-green-400 transition-colors duration-300 shadow-lg text-lg">Redesign Image</button>;
            }
            return <button onClick={handleStartCamera} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-300 shadow-lg text-lg">Scan My Room</button>;
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans">
            <header className="w-full max-w-5xl text-center mb-6">
                <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
                    AI Room Designer
                </h1>
                <p className="text-gray-400 mt-2 text-lg">Create or reimagine your perfect space with AI.</p>
            </header>

            <main className="w-full max-w-5xl flex-1 flex flex-col bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-700">
                    <div className="flex bg-gray-900 rounded-lg p-1 space-x-1 mb-6">
                        <button
                            onClick={() => switchMode('generate')}
                            className={`w-1/2 py-2.5 text-sm font-medium leading-5 rounded-lg transition-colors duration-300 ${mode === 'generate' ? 'bg-indigo-600 text-white shadow' : 'text-gray-300 hover:bg-gray-700'}`}
                        >
                            Generate New
                        </button>
                        <button
                            onClick={() => switchMode('redesign')}
                            className={`w-1/2 py-2.5 text-sm font-medium leading-5 rounded-lg transition-colors duration-300 ${mode === 'redesign' ? 'bg-indigo-600 text-white shadow' : 'text-gray-300 hover:bg-gray-700'}`}
                        >
                            Redesign My Room
                        </button>
                    </div>

                    <h2 className="text-xl font-semibold mb-3 text-gray-200">Choose a Style</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {categories.map(category => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${selectedCategory === category ? 'bg-indigo-500 text-white ring-2 ring-indigo-400 shadow-md' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </div>

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
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                        <span>Save</span>
                                    </button>
                                    {navigator.share && (
                                        <button onClick={handleShareImage} className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">
                                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                              <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                                            </svg>
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
