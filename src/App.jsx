import { useState, useRef } from "react";
import "./App.css";

function App() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [processedFiles, setProcessedFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  // File selection handler
  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    processFiles(files);
  };

  // Process files (used by both file input and drag & drop)
  const processFiles = (files) => {
    if (files.length === 0) return;

    // Filter PNG files
    const pngFiles = files.filter((file) => file.type === "image/png");

    if (pngFiles.length !== files.length) {
      alert("Please select only PNG files!");
    }

    // Maximum 10 files check
    if (pngFiles.length > 10) {
      alert("You can select maximum 10 files!");
      return;
    }

    // Save files with preview URLs
    const filesWithPreview = pngFiles.map((file) => ({
      file,
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
      processed: false,
    }));

    setSelectedFiles(filesWithPreview);
    setProcessedFiles([]); // Clear previous processed files
  };

  // Drag & Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragOver to false if we're leaving the upload area completely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  // Remove single file
  const removeFile = (fileId) => {
    const fileToRemove = selectedFiles.find((file) => file.id === fileId);
    if (fileToRemove) {
      // Clean up URL
      URL.revokeObjectURL(fileToRemove.previewUrl);
    }

    // Remove file from list
    setSelectedFiles((prev) => prev.filter((file) => file.id !== fileId));

    // Clear processed files if no files remain
    const remainingFiles = selectedFiles.filter((file) => file.id !== fileId);
    if (remainingFiles.length === 0) {
      setProcessedFiles([]);
    }
  };

  // Single file cropping process
  const cropSingleFile = (fileData) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        // Set canvas size to image size
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw image to canvas
        ctx.drawImage(img, 0, 0);

        // Get image pixel data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        let minX = canvas.width;
        let minY = canvas.height;
        let maxX = 0;
        let maxY = 0;

        // Find non-transparent pixels
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const index = (y * canvas.width + x) * 4;
            const alpha = data[index + 3]; // Alpha channel

            // If pixel is not transparent (alpha > 0)
            if (alpha > 0) {
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            }
          }
        }

        // If no non-transparent pixels found
        if (minX >= canvas.width || minY >= canvas.height) {
          resolve(null); // Error case
          return;
        }

        // Crop area dimensions
        const cropWidth = maxX - minX + 1;
        const cropHeight = maxY - minY + 1;

        // Create new canvas (cropped size)
        const croppedCanvas = document.createElement("canvas");
        const croppedCtx = croppedCanvas.getContext("2d");

        croppedCanvas.width = cropWidth;
        croppedCanvas.height = cropHeight;

        // Draw cropped area to new canvas
        croppedCtx.drawImage(
          canvas,
          minX,
          minY,
          cropWidth,
          cropHeight,
          0,
          0,
          cropWidth,
          cropHeight
        );

        // Get cropped image as blob and create URL
        croppedCanvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          resolve({
            ...fileData,
            croppedUrl: url,
            croppedBlob: blob,
            processed: true,
          });
        }, "image/png");
      };

      img.onerror = () => resolve(null);
      img.src = fileData.previewUrl;
    });
  };

  // Crop all files process
  const cropAllFiles = async () => {
    if (selectedFiles.length === 0) {
      alert("Please select PNG files first!");
      return;
    }

    setIsProcessing(true);

    const processedResults = [];

    for (const fileData of selectedFiles) {
      try {
        const result = await cropSingleFile(fileData);
        if (result) {
          processedResults.push(result);
        } else {
          alert(`No visible content found in ${fileData.name}!`);
        }
      } catch (error) {
        console.error(`Error processing ${fileData.name}:`, error);
        alert(`Error occurred while processing ${fileData.name}!`);
      }
    }

    setProcessedFiles(processedResults);
    setIsProcessing(false);
  };

  // Download single file
  const downloadFile = (fileData) => {
    if (!fileData.croppedUrl) return;

    const link = document.createElement("a");
    link.href = fileData.croppedUrl;
    link.download = `cropped_${fileData.name}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download all files
  const downloadAllFiles = () => {
    processedFiles.forEach((fileData, index) => {
      setTimeout(() => {
        downloadFile(fileData);
      }, index * 200); // 200ms delay between each file
    });
  };

  // Trigger file input click
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Clear all files
  const clearFiles = () => {
    // Clean up URLs
    selectedFiles.forEach((file) => URL.revokeObjectURL(file.previewUrl));
    processedFiles.forEach((file) => {
      if (file.croppedUrl) URL.revokeObjectURL(file.croppedUrl);
    });

    setSelectedFiles([]);
    setProcessedFiles([]);

    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="app">
      <div className="container">
        <h1>PNG Frame Editor</h1>
        <p>Remove unnecessary spaces from your PNG images (Maximum 10 files)</p>

        {/* File Upload Area */}
        <div className="upload-section">
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,image/png"
            multiple
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />

          <div
            className={`upload-area ${
              selectedFiles.length > 0 ? "has-file" : ""
            } ${isDragOver ? "drag-over" : ""}`}
            onClick={triggerFileInput}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {selectedFiles.length > 0 ? (
              <div className="file-info">
                <span className="file-name">
                  📁 {selectedFiles.length} files selected
                </span>
                <span className="file-size">
                  (
                  {(
                    selectedFiles.reduce(
                      (total, file) => total + file.size,
                      0
                    ) / 1024
                  ).toFixed(1)}{" "}
                  KB)
                </span>
              </div>
            ) : (
              <div className="upload-placeholder">
                <span className="upload-icon">📷</span>
                <span>
                  {isDragOver
                    ? "Drop PNG files here"
                    : "Select PNG files or drag them here"}
                </span>
                <small>(Maximum 10 files)</small>
              </div>
            )}
          </div>
        </div>

        {/* Selected Files Preview */}
        {selectedFiles.length > 0 && (
          <div className="selected-files-section">
            <h3>Selected Files ({selectedFiles.length}/10):</h3>
            <div className="files-grid">
              {selectedFiles.map((fileData) => (
                <div key={fileData.id} className="file-card">
                  <button
                    className="remove-file-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(fileData.id);
                    }}
                    title="Remove file"
                  >
                    ✕
                  </button>

                  <img
                    src={fileData.previewUrl}
                    alt={fileData.name}
                    className="file-thumbnail"
                  />
                  <div className="file-name">{fileData.name}</div>
                  <div className="file-size">
                    {(fileData.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {selectedFiles.length > 0 && (
          <div className="action-section">
            <button
              className="crop-button"
              onClick={cropAllFiles}
              disabled={isProcessing}
            >
              {isProcessing ? "⏳ Processing..." : "✂️ Crop All"}
            </button>

            <button
              className="clear-button"
              onClick={clearFiles}
              disabled={isProcessing}
            >
              🗑️ Clear
            </button>
          </div>
        )}

        {/* Processed Files Table */}
        {processedFiles.length > 0 && (
          <div className="results-section">
            <div className="results-header">
              <h3>Processed Files ({processedFiles.length}):</h3>
              <button
                className="download-all-button"
                onClick={downloadAllFiles}
              >
                📦 Download All
              </button>
            </div>

            <div className="results-table">
              <div className="table-header">
                <div>Image</div>
                <div>File Name</div>
                <div>Action</div>
              </div>

              {processedFiles.map((fileData) => (
                <div key={fileData.id} className="table-row">
                  <div className="table-cell image-cell">
                    <img
                      src={fileData.croppedUrl}
                      alt={fileData.name}
                      className="result-thumbnail"
                    />
                  </div>

                  <div className="table-cell name-cell">
                    <div className="file-details">
                      <div className="original-name">{fileData.name}</div>
                      <div className="cropped-name">
                        cropped_{fileData.name}
                      </div>
                    </div>
                  </div>

                  <div className="table-cell action-cell">
                    <button
                      className="download-button"
                      onClick={() => downloadFile(fileData)}
                    >
                      💾 Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hidden Canvas */}
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </div>
  );
}

export default App;
