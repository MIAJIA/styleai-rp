 "use client";

import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { StepProps } from "./on-boarding-step";

// 肤色选项数据
const SKIN_TONE_OPTIONS = [
    {
        id: "very-light",
        label: "Very Light",
        color: "#FFDBB4",
        description: "Fair skin tone"
    },
    {
        id: "light",
        label: "Light",
        color: "#EDB98A",
        description: "Light skin tone"
    },
    {
        id: "medium-light",
        label: "Medium Light",
        color: "#D08B5B",
        description: "Medium light skin tone"
    },
    {
        id: "medium",
        label: "Medium",
        color: "#AE5D29",
        description: "Medium skin tone"
    },
    {
        id: "medium-dark",
        label: "Medium Dark",
        color: "#8D4A43",
        description: "Medium dark skin tone"
    },
    {
        id: "dark",
        label: "Dark",
        color: "#5C3836",
        description: "Dark skin tone"
    },
    {
        id: "very-dark",
        label: "Very Dark",
        color: "#2C1810",
        description: "Very dark skin tone"
    }
];

// 体型选项数据
const BODY_TYPE_OPTIONS = [
    {
        id: "Hourglass",
        label: "Hourglass",
        image: "/onboarding/BodyType/hourglass.jpeg",
    },
    {
        id: "Pear",
        label: "Pear",
        image: "/onboarding/BodyType/pear.jpeg",
    },
    {
        id: "Triangle",
        label: "Triangle",
        image: "/onboarding/BodyType/triangle.jpeg",
    },
    {
        id: "Inverted Triangle",
        label: "Inverted",
        image: "/onboarding/BodyType/invertedTriangle.jpeg",
    },
    {
        id: "Rectangle",
        label: "Rectangle",
        image: "/onboarding/BodyType/rectangle.jpeg",
    },
    {
        id: "Apple",
        label: "Apple",
        image: "/onboarding/BodyType/apple.jpeg",
    }
];

// 身体量感结构选项数据
const BODY_STRUCTURE_OPTIONS = [
    {
        id: "Petite",
        label: "Petite",
        image: "/onboarding/BodyStructure/petite.jpeg",
    },
    {
        id: "Slim",
        label: "Slim",
        image: "/onboarding/BodyStructure/slim.jpeg",
    },
    {
        id: "Average",
        label: "Average",
        image: "/onboarding/BodyStructure/average.jpeg",
    },
    {
        id: "Chubby",
        label: "Chubby",
        image: "/onboarding/BodyStructure/chubby.jpeg",
    },
    {
        id: "Plus-size",
        label: "Plus-size",
        image: "/onboarding/BodyStructure/plus.jpeg",
    }
];

// 脸型选项数据
const FACE_SHAPE_OPTIONS = [
    {
        id: "oval",
        label: "Oval",
        icon: "🥚",
        description: "Balanced and versatile"
    },
    {
        id: "round",
        label: "Round",
        icon: "⭕",
        description: "Soft and circular"
    },
    {
        id: "square",
        label: "Square",
        icon: "⬜",
        description: "Strong and angular"
    },
    {
        id: "heart",
        label: "Heart",
        icon: "💝",
        description: "Wide forehead,pointed chin"
    }
];

