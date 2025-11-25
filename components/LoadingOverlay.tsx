import React from 'react';

interface LoadingOverlayProps {
  message: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message }) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
      <div className="relative w-24 h-24 mb-8">
        <div className="absolute inset-0 border-4 border-zinc-800 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-t-indigo-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
      </div>
      <h2 className="text-2xl font-light text-white tracking-wide animate-pulse">{message}</h2>
      <p className="text-zinc-500 mt-2 text-sm">Powered by Gemini 3 Pro</p>
    </div>
  );
};