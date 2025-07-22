import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

export default function App() {
  const [files, setFiles] = useState([]);
  const [copies, setCopies] = useState(1);
  const [isColor, setIsColor] = useState(false); // New state for color option
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [lastJobId, setLastJobId] = useState(''); // New state to hold the Job ID

  const onDrop = useCallback(acceptedFiles => {
    setFiles([acceptedFiles[0]]);
    setLastJobId(''); // Clear previous job ID when a new file is selected
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false
  });

  const handleUpload = async () => {
    if (files.length === 0) {
      setUploadStatus('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setUploadStatus('Status: Getting upload permission...');
    setLastJobId('');

    const file = files[0];
    const apiEndpoint = 'https://wu5y9rz6db.execute-api.ap-south-1.amazonaws.com/default/lambda_print';

    try {
      setUploadStatus('Status: Requesting secure upload URL...');
      const presignedResponse = await fetch(`${apiEndpoint}?fileName=${encodeURIComponent(file.name)}&fileType=${encodeURIComponent(file.type)}`);
      if (!presignedResponse.ok) {
        throw new Error('Failed to get pre-signed URL from the server.');
      }
      const { uploadURL, key } = await presignedResponse.json();

      setUploadStatus('Status: Uploading file directly to storage...');
      const s3Response = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });

      if (!s3Response.ok) {
        throw new Error('Secure storage upload failed.');
      }
      
      setUploadStatus('Status: Logging print job...');
      const fileUrl = `https://${new URL(uploadURL).hostname}/${key}`;
      const logResponse = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              FileUrl: fileUrl,
              FileName: file.name,
              Copies: copies,
              IsColor: isColor // Sending the color preference
          })
      });
      const logData = await logResponse.json(); // Capture the response
      setLastJobId(logData.jobId); // Save the returned Job ID

      setUploadStatus(`Success! "${file.name}" is now in the print queue.`);
      setFiles([]);
    } catch (error) {
      console.error('Upload Error:', error);
      setUploadStatus(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (fileName) => {
    setFiles(files.filter(file => file.name !== fileName));
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center font-sans p-4">
      <div className="w-full max-w-2xl bg-gray-800 rounded-2xl shadow-2xl p-8 space-y-6 border border-cyan-500/20">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-cyan-400">College Print Service</h1>
          <p className="text-gray-400 mt-2">Upload your PDF and we'll handle the rest.</p>
        </div>

        <div {...getRootProps()} className={`border-4 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-300 ${isDragActive ? 'border-cyan-400 bg-gray-700' : 'border-gray-600 hover:border-cyan-500 hover:bg-gray-700/50'}`}>
          <input {...getInputProps()} />
          <p className="text-lg">
            {isDragActive ? 'Drop the PDF here...' : "Drag 'n' drop a PDF here, or click to select"}
          </p>
          <p className="text-sm text-gray-500 mt-1">Only a single PDF file will be accepted</p>
        </div>

        {files.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg text-gray-300">Selected File:</h3>
            {files.map(file => (
              <div key={file.name} className="flex justify-between items-center bg-gray-700 p-3 rounded-lg animate-fade-in">
                <span className="truncate pr-4">{file.name}</span>
                <button onClick={() => removeFile(file.name)} className="text-red-500 hover:text-red-400 font-bold text-2xl leading-none transition-transform duration-200 hover:scale-110">&times;</button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-around pt-2">
            <div className="flex items-center space-x-4">
                <label htmlFor="copies" className="font-semibold text-lg">Copies:</label>
                <input type="number" id="copies" min="1" value={copies} onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10)))}
                className="bg-gray-700 border border-gray-600 rounded-lg p-2 w-24 text-center focus:ring-2 focus:ring-cyan-400 focus:outline-none"/>
            </div>
            <div className="flex items-center space-x-3">
                <input type="checkbox" id="isColor" checked={isColor} onChange={(e) => setIsColor(e.target.checked)}
                className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-600"/>
                <label htmlFor="isColor" className="font-semibold text-lg">Print in Color</label>
            </div>
        </div>

        <button
          onClick={handleUpload}
          disabled={uploading || files.length === 0}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-gray-900 font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center text-lg shadow-lg hover:shadow-cyan-500/40"
        >
          {uploading ? (
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : 'Upload and Print'}
        </button>

        {lastJobId && (
            <div className="text-center bg-green-900/50 border border-green-500 rounded-lg p-3 mt-4 animate-fade-in">
                <p className="text-sm text-gray-300">Your Job ID is:</p>
                <p className="font-mono text-lg text-green-400 break-all">{lastJobId}</p>
                <p className="text-xs text-gray-400 mt-2">Please save this ID to check your print status later.</p>
            </div>
        )}

        {uploadStatus && !lastJobId && (
          <p className="text-center text-sm text-gray-400 h-5">{uploadStatus}</p>
        )}
      </div>
      <style>{`
        .animate-fade-in {
          animation: fadeIn 0.5s ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
