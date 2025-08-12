"use client";

import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Message {
    id: number;
    text?: string;
    isUser: boolean;
    image?: string[]; // 可选的图片URL
}

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

    const [messages, setMessages] = useState<Message[]>([
        {
            id: 1,
            text: "Style these wide-leg pants for me.",
            isUser: true,
        },
        {
            id: 2,
            isUser: true,
            image: ["/onboarding/zero/messages-1.png", "/onboarding/zero/messages-2.png"]
        },
        {
            id: 3,
            text: "Here are three stylish ways:",
            isUser: false,
        },
        {
            id: 4,
            isUser: false,
            image: ["/onboarding/zero/messages-3.png", "/onboarding/zero/messages-4.png", "/onboarding/zero/messages-5.png"]
        }
    ]);


    return (
        <div className="max-w-2xl mx-auto p-4 h-screen flex flex-col">

            <div className="text-center space-y-2 mb-4">
                <h2 className="text-2xl font-bold text-gray-800">
                    Unlock fresh outfits from your current wardrobe
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}
                    >
                        <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow-lg border ${
                                message.isUser
                                    ? "bg-pink-200 text-black text-right border-pink-200 shadow-gray-200"
                                    : "bg-white text-black border-gray-200 shadow-gray-200"
                                }`}
                        >
                            <p className="text-sm">{message.text}</p>
                            {message.image && message.image.length > 0 && (
                                <div className="mt-2">
                                    {message.image.length === 1 ? (
                                        <img
                                            src={message.image[0]}
                                            alt="Message image"
                                            className="w-full h-48 rounded-lg object-cover"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    ) : (
                                        <div className={`grid gap-2 ${message.image.length === 2 ? 'grid-cols-2' :
                                            message.image.length === 3 ? 'grid-cols-3' :
                                                message.image.length === 4 ? 'grid-cols-2' : 'grid-cols-3'
                                            }`}>
                                            {message.image.map((imgSrc, index) => (
                                                <img
                                                    key={index}
                                                    src={imgSrc}
                                                    alt={`Message image ${index + 1}`}
                                                    // className={`w-full h-auto rounded-lg  ${message.isUser? "max-h-24" : "max-h-26"}  object-cover object-top`}
                                                    className={`w-full  ${message.isUser? "h-32" : "h-48"}  rounded-lg object-cover object-top`}
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}