import React, { useEffect, useRef } from "react";

const NarrationPlayer = ({ audioUrl, onFinished }) => {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play().catch(err => {
        console.error("Autoplay failed, user interaction needed:", err);
      });
    }
  }, [audioUrl]);

  return (
    <div className="flex flex-col items-center justify-center">
      {audioUrl ? (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={onFinished}
          controls={false}
        />
      ) : (
        <p className="text-gray-500 italic">Preparing narration...</p>
      )}
    </div>
  );
};

export default NarrationPlayer;