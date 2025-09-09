/* src/App.tsx */
import React, { useState, useRef, useEffect } from 'react';
import { segment, recolor, reconstruct, generateVoiceover, generateFalImage, redesignFalImage, getDesignerQuote, chatWithAvatar } from './api';

// Import your newly created icon components
import { EyeIcon } from './components/EyeIcon';
import { CubeIcon } from './components/CubeIcon';
import { SoundIcon } from './components/SoundIcon';
import { DownloadIcon } from './components/DownloadIcon';
import { ShareIcon } from './components/ShareIcon';
import { PaletteIcon } from './components/PaletteIcon';
import { XIcon } from './components/XIcon';
import { PlayIcon } from './components/PlayIcon'; // Assuming you create a PlayIcon as well

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
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(false);
  const [quote, setQuote] = useState<string | null>(null);
  const [showGLBViewer, setShowGLBViewer] = useState<boolean>(false);
  const [glbViewerUrl, setGLBViewerUrl] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('Processing…');
  const [showCharacter, setShowCharacter] = useState<boolean>(false);
  const [characterMessage, setCharacterMessage] = useState<string>('');
  const [mainAvatar, setMainAvatar] = useState<any>(null);
  const [isPlayingMusic, setIsPlayingMusic] = useState<boolean>(false);
  const [avatarRotationIndex, setAvatarRotationIndex] = useState<number>(0);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [showBeforeAfter, setShowBeforeAfter] = useState<boolean>(false);
  const [showHealthDashboard, setShowHealthDashboard] = useState<boolean>(false);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [userInput, setUserInput] = useState<string>('');
  const [showChatInput, setShowChatInput] = useState<boolean>(false);
  const [show3DComparison, setShow3DComparison] = useState<boolean>(false);

  // 3 Main Avatars that rotate each visit
  const mainAvatars = [
    { name: 'Zen Master', emoji: '🐢', personality: 'wise', voice: 'calm' },
    { name: 'Design Duck', emoji: '🦆', personality: 'creative', voice: 'enthusiastic' },
    { name: 'Sleek Penguin', emoji: '🐧', personality: 'modern', voice: 'sophisticated' }
  ];

  // Load avatar on app start and rotate main avatars
  useEffect(() => {
    // Rotate main avatar each visit
    const currentMainAvatar = mainAvatars[avatarRotationIndex % mainAvatars.length];
    setMainAvatar(currentMainAvatar);

    // Get style-specific character for interactions
    const styleCharacter = getStyleCharacter(selectedCategory);

    // Start ambient music based on style
    if (styleCharacter.personality === 'calm' || currentMainAvatar.personality === 'wise') {
      setIsPlayingMusic(true);
    }

    // Rotate avatar for next visit
    setAvatarRotationIndex(prev => prev + 1);
  }, [selectedCategory]);

  // Health check for judges/demo
  const checkSystemHealth = async () => {
    try {
      const response = await fetch('/health');
      const health = await response.json();
      setHealthStatus(health);
      setShowHealthDashboard(true);
    } catch (error) {
      console.error('Health check failed:', error);
    }
  };

  // Add voice interaction capability
  const handleAvatarSpeak = async (message: string, characterType?: string) => {
    try {
      const currentAvatar = mainAvatar || mainAvatars[0];
      const avatarType = characterType || (
        currentAvatar.name.toLowerCase().includes('turtle') ? 'turtle' :
          currentAvatar.name.toLowerCase().includes('duck') ? 'duck' :
            currentAvatar.name.toLowerCase().includes('penguin') ? 'penguin' : 'turtle'
      );

      console.log(`🎭 ${currentAvatar.name} is speaking: "${message}"`);

      const response = await fetch('/generate-character-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_type: avatarType,
          message: message,
          style: selectedCategory
        })
      });

      if (response.ok) {
        const audioData = await response.json();
        const audio = new Audio(audioData.voiceover_url + `?t=${Date.now()}`);

        // Show visual feedback while speaking
        setIsPlayingMusic(true);

        audio.onended = () => {
          setIsPlayingMusic(false);
        };

        audio.play();
        return audioData;
      }
    } catch (error) {
      console.error('Avatar speech failed:', error);
      setIsPlayingMusic(false);
    }
  };

  // Smart chatbot with local LM Studio integration
  const handleChatWithAvatar = async (message: string) => {
    if (!message.trim()) return;

    try {
      setLoading(true);
      setCharacterMessage('Thinking...');

      const currentCharacter = getStyleCharacter(selectedCategory);

      const chatResult = await chatWithAvatar({
        message: message,
        character_name: currentCharacter.name,
        style: selectedCategory,
        conversation_history: [] // Could store chat history here
      });

      // Show the response immediately
      setCharacterMessage(chatResult.response);
      setShowCharacter(true);
      setShowChatInput(false); // Close input, show response

      // Speak the response if voice is available (don't await to avoid blocking)
      if (chatResult.response) {
        handleAvatarSpeak(chatResult.response).catch(console.error);
      }

      // Show source info for demo purposes
      if (chatResult.source === 'lm_studio_local') {
        console.log('🏠 Using local LM Studio - perfect for hackathon demo!');
      }

      return chatResult;
    } catch (error) {
      console.error('Chat failed:', error);
      setCharacterMessage("I'm here to help with your design! What would you like to create?");
      setShowCharacter(true);
      setShowChatInput(false);
    } finally {
      setLoading(false);
      setUserInput('');
    }
  };

  // Random chat prompts for each style
  const getRandomChatPrompt = (style: string) => {
    const stylePrompts = {
      'Southwestern': [
        "What colors capture the desert sunset feeling?",
        "How do I create that warm adobe atmosphere?",
        "What textures work best for Southwestern style?",
        "Help me choose the perfect turquoise accents",
        "What furniture gives authentic desert vibes?"
      ],
      'Modern': [
        "What colors work for a sleek modern look?",
        "How do I choose contemporary furniture?",
        "What lighting creates modern ambiance?",
        "Help me with clean, minimalist layouts",
        "What materials define modern design?"
      ],
      'Industrial': [
        "What colors complement exposed brick walls?",
        "How do I balance raw and refined elements?",
        "What lighting fixtures work for industrial style?",
        "Help me choose the right metal accents",
        "What furniture has that urban loft feel?"
      ],
      'Bohemian': [
        "What colors create that eclectic boho vibe?",
        "How do I mix patterns without chaos?",
        "What textures add bohemian warmth?",
        "Help me layer global design elements",
        "What furniture tells a travel story?"
      ],
      'Coastal': [
        "What colors bring the ocean indoors?",
        "How do I create that breezy seaside feel?",
        "What textures evoke coastal living?",
        "Help me choose weathered wood elements",
        "What lighting mimics natural beach light?"
      ],
      'Luxury': [
        "What colors convey sophisticated elegance?",
        "How do I choose premium materials?",
        "What lighting creates luxurious ambiance?",
        "Help me select statement furniture pieces",
        "What details make a space feel expensive?"
      ],
      'Minimalist': [
        "What colors create serene simplicity?",
        "How do I choose multifunctional furniture?",
        "What lighting enhances clean lines?",
        "Help me declutter while staying stylish",
        "What textures add warmth to minimalism?"
      ],
      'Farmhouse': [
        "What colors create cozy country charm?",
        "How do I mix vintage and new pieces?",
        "What textures add rustic warmth?",
        "Help me choose authentic farmhouse elements",
        "What lighting creates that homey feeling?"
      ]
    };

    const prompts = stylePrompts[style] || [
      `What colors work best for ${style} style?`,
      `How do I choose furniture for ${style} design?`,
      `What lighting works for ${style} spaces?`,
      `Help me create the perfect ${style} atmosphere`,
      `What are the key elements of ${style} style?`
    ];

    return prompts[Math.floor(Math.random() * prompts.length)];
  };

  // Style-matched character mapping
  const getStyleCharacter = (style: string) => {
    const characterMap = {
      'Minimalist': { name: 'Zen Turtle', emoji: '🐢', personality: 'calm' },
      'Art Deco': { name: 'Mandarin Duck', emoji: '🦆', personality: 'glamorous' },
      'Luxury': { name: 'Diamond Terrapin', emoji: '💎🐢', personality: 'sophisticated' },
      'Industrial': { name: 'Steel Owl', emoji: '🦉', personality: 'technical' },
      'Bohemian': { name: 'Painted Turtle', emoji: '🎨🐢', personality: 'artistic' },
      'Coastal': { name: 'Wood Duck', emoji: '🌊🦆', personality: 'breezy' },
      'Victorian': { name: 'Crested Duck', emoji: '👑🦆', personality: 'elegant' },
      'Scandinavian': { name: 'Arctic Fox', emoji: '🦊', personality: 'cozy' },
      'Mediterranean': { name: 'Peacock', emoji: '🦚', personality: 'warm' },
      'Modern': { name: 'Sleek Penguin', emoji: '🐧', personality: 'contemporary' },
      'Farmhouse': { name: 'Barn Owl', emoji: '🦉', personality: 'rustic' },
      'Steampunk': { name: 'Brass Raven', emoji: '⚙️🐦‍⬛', personality: 'inventive' }
    };
    return characterMap[style] || { name: 'Design Companion', emoji: '✨', personality: 'helpful' };
  };

  // --- REFS & CONSTANTS ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 30+ comprehensive style categories
  const allCategories = [
    'Modern', 'Minimalist', 'Bohemian', 'Coastal', 'Industrial', 'Farmhouse',
    'Scandinavian', 'Mediterranean', 'Art Deco', 'Mid-Century', 'Victorian', 'Contemporary',
    'Rustic', 'Tropical', 'Gothic', 'Zen', 'Eclectic', 'Traditional',
    'Luxury', 'Urban', 'Country', 'Vintage', 'Futuristic', 'Maximalist',
    'Japanese', 'French Country', 'Southwestern', 'Colonial', 'Craftsman', 'Prairie',
    'Transitional', 'Glam', 'Shabby Chic', 'Steampunk', 'Moroccan', 'Asian Fusion'
  ];

  // Function to get 6 truly random categories (no repeats from previous selection)
  const getRandomCategories = (excludeList = []) => {
    const available = allCategories.filter(cat => !excludeList.includes(cat));
    const shuffled = [...available].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 6);
  };

  const [categories, setCategories] = useState(() => getRandomCategories());
  const [previousCategories, setPreviousCategories] = useState([]);

  // --- EFFECTS ---

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

  useEffect(() => {
    if (loading && !quote) {
      // Style-specific inspirational quotes for better user experience
      const styleQuotes = {
        'Southwestern': "The desert teaches us that beauty lies in simplicity and warmth.",
        'Industrial': "Raw materials tell the most honest stories of design.",
        'Minimalist': "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.",
        'Luxury': "True luxury is in each detail - it's a way of life.",
        'Bohemian': "Let your space tell the story of your adventures and dreams.",
        'Coastal': "The ocean's rhythm brings peace to every corner of the home.",
        'Modern': "Innovation distinguishes between a leader and a follower in design.",
        'Farmhouse': "Home is where love resides, memories are created, and laughter never ends."
      };

      // Try dynamic quote first, fallback to style-specific
      getDesignerQuote()
        .then(data => setQuote(data.quote))
        .catch(err => {
          const styleQuote = styleQuotes[selectedCategory] || "Design is thinking made visual.";
          setQuote(styleQuote);
        });
    } else if (!loading) {
      setQuote(null);
    }
  }, [loading, selectedCategory]);


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
    setOriginalImage(null);
    setShowBeforeAfter(false);
    try {
      const prompt = `A high-resolution, photorealistic image of a ${selectedCategory} style room.`;
      const result = await generateFalImage({ prompt });
      setImageUrl(result.image_url);
      setOriginalImage(result.image_url); // Store original for before/after
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

      // Enable before/after comparison
      if (!originalImage) setOriginalImage(capturedImage);
      setImageUrl(result.image_url);
      // Don't show before/after until 3D reconstruction
      // setShowBeforeAfter(true);
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

  const handleSaveImage = async () => {
    if (!imageUrl) return;

    try {
      // Fetch the image as a blob to ensure proper download
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `ai-room-${selectedCategory.toLowerCase()}.jpeg`;
      document.body.appendChild(link); // Ensure link is in DOM
      link.click();
      document.body.removeChild(link); // Clean up

      // Clean up the object URL
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download image:', error);
      // Fallback to original method if fetch fails
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `ai-room-${selectedCategory.toLowerCase()}.jpeg`;
      link.target = '_self'; // Ensure it doesn't open in new window
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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
      console.log('🔍 Starting AI vision segmentation...');
      const result = await segment({ image_url: imageUrl });
      console.log('📊 Segmentation result:', result);

      if (result.masks && result.masks.length > 0) {
        console.log(`✅ Found ${result.masks.length} segments`);
        setSegments(result.masks);
      } else {
        console.warn('⚠️ No segments found in image');
        setError('No objects detected in this image. Try with a different image that has clear objects like furniture, decorations, or architectural elements.');
      }
    } catch (err) {
      console.error('❌ Segmentation error:', err);
      setError('AI vision failed. Please try again or check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecolorObject = async (maskData: any) => {
    if (!imageUrl) return;
    setLoading(true);
    setError(null);
    try {
      const result = await recolor({
        image_url: imageUrl,
        mask: maskData,
        color: [139, 92, 246]
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

  const handleReconstructImage = async () => {
    if (!imageUrl) { setError('Please generate or capture an image first.'); return; }
    setLoading(true); setError(null); setReconstructionUrl(null); setModelInfo(null);

    // Ultra-detailed 6-stage processing messages
    const progressMessages = [
      'Stage 1/6: Analyzing image depth and geometry...',
      'Stage 2/6: Generating base mesh structure...',
      'Stage 3/6: Enhancing mesh detail and complexity...',
      'Stage 4/6: Optimizing textures and materials...',
      'Stage 5/6: Refining geometry and smoothing...',
      'Stage 6/6: Final ultra-quality enhancement...',
      'Stage 6/6: Your masterpiece is almost ready...'
    ];

    let messageIndex = 0;
    setLoadingMessage(progressMessages[0]);

    const progressInterval = setInterval(() => {
      if (messageIndex < progressMessages.length - 1) {
        messageIndex++;
        setLoadingMessage(progressMessages[messageIndex]);
        console.log(`🎯 ${progressMessages[messageIndex]}`);
      }
    }, 2000);

    try {
      console.log('🚀 Starting ultra-high quality 3D reconstruction...');

      // Show style-matched character during reconstruction
      const character = getStyleCharacter(selectedCategory);
      setTimeout(() => {
        setCharacterMessage(`${character.emoji} Creating your ${selectedCategory} 3D masterpiece...`);
        setShowCharacter(true);
      }, 2000);

      const result = await reconstruct({ image_url: imageUrl });

      clearInterval(progressInterval);
      console.log('✅ Ultra-HQ 3D model ready!');

      setReconstructionUrl(result.reconstruction_url);
      setModelInfo(result.model_info);
      
      // Now show before/after slider since 3D is complete
      if (originalImage || capturedImage) {
        setShowBeforeAfter(true);
      }

      // Character celebrates completion
      setCharacterMessage(`${character.emoji} Your ${selectedCategory} 3D model is ready! Click to explore.`);
      setTimeout(() => setShowCharacter(false), 4000);

    } catch (err) {
      clearInterval(progressInterval);
      console.error('Reconstruct error:', err);
      setError('3D reconstruction failed. Please try with a different image.');
    } finally {
      setLoading(false);
      setLoadingMessage('Processing…'); // Reset to default
    }
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

  const handleDownloadGLB = async () => {
    if (modelInfo?.direct_download) {
      try {
        // Get style-matched character
        const character = getStyleCharacter(selectedCategory);

        // Show character with download message
        setCharacterMessage(`${character.emoji} Your ${selectedCategory} 3D model is ready! Downloading now...`);
        setShowCharacter(true);

        // Show in-app viewer first for immediate experience
        setGLBViewerUrl(modelInfo.direct_download);
        setShowGLBViewer(true);

        // Then download in background
        const response = await fetch(modelInfo.direct_download);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedCategory.toLowerCase()}-room-3d-model.glb`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up
        URL.revokeObjectURL(url);

        // Update character message with voice announcement
        setTimeout(() => {
          const completionMessage = `${character.emoji} Download complete! Your ${selectedCategory} masterpiece is saved.`;
          setCharacterMessage(completionMessage);

          // HACKATHON FEATURE: Avatar announces completion via voice
          handleAvatarSpeak(`Your ${selectedCategory} 3D model download is complete! Check your downloads folder.`);

          setTimeout(() => setShowCharacter(false), 4000);
        }, 1000);

      } catch (error) {
        console.error('Download failed:', error);
        const character = getStyleCharacter(selectedCategory);
        setCharacterMessage(`${character.emoji} Oops! Let me try a different way...`);

        // Fallback to direct link
        const link = document.createElement('a');
        link.href = modelInfo.direct_download;
        link.download = `${selectedCategory.toLowerCase()}-room-3d-model.glb`;
        link.click();

        setTimeout(() => setShowCharacter(false), 2000);
      }
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
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full text-white relative overflow-hidden">
          {/* Animated Background - FULL WINDOW */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-purple-900/20 to-pink-900/20"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]"></div>

          {/* Main Loading Content - EXPANDED SIZE */}
          <div className="relative z-10 flex flex-col items-center w-full max-w-3xl px-8">
            {/* Enhanced Loading Spinner */}
            <div className="relative">
              <div className="w-16 h-16 border-4 border-indigo-200/20 rounded-full"></div>
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-indigo-400 rounded-full animate-spin"></div>
              <div className="absolute top-2 left-2 w-12 h-12 border-4 border-transparent border-t-purple-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
            </div>

            {/* Loading Message */}
            <div className="mt-6 text-center">
              <p className="text-xl font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                {loadingMessage}
              </p>

              {/* Quality Indicators */}
              {loadingMessage.includes('3D') && (
                <div className="mt-3 flex items-center justify-center gap-2 text-xs">
                  <span className="px-2 py-1 bg-indigo-500/20 rounded-full text-indigo-300 border border-indigo-500/30">
                    Room-Optimized
                  </span>
                  <span className="px-2 py-1 bg-purple-500/20 rounded-full text-purple-300 border border-purple-500/30">
                    Ultra-HQ
                  </span>
                  <span className="px-2 py-1 bg-pink-500/20 rounded-full text-pink-300 border border-pink-500/30">
                    1024px Textures
                  </span>
                </div>
              )}

              {/* Progress Bar */}
              <div className="mt-4 w-64 h-1 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 rounded-full animate-pulse"></div>
              </div>
            </div>

            {/* Designer Quote */}
            {quote && (
              <div className="mt-8 max-w-md text-center">
                <div className="p-4 bg-black/20 backdrop-blur-sm rounded-xl border border-white/10">
                  <svg className="w-6 h-6 text-indigo-400 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h4v10h-10z" />
                  </svg>
                  <p className="text-sm text-gray-300 italic leading-relaxed">
                    "{quote}"
                  </p>
                  <div className="mt-2 w-12 h-px bg-gradient-to-r from-transparent via-indigo-400 to-transparent mx-auto"></div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    if (reconstructionUrl) {
      return (
        <div className="relative w-full h-full">
          <model-viewer
            src={reconstructionUrl}
            alt="3D Room Reconstruction"
            camera-controls
            auto-rotate
            camera-orbit="0deg 90deg 2.5m"
            min-camera-orbit="auto auto 0.5m"
            max-camera-orbit="auto auto 5m"
            field-of-view="35deg"
            interaction-prompt="auto"
            style={{ width: '100%', height: '100%' }}
            onError={e => { console.error('model-viewer load error:', e); setError('Unable to load the 3‑D model.'); setReconstructionUrl(null); }}
          />
          {/* 3D Model Controls - Bottom Bar */}
          <div className="absolute bottom-4 left-4 right-4 flex justify-center">
            <div className="flex items-center gap-2 p-2 bg-black/50 backdrop-blur-md rounded-full border border-white/10 shadow-lg">
              <button
                onClick={() => setShow3DComparison(!show3DComparison)}
                className={`action-button ${show3DComparison ? 'bg-indigo-600' : ''}`}
                title="Compare with Original"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
              </button>
              <button onClick={handleDownloadGLB} className="action-button bg-indigo-600 hover:bg-indigo-700" title="Download Ultra-HQ 3D Model">
                <DownloadIcon />
              </button>
              <button
                onClick={() => {
                  setGLBViewerUrl(reconstructionUrl);
                  setShowGLBViewer(true);
                }}
                className="action-button"
                title="View in Full Screen"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
              </button>
              <button onClick={handleOpenGLB} className="action-button" title="Open in New Tab">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </button>
              <button onClick={handleCopyGLBUrl} className="action-button" title="Copy Model URL">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                </svg>
              </button>
              <button
                onClick={() => {
                  const modelViewer = document.querySelector('model-viewer');
                  if (modelViewer) {
                    // Reset to match original room image perspective
                    modelViewer.cameraOrbit = '0deg 90deg 2.5m';  // Top-down view like room images
                    modelViewer.fieldOfView = '35deg';
                    modelViewer.cameraTarget = 'auto auto auto';
                  }
                }}
                className="action-button"
                title="Reset to Room View"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
              <div className="h-6 w-px bg-white/20 mx-1"></div>
              <span className="text-xs text-white/70 px-2">Scroll to zoom • Drag to rotate</span>
              <div className="h-6 w-px bg-white/20 mx-1"></div>
              <button onClick={() => { setReconstructionUrl(null); setModelInfo(null); setShow3DComparison(false); }} className="action-button" title="Close 3D View">
                <XIcon />
              </button>
            </div>
          </div>

          {/* Side-by-Side Comparison */}
          {show3DComparison && (originalImage || imageUrl) && (
            <div className="absolute top-4 right-4 w-48 h-36 bg-black/80 backdrop-blur-sm rounded-lg border border-white/20 overflow-hidden">
              <div className="p-2">
                <div className="text-xs text-white/70 mb-2 text-center">Original Image</div>
                <img 
                  src={originalImage || imageUrl} 
                  alt="Original room" 
                  className="w-full h-28 object-cover rounded"
                />
              </div>
            </div>
          )}
        </div>
      );
    }
    if (imageUrl) {
      return (
        <div className="relative w-full h-full">
          {showBeforeAfter && originalImage ? (
            // Before/After Slider - HACKATHON SHOWSTOPPER FEATURE
            <div className="relative w-full h-full overflow-hidden">
              <img src={originalImage} className="absolute inset-0 w-full h-full object-contain" alt="Original room" />
              <div
                className="absolute inset-0 overflow-hidden transition-all duration-300"
                style={{ clipPath: 'inset(0 50% 0 0)' }}
              >
                <img src={imageUrl} className="w-full h-full object-contain" alt="Redesigned room" />
              </div>

              {/* Interactive Slider Control */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full px-4 py-2 shadow-xl animate-pulse">
                  <span className="text-sm font-bold">Before ← → After</span>
                </div>
              </div>

              {/* Style Labels */}
              <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium">
                Original
              </div>
              <div className="absolute top-4 right-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                {selectedCategory} Style ✨
              </div>

              {/* Toggle Button */}
              <button
                onClick={() => setShowBeforeAfter(false)}
                className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-gray-800 px-3 py-1 rounded-full text-sm font-medium transition-colors"
              >
                Hide Comparison
              </button>
            </div>
          ) : (
            // Regular Image Display
            <>
              <img src={imageUrl} className="w-full h-full object-contain" alt="Generated or redesigned room" />
              {segments && segments.map((s, i) => (
                <div
                  key={i}
                  onClick={() => handleRecolorObject(s)}
                  style={{
                    WebkitMaskImage: `url(${s.mask})`,
                    maskImage: `url(${s.mask})`,
                    backgroundColor: 'rgba(139, 92, 246, 0.7)',
                  }}
                  className="absolute inset-0 opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                />
              ))}
              {originalImage && (
                <button
                  onClick={() => setShowBeforeAfter(true)}
                  className="absolute bottom-4 right-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-xl hover:scale-105 transition-transform"
                >
                  Show Before/After ✨
                </button>
              )}
            </>
          )}
        </div>
      );
    }
    if (isCameraActive) return (<video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />);
    if (capturedImage) return <img src={capturedImage} className="w-full h-full object-contain" alt="User's room for redesign" />;
    return (<div className="flex items-center justify-center h-full text-gray-400">Your image will appear here</div>);
  };

  const renderActionButton = () => {
    if (mode === 'generate') { return (<button onClick={handleGenerateImage} disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg disabled:bg-indigo-800 disabled:cursor-not-allowed">Generate Image</button>); }
    if (mode === 'redesign') {
      if (isCameraActive) { return (<button onClick={handleTakePicture} className="w-full bg-red-600 text-white font-bold py-3 px-4 rounded-lg">Take Picture</button>); }
      if (capturedImage) { return (<button onClick={handleRedesignImage} disabled={loading} className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg disabled:bg-green-800 disabled:cursor-not-allowed">Redesign Image</button>); }
      return (<button onClick={handleStartCamera} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg">Scan My Room</button>);
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 font-sans">
      <header className="w-full max-w-5xl text-center mb-6">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">AI Room Designer</h1>
        <p className="text-gray-400 mt-2">Create or reimagine your perfect space with AI.</p>
        
        {/* Deployment Status Indicator */}
        <div className="mt-2 flex items-center justify-center gap-2">
          <div className={`w-2 h-2 rounded-full ${window.location.hostname === 'localhost' ? 'bg-green-400' : 'bg-blue-400'}`}></div>
          <span className="text-xs text-gray-500">
            {window.location.hostname === 'localhost' ? '🏠 Local Development' : '☁️ Production Deployment'}
          </span>
        </div>
      </header>
      <main className="w-full max-w-5xl flex-1 flex flex-col bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <div className="flex bg-gray-900 rounded-lg p-1 space-x-1 mb-6">
            <button onClick={() => switchMode('generate')} className={`w-1/2 py-2.5 rounded-lg transition-colors ${mode === 'generate' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>Generate New</button>
            <button onClick={() => switchMode('redesign')} className={`w-1/2 py-2.5 rounded-lg transition-colors ${mode === 'redesign' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`} >Redesign My Room</button>
          </div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl text-gray-200">Choose a Style</h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const newCategories = getRandomCategories(categories);
                  setPreviousCategories([...previousCategories, ...categories]);
                  setCategories(newCategories);
                  setSelectedCategory(newCategories[0]); // Auto-select first new style
                }}
                className="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                title="Get 6 completely new styles"
              >
                🎲 New Styles
              </button>
              <button
                onClick={checkSystemHealth}
                className="text-sm px-3 py-1 bg-green-700 hover:bg-green-600 text-white rounded-lg transition-colors"
                title="Check system health for demo"
              >
                🚀 Health
              </button>
              <button
                onClick={() => {
                  setCharacterMessage('Test message from debug button!');
                  setShowCharacter(true);
                }}
                className="text-sm px-3 py-1 bg-purple-700 hover:bg-purple-600 text-white rounded-lg transition-colors"
                title="Test chatbot display"
              >
                🧪 Test Chat
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {categories.map(c => (<button key={c} onClick={() => setSelectedCategory(c)} className={`px-4 py-2 rounded-lg transition-colors ${selectedCategory === c ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`} >{c}</button>))}
          </div>
        </div>

        {/* The main content area - FULL WINDOW SIZE */}
        <div className="flex-1 bg-gray-900 p-2 min-h-[500px] md:min-h-[600px] relative">
          <div className="bg-black w-full h-full rounded-lg flex items-center justify-center relative">
            <div className="w-full h-full flex items-center justify-center">
              {renderContent()}
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Contextual Action Bar */}
          {imageUrl && !loading && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
              <div className="flex items-center gap-2 p-2 bg-black/50 backdrop-blur-md rounded-full border border-white/10 shadow-lg">

                {segments ? (
                  <>
                    <button onClick={() => handleRecolorObject(segments[Math.floor(Math.random() * segments.length)])} className="action-button" title="Recolor Random Object">
                      <PaletteIcon />
                    </button>
                    <button onClick={() => setSegments(null)} className="action-button" title="Exit AI Vision">
                      <XIcon />
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={handleSegmentImage} className="action-button" title="Activate AI Vision">
                      <EyeIcon />
                    </button>
                    <button onClick={handleReconstructImage} className="action-button" title="Reconstruct in 3D">
                      <CubeIcon />
                    </button>
                    <button onClick={handleGenerateAudio} disabled={isAudioLoading} className="action-button" title="Describe Room">
                      {isAudioLoading
                        ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        : <SoundIcon />
                      }
                    </button>
                    {audioUrl && (
                      <button onClick={() => new Audio(audioUrl).play()} className="action-button" title="Play Description">
                        <PlayIcon />
                      </button>
                    )}
                    <div className="h-6 w-px bg-white/20 mx-1"></div>
                    <button onClick={handleSaveImage} className="action-button" title="Save Image">
                      <DownloadIcon />
                    </button>
                    {navigator.share && <button onClick={handleShareImage} className="action-button" title="Share Image">
                      <ShareIcon />
                    </button>}
                  </>
                )}

              </div>
            </div>
          )}
        </div>

        {error && (<div className="p-4 bg-red-900 text-red-200 text-center">{error}</div>)}

        <footer className="p-6 border-t border-gray-700 flex justify-center">
          <div className="w-full max-w-xs">
            {renderActionButton()}
          </div>
        </footer>
      </main>

      {/* Main Avatar - Always Present & Interactive */}
      <div className="fixed bottom-4 left-4 z-40">
        <div className="relative">
          <button
            onClick={() => {
              const currentAvatar = mainAvatar || mainAvatars[0];
              const styleCharacter = getStyleCharacter(selectedCategory);
              const greeting = `${currentAvatar.emoji} Hi! I'm ${currentAvatar.name}, your ${selectedCategory} design companion. Ready to create something amazing?`;

              setCharacterMessage(greeting);
              setShowCharacter(true);
              setIsPlayingMusic(!isPlayingMusic);

              // Make avatar speak
              handleAvatarSpeak(greeting);
            }}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-full shadow-2xl border border-white/20 backdrop-blur-sm hover:scale-110 transition-all duration-300 cursor-pointer group"
            title={`${mainAvatar?.name || 'Design Companion'} - Click to interact`}
          >
            <div className="flex items-center gap-2">
              <div className="text-3xl animate-bounce group-hover:animate-pulse">
                {mainAvatar?.emoji || '✨'}
              </div>
              {isPlayingMusic && (
                <div className="flex items-center gap-1">
                  <div className="w-1 h-3 bg-white/60 rounded animate-pulse"></div>
                  <div className="w-1 h-4 bg-white/80 rounded animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1 h-2 bg-white/60 rounded animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1 h-3 bg-white/60 rounded animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                </div>
              )}
            </div>
          </button>

          {/* Avatar Status Indicator */}
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
        </div>
      </div>

      {/* Health Dashboard - For Judges/Demo */}
      {showHealthDashboard && healthStatus && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">🚀 System Health Dashboard</h2>
              <button
                onClick={() => setShowHealthDashboard(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <span className="text-white font-medium">Overall Status</span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${healthStatus.hackathon_ready ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'}`}>
                  {healthStatus.hackathon_ready ? '✅ DEMO READY' : '⚠️ PARTIAL'}
                </span>
              </div>

              <div className="text-center p-3 bg-indigo-900/50 rounded-lg">
                <div className="text-3xl font-bold text-indigo-400">{healthStatus.integration_score}</div>
                <div className="text-gray-300">AI Models Integrated</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {Object.entries(healthStatus.models).map(([model, info]: [string, any]) => (
                  <div key={model} className="p-3 bg-gray-800 rounded-lg">
                    <div className="font-medium text-white capitalize">{model.replace('_', ' ')}</div>
                    <div className="text-sm text-gray-300">{info.status}</div>
                    {info.role && <div className="text-xs text-gray-400 mt-1">{info.role}</div>}
                  </div>
                ))}
              </div>

              <div className="text-center text-gray-400 text-sm mt-4">
                Last checked: {new Date(healthStatus.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Style-Matched Character Interaction */}
      {showCharacter && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-xl shadow-2xl border border-white/20 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="text-2xl flex-shrink-0 animate-bounce">
                {getStyleCharacter(selectedCategory).emoji}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium leading-relaxed">
                  {characterMessage}
                </p>
                <div className="mt-2 text-xs text-white/80">
                  {getStyleCharacter(selectedCategory).name}
                </div>

                {/* Talk-Back Input - HACKATHON SHOWSTOPPER */}
                {showChatInput && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      placeholder="Talk to me..."
                      className="flex-1 px-2 py-1 text-xs bg-white/20 rounded text-white placeholder-white/60 border border-white/30"
                      onKeyPress={async (e) => {
                        if (e.key === 'Enter' && userInput.trim()) {
                          const character = getStyleCharacter(selectedCategory);

                          // Generate smart response using HuggingFace
                          try {
                            const response = await fetch('/generate-character-dialogue', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                style: selectedCategory,
                                action: 'chat_response',
                                character_name: character.name,
                                user_input: userInput
                              })
                            });

                            if (response.ok) {
                              const dialogueData = await response.json();
                              const smartResponse = `${character.emoji} ${dialogueData.dialogue}`;
                              setCharacterMessage(smartResponse);
                              handleAvatarSpeak(dialogueData.dialogue);
                            } else {
                              // Fallback to simple responses
                              const fallbackResponse = `${character.emoji} ${userInput.toLowerCase().includes('help') ? 'I\'m here to help with your design!' : userInput.toLowerCase().includes('thanks') ? 'You\'re welcome! Happy designing!' : 'That\'s interesting! Tell me more about your style preferences.'}`;
                              setCharacterMessage(fallbackResponse);
                              handleAvatarSpeak(fallbackResponse);
                            }
                          } catch (error) {
                            console.error('Smart chat failed:', error);
                            const fallbackResponse = `${character.emoji} I'm here to help with your ${selectedCategory} design!`;
                            setCharacterMessage(fallbackResponse);
                          }

                          setUserInput('');
                        }
                      }}
                    />
                  </div>
                )}

                <button
                  onClick={() => setShowChatInput(!showChatInput)}
                  className="mt-2 text-xs text-white/60 hover:text-white underline"
                >
                  {showChatInput ? 'Hide Chat' : '💬 Chat with me'}
                </button>
              </div>
              <button
                onClick={() => setShowCharacter(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App GLB Viewer Modal */}
      {showGLBViewer && glbViewerUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="GLB-modal bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-4xl h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div>
                <h3 className="text-xl font-bold text-white">Ultra-High Quality 3D Model</h3>
                <p className="text-gray-400 text-sm">Interactive preview • File downloading in background</p>
              </div>
              <button
                onClick={() => setShowGLBViewer(false)}
                className="action-button"
                title="Close Viewer"
              >
                <XIcon />
              </button>
            </div>

            {/* 3D Viewer with Optional Side-by-Side */}
            <div className="flex-1 relative flex">
              {/* 3D Model */}
              <div className={`${show3DComparison ? 'w-2/3' : 'w-full'} relative`}>
                <model-viewer
                  src={glbViewerUrl}
                  alt="3D room model"
                  camera-controls
                  auto-rotate
                  camera-orbit="0deg 75deg 2m"
                  min-camera-orbit="auto auto 0.5m"
                  max-camera-orbit="auto auto 8m"
                  field-of-view="35deg"
                  interaction-prompt="auto"
                  touch-action="pan-y"
                  style={{ width: '100%', height: '100%' }}
                  onError={(e) => {
                    console.error('GLB viewer error:', e);
                    setShowGLBViewer(false);
                  }}
                />
              </div>

              {/* Side-by-Side Original Image */}
              {show3DComparison && (originalImage || imageUrl) && (
                <div className="w-1/3 bg-gray-800 border-l border-gray-600 flex flex-col">
                  <div className="p-4 border-b border-gray-600">
                    <h4 className="text-white font-medium">Original Image</h4>
                    <p className="text-gray-400 text-sm">Compare with 3D model</p>
                  </div>
                  <div className="flex-1 p-4">
                    <img 
                      src={originalImage || imageUrl} 
                      alt="Original room" 
                      className="w-full h-full object-contain rounded-lg"
                    />
                  </div>
                </div>
              )}

              {/* Enhanced Controls Overlay */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-center">
                <div className="flex items-center gap-2 p-3 bg-black/60 backdrop-blur-md rounded-full border border-white/20 shadow-xl">
                  <button
                    onClick={() => setShow3DComparison(!show3DComparison)}
                    className={`action-button ${show3DComparison ? 'bg-indigo-600' : ''}`}
                    title="Compare with Original"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                  </button>
                  <button
                    onClick={handleDownloadGLB}
                    className="action-button bg-indigo-600 hover:bg-indigo-700"
                    title="Download Ultra-HQ GLB"
                  >
                    <DownloadIcon />
                  </button>
                  <button
                    onClick={handleOpenGLB}
                    className="action-button"
                    title="Open in New Tab"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </button>
                  <button
                    onClick={handleCopyGLBUrl}
                    className="action-button"
                    title="Copy Model URL"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      const modalViewer = document.querySelector('.GLB-modal model-viewer');
                      if (modalViewer) {
                        modalViewer.cameraOrbit = '0deg 75deg 2m';
                        modalViewer.fieldOfView = '35deg';
                      }
                    }}
                    className="action-button"
                    title="Reset Camera"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  </button>
                  <div className="h-6 w-px bg-white/30 mx-1"></div>
                  <span className="text-xs text-white/70 px-2">Ultra-HQ • 512px Resolution</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Smart Chat Interface */}
      {showChatInput && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-600 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getStyleCharacter(selectedCategory).emoji}</span>
                <div>
                  <h3 className="text-lg font-semibold text-white">{getStyleCharacter(selectedCategory).name}</h3>
                  <p className="text-sm text-gray-400">{selectedCategory} Design Expert</p>
                </div>
              </div>
              <button
                onClick={() => setShowChatInput(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <XIcon />
              </button>
            </div>

            <div className="mb-4">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={getRandomChatPrompt(selectedCategory)}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleChatWithAvatar(userInput);
                  }
                }}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleChatWithAvatar(userInput)}
                disabled={!userInput.trim() || loading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {loading ? 'Thinking...' : 'Ask'}
              </button>
              <button
                onClick={() => {
                  const colorPrompt = getRandomChatPrompt(selectedCategory);
                  setUserInput(colorPrompt);
                  handleChatWithAvatar(colorPrompt);
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors text-sm"
              >
                🎲 Inspire
              </button>
            </div>

            <div className="mt-3 text-xs text-gray-500 text-center">
              💬 Powered by local LM Studio • 🛡️ Design-focused guardrails
            </div>
          </div>
        </div>
      )}

      {/* Character Message Display */}
      {showCharacter && characterMessage && (
        <div className="fixed bottom-4 right-4 z-40 max-w-sm">
          <div className="bg-gray-800 border border-gray-600 rounded-2xl p-4 shadow-2xl backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">{getStyleCharacter(selectedCategory).emoji}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-white">{getStyleCharacter(selectedCategory).name}</h4>
                  <button
                    onClick={() => setShowCharacter(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{characterMessage}</p>
                <button
                  onClick={() => setShowChatInput(true)}
                  className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  💬 Continue conversation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Chat Button - Always available when we have content */}
      {!showChatInput && !showCharacter && (imageUrl || loading) && (
        <button
          onClick={() => setShowChatInput(true)}
          className="fixed bottom-4 right-4 z-30 bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full shadow-lg transition-all hover:scale-105"
          title="Chat with design expert"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default App;