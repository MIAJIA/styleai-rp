"use client";

import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";


interface ZeroStepProps {
    onValidationChange: (isValid: boolean) => void;
  }
  

export default function OnBoardingZero({ onValidationChange }: ZeroStepProps) {
    const { data: session } = useSession();
    const router = useRouter();
      // must be logged in to continue
    if (session) {
        onValidationChange(true);
    }

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-gray-800">
                    Unlock fresh outfits from your current wardrobe
                </h2>
                <p className="text-gray-600">
                    Dress Confidently & Shop Smartly
                </p>
            </div>
            <div className="flex justify-center">
                {!session && (
                    <button className='border border-black rounded-lg px-5 py-1 bg-black text-white hover:bg-gray-800 transition-colors' onClick={() => router.push('/login')}>Login</button>
                )}
            </div>
        </div>
    )
}