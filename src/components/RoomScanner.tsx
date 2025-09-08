import React, { useState } from "react";
import NarrationPlayer from "./NarrationPlayer";

function RoomScanner() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [segmentedImage, setSegmentedImage] = useState<string | null>(null);
  const [stylizedImage, setStylizedImage] = useState<string | null>(null);
  const [style, setStyle] = useState<string>("Modern");

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  // Upload & run segmentation
  const handleUpload = async () => {
    if (!selectedFile) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      // 1) Segmentation API
      const segmentationResponse = await fetch("/api/segment-room", {
        method: "POST",
        body: formData,
      });
      const segmentationData = await segmentationResponse.json();
      setSegmentedImage(segmentationData.url);

      // 2) Stylization API
      const stylizationResponse = await fetch("/api/stylize-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: segmentationData.url, style }),
      });
      const stylizationData = await stylizationResponse.json();
      setStylizedImage(stylizationData.url);

    } catch (err) {
      console.error("Processing error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="room-scanner">
      <h2>Upload & Transform Your Room</h2>

      <input type="file" accept="image/*" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={!selectedFile || loading}>
        {loading ? "Processing..." : "Scan Room"}
      </button>

      <div className="style-picker">
        <label>Select Style: </label>
        <select value={style} onChange={(e) => setStyle(e.target.value)}>
          <option value="Modern">Modern</option>
          <option value="Classic">Classic</option>
          <option value="Minimalist">Minimalist</option>
          <option value="Industrial">Industrial</option>
        </select>
      </div>

      {segmentedImage && (
        <div>
          <h3>Segmented Room</h3>
          <img src={segmentedImage} alt="Segmented room" width="400" />
        </div>
      )}

      {stylizedImage && (
        <div>
          <h3>Stylized Room</h3>
          <img src={stylizedImage} alt="Stylized room" width="400" />
          {/* Voiceover for this style */}
          <NarrationPlayer style={style} />
        </div>
      )}
    </div>
  );
}

export default RoomScanner;