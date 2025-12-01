import React, { useCallback, useState } from 'react';
import { UploadedImage } from '@/app/gemini/type';

interface UploadZoneProps {
  onImagesSelected: (images: UploadedImage[]) => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onImagesSelected }) => {
  const [urlInput, setUrlInput] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const processFile = (file: File): Promise<UploadedImage> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          id: Math.random().toString(36).substr(2, 9),
          file,
          previewUrl: URL.createObjectURL(file),
          base64: e.target?.result as string
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const promises = Array.from(files).map(processFile);
    Promise.all(promises).then(uploaded => {
      onImagesSelected(uploaded);
    });
  }, [onImagesSelected]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleUrlUpload = async () => {
    if (!urlInput.trim()) return;
    setIsFetching(true);
    setErrorMsg('');

    try {
      // Attempt to fetch the URL
      const response = await fetch(urlInput);
      if (!response.ok) throw new Error(`Connection failed: ${response.statusText}`);
      
      const contentType = response.headers.get('content-type');
      let blob: Blob;

      // Smart extraction: If HTML, look for og:image
      if (contentType && contentType.includes('text/html')) {
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        // Try og:image or twitter:image or link[rel=image_src]
        const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                        doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content') ||
                        doc.querySelector('link[rel="image_src"]')?.getAttribute('href');
        
        if (ogImage) {
           // Resolve relative URLs if needed
           const imgUrl = new URL(ogImage, urlInput).toString();
           const imgResponse = await fetch(imgUrl);
           blob = await imgResponse.blob();
        } else {
           throw new Error('Could not find a main product image on this page. Try a direct image link.');
        }
      } else {
        blob = await response.blob();
      }

      if (!blob || !blob.type.startsWith('image/')) {
        throw new Error('The URL did not return a valid image file.');
      }

      const file = new File([blob], "imported-from-url.jpg", { type: blob.type });
      const image = await processFile(file);
      onImagesSelected([image]);
      setUrlInput('');
    } catch (err: any) {
      console.error(err);
      let msg = 'Failed to load.';
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
         msg = 'Security Block (CORS): This website prevents direct access. Try right-clicking the image, "Copy Image Address", and pasting that.';
      } else {
         msg = err.message;
      }
      setErrorMsg(msg);
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Drag & Drop Area */}
      <div 
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="border-2 border-dashed border-blue-300 hover:border-blue-400 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-gradient-to-br from-blue-50 to-indigo-50 group shadow-sm hover:shadow-md"
      >
        <div className="w-16 h-16 mb-4 bg-blue-100 group-hover:bg-blue-200 rounded-full flex items-center justify-center text-blue-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-blue-900 mb-2">Upload Files</h3>
        <p className="text-blue-700 mb-6 text-sm">Drag & drop clothing items <br/> (Tops, Bottoms, Shoes, Accessories)</p>
        <label className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition cursor-pointer text-sm shadow-sm">
          Browse Files
          <input 
            type="file" 
            multiple 
            accept="image/*" 
            className="hidden" 
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      </div>

      {/* URL Import Area */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-px bg-blue-200 flex-1"></div>
          <span className="text-blue-600 text-xs font-medium uppercase tracking-wider">Or Import from URL</span>
          <div className="h-px bg-blue-200 flex-1"></div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm">
           <div className="flex gap-2">
              <input 
                type="text" 
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste product or image URL..."
                className="flex-1 bg-white border border-blue-300 rounded-lg px-3 py-2 text-sm text-blue-900 placeholder-blue-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleUrlUpload()}
              />
              <button 
                onClick={handleUrlUpload}
                disabled={isFetching || !urlInput}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
              >
                {isFetching ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Fetching
                  </>
                ) : (
                  'Import'
                )}
              </button>
           </div>
           {errorMsg && (
             <div className="mt-2 text-red-600 text-xs flex items-start gap-1.5 bg-red-50 border border-red-200 p-2 rounded">
               <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
               {errorMsg}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};