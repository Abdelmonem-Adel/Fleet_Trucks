import React, { useState } from 'react';
import axios from 'axios';
import { UploadCloud, CheckCircle } from 'lucide-react';

const FileUpload = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setSuccess(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const response = await axios.post('http://localhost:5000/api/orders/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onUploadSuccess(response.data);
      setSuccess(true);
      setFile(null);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 flex flex-col">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-800">Upload Daily Orders</h3>
        <p className="text-xs text-slate-400">Import Odoo daily stock moves / branch order sheet</p>
      </div>
      
      <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors relative mb-4">
        <input 
          type="file" 
          accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleFileChange}
          disabled={uploading}
        />
        <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none">
          {success ? (
            <CheckCircle className="w-12 h-12 text-green-500" />
          ) : (
            <UploadCloud className="w-12 h-12 text-indigo-400" />
          )}
          
          <div className="text-sm font-medium text-slate-600">
            {file ? file.name : (success ? 'Uploaded successfully!' : 'Drag and drop or click to select')}
          </div>
          {!file && !success && (
            <div className="text-xs text-slate-400">Supports CSV, Excel</div>
          )}
        </div>
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className={`mt-4 w-full py-2.5 rounded-xl text-white font-medium transition-all ${
          !file || uploading 
            ? 'bg-slate-300 cursor-not-allowed' 
            : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-indigo-200'
        }`}
      >
        {uploading ? 'Processing...' : 'Analyze and Upload'}
      </button>
    </div>
  );
};

export default FileUpload;
