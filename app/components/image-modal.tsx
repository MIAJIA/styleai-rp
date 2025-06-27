"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, Share2, Heart } from "lucide-react";
import ImageVoteButtons from "@/components/image-vote-buttons";
import { cn } from "@/lib/utils";

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
  sessionId?: string;
}

export default function ImageModal({ isOpen, onClose, imageUrl, title, sessionId }: ImageModalProps) {
  const [isLoading, setIsLoading] = useState(true);

  if (!isOpen) return null;

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `styleme-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: open image directly
      window.open(imageUrl, '_blank');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title || 'My StyleMe Look',
          text: 'Check out my new look created with StyleMe!',
          url: window.location.href,
        });
      } catch (error) {
        console.error('Share failed:', error);
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      // TODO: Show success message on copy
      console.log('Link copied to clipboard');
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Background overlay */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative z-10 w-full max-w-lg mx-4">
        {/* Close button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute -top-12 right-0 text-white hover:bg-white/20 z-20"
        >
          <X className="w-5 h-5" />
        </Button>

        {/* Image container */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <img
              src={imageUrl}
              alt={title || "Generated look"}
              className={cn(
                "w-full h-auto max-h-[70vh] object-contain",
                isLoading ? "opacity-0" : "opacity-100"
              )}
              onLoad={() => setIsLoading(false)}
              onError={() => setIsLoading(false)}
            />
          </div>

          {/* Action buttons */}
          <div className="p-4 border-t border-gray-100">
            {/* Vote buttons */}
            <div className="flex justify-center mb-4">
              <ImageVoteButtons
                imageUrl={imageUrl}
                sessionId={sessionId}
                size="md"
                variant="default"
                onVoteChange={(voteType) => {
                  console.log(`[ImageModal] Image vote changed: ${voteType} for ${imageUrl}`);
                }}
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleDownload}
                variant="outline"
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Save Image
              </Button>
              <Button
                onClick={handleShare}
                className="flex-1 bg-[#FF6EC7] hover:bg-[#FF6EC7]/90"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>

            {title && (
              <p className="text-sm text-gray-600 text-center mt-3">
                {title}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