function FaceShape(selectedFaceShape: string, setSelectedFaceShape: (value: string) => void){
    return (
        <div className="space-y-4">
            {/* 脸型选择器 */}
            <div className="space-y-4">
                    <div className="text-left space-y-2">
                        <p className="text-sm text-gray-600">
                            Face Shape
                        </p>
                    </div>
    
                    <RadioGroup
                        value={selectedFaceShape}
                        onValueChange={setSelectedFaceShape}
                        className="grid grid-cols-2 md:grid-cols-4 gap-3"
                    >
                        {FACE_SHAPE_OPTIONS.map((option) => (
                            <div key={option.id} className="flex">
                                <RadioGroupItem
                                    value={option.id}
                                    id={option.id}
                                    className="peer sr-only"
                                />
                                <label
                                    htmlFor={option.id}
                                    className="flex flex-col items-center p-3 rounded-lg border-2 border-gray-200 cursor-pointer transition-all duration-200 hover:border-primary/50 hover:shadow-md peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:shadow-md peer-data-[state=checked]:opacity-100 peer-data-[state=checked]:scale-105 peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary/20 opacity-60 hover:opacity-80 hover:scale-102"
                                >
                                    {/* 脸型图标 */}
                                    <div className="text-2xl mb-2">
                                        {option.icon}
                                    </div>
                                    
                                    {/* 标签和描述 */}
                                    <div className="text-center space-y-1">
                                        <span className="text-sm font-medium text-gray-900 peer-data-[state=checked]:text-primary">
                                            {option.label}
                                        </span>
                                        <p className="text-xs text-gray-500">
                                            {option.description}
                                        </p>
                                    </div>
                                </label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>
    
                {/* 脸型选择提示信息 */}
                {selectedFaceShape && (
                    <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <p className="text-sm text-orange-800 text-center">
                            Selected: <span className="font-medium">{FACE_SHAPE_OPTIONS.find(opt => opt.id === selectedFaceShape)?.label}</span>
                        </p>
                    </div>
                )}
            </div>
    )
}

export default function OnBoardingFive({ data, onUpdate, onValidationChange }: StepProps) {
    const [selectedSkinTone, setSelectedSkinTone] = useState<string>(data.skinTone || "");
    const [selectedBodyType, setSelectedBodyType] = useState<string>(data.bodyType || "");
    const [selectedBodyStructure, setSelectedBodyStructure] = useState<string>(data.bodyStructure || "");
    const [selectedFaceShape, setSelectedFaceShape] = useState<string>(data.faceShape || "");

    // 当data更新时，同步状态
    useEffect(() => {
        setSelectedSkinTone(data.skinTone || "");
        setSelectedBodyType(data.bodyType || "");
        setSelectedBodyStructure(data.bodyStructure || "");
        setSelectedFaceShape(data.faceShape || "round");
    }, [data]);

    // 当选择改变时，更新数据
    useEffect(() => {
        onUpdate({
            skinTone: selectedSkinTone,
            bodyType: selectedBodyType,
            bodyStructure: selectedBodyStructure,
            faceShape: selectedFaceShape
        });
    }, [selectedSkinTone, selectedBodyType, selectedBodyStructure, selectedFaceShape, onUpdate]);

    // 验证逻辑：必须选择一个肤色、一个体型、一个身体量感结构和脸型
    useEffect(() => {
        const isValid = selectedSkinTone !== "" && selectedBodyType !== "" && selectedBodyStructure !== "" && selectedFaceShape !== "";
        onValidationChange(isValid);
    }, [selectedSkinTone, selectedBodyType, selectedBodyStructure, selectedFaceShape, onValidationChange]);

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-gray-800">
                    Skin tone & body analysis based on your photo
                </h2>
                <p className="text-gray-600">
                    You can change it if it's not accurate
                </p>
            </div>

            {/* 肤色选择器 */}
            <div className="space-y-4">
                <div className="text-left space-y-2">
                    <p className="text-sm text-gray-600">
                    Skin Tone
                    </p>
                </div>
                
                <RadioGroup
                    value={selectedSkinTone}
                    onValueChange={setSelectedSkinTone}
                    className="grid grid-cols-7 md:grid-cols-7 lg:grid-cols-7 "
                >
                    {SKIN_TONE_OPTIONS.map((option) => (
                        <div key={option.id} className="flex">
                            <RadioGroupItem
                                value={option.id}
                                id={option.id}
                                className="peer sr-only"
                            />
                            <label
                                htmlFor={option.id}
                                className="flex flex-col items-center p-1 rounded-lg border-2 border-gray-100 cursor-pointer transition-all duration-100 hover:border-primary/50 hover:shadow-md peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:shadow-md peer-data-[state=checked]:scale-105 peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary/20 hover:scale-102"
                            >
                                {/* 圆形肤色按钮 */}
                                <div
                                    className="w-8 h-8 rounded-full border-2 border-gray-300 shadow-sm transition-all duration-200 peer-data-[state=checked]:border-primary peer-data-[state=checked]:shadow-lg peer-data-[state=checked]:scale-110 peer-data-[state=checked]:ring-4 peer-data-[state=checked]:ring-primary/20 hover:scale-105"
                                    style={{ backgroundColor: option.color }}
                                >
                                </div>
                                
                                {/* 标签和描述 */}
                                {/* <div className="text-center space-y-1">
                                    <span className="text-sm font-medium text-gray-900 peer-data-[state=checked]:text-primary">
                                        {option.label}
                                    </span>
                                    <p className="text-xs text-gray-500">
                                        {option.description}
                                    </p>
                                </div> */}
                            </label>
                        </div>
                    ))}
                </RadioGroup>
            </div>

            {/* 提示信息 */}
            {selectedSkinTone && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800 text-center">
                        Selected: <span className="font-medium">{SKIN_TONE_OPTIONS.find(opt => opt.id === selectedSkinTone)?.label}</span>
                    </p>
                </div>
            )}

            {/* 体型选择器 */}
            <div className="space-y-4">
                <div className="text-left space-y-2">
                    <p className="text-sm text-gray-600">
                    Body Type
                    </p>
                </div>

                <RadioGroup
                    value={selectedBodyType}
                    onValueChange={setSelectedBodyType}
                    className="grid grid-cols-3 md:grid-cols-3 gap-3"
                >
                    {BODY_TYPE_OPTIONS.map((option) => (
                        <div key={option.id} className="flex">
                            <RadioGroupItem
                                value={option.id}
                                id={option.id}
                                className="peer sr-only"
                            />
                            <label
                                htmlFor={option.id}
                                className="flex flex-col items-center p-3 rounded-lg border-2 border-gray-200 cursor-pointer transition-all duration-200 hover:border-primary/50 hover:shadow-md peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:shadow-md peer-data-[state=checked]:opacity-100 peer-data-[state=checked]:scale-105 peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary/20 opacity-60 hover:opacity-80 hover:scale-102"
                            >
                                {/* 体型图片 */}
                                <div className="mb-2 w-full h-20 flex items-center justify-center">
                                    <img src={option.image} alt={option.label} className="w-full h-full object-cover rounded-lg" />
                                </div>
                                
                                {/* 标签和描述 */}
                                <div className="text-center space-y-1">
                                    <span className="text-sm font-medium text-gray-900 peer-data-[state=checked]:text-primary">
                                        {option.label}
                                    </span>

                                </div>
                            </label>
                        </div>
                    ))}
                </RadioGroup>
            </div>

            {/* 体型选择提示信息 */}
            {selectedBodyType && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-800 text-center">
                        Selected: <span className="font-medium">{BODY_TYPE_OPTIONS.find(opt => opt.id === selectedBodyType)?.label}</span>
                    </p>
                </div>
            )}

            {/* 身体量感结构选择器 */}
            <div className="space-y-4">
                <div className="text-left space-y-2">
                    <p className="text-sm text-gray-600">
                        Body Structure
                    </p>
                </div>

                <RadioGroup
                    value={selectedBodyStructure}
                    onValueChange={setSelectedBodyStructure}
                    className="grid grid-cols-3 md:grid-cols-3 gap-3"
                >
                    {BODY_STRUCTURE_OPTIONS.map((option) => (
                        <div key={option.id} className="flex">
                            <RadioGroupItem
                                value={option.id}
                                id={option.id}
                                className="peer sr-only"
                            />
                            <label
                                htmlFor={option.id}
                                className="flex flex-col items-center p-3 rounded-lg border-2 border-gray-200 cursor-pointer transition-all duration-200 hover:border-primary/50 hover:shadow-md peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:shadow-md peer-data-[state=checked]:opacity-100 peer-data-[state=checked]:scale-105 peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary/20 opacity-60 hover:opacity-80 hover:scale-102"
                            >
                                {/* 身体量感结构图片 */}
                                <div className="mb-2 w-full h-20 flex items-center justify-center">
                                    <img src={option.image} alt={option.label} className="w-full h-full object-cover rounded-lg" />
                                </div>
                                
                                {/* 标签和描述 */}
                                <div className="text-center space-y-1">
                                    <span className="text-sm font-medium text-gray-900 peer-data-[state=checked]:text-primary">
                                        {option.label}
                                    </span>
                                </div>
                            </label>
                        </div>
                    ))}
                </RadioGroup>
            </div>

            {/* 身体量感结构选择提示信息 */}
            {selectedBodyStructure && (
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-sm text-purple-800 text-center">
                        Selected: <span className="font-medium">{BODY_STRUCTURE_OPTIONS.find(opt => opt.id === selectedBodyStructure)?.label}</span>
                    </p>
                </div>
            )}


        </div>
    );
}