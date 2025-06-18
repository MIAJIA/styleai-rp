"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  User,
  Palette,
  Target,
  Shield,
  RefreshCw,
  Camera,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  loadCompleteOnboardingData,
  getUserPhotos,
  type OnboardingData,
} from "@/lib/onboarding-storage";
import { useRouter } from "next/navigation";

interface UserProfile extends OnboardingData {
  savedAt?: string;
  photoMetadata?: {
    hasFullBodyPhoto: boolean;
    photosStoredSeparately?: boolean;
  };
}

export default function MyStylePage() {
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [photos, setPhotos] = useState<{ fullBodyPhoto: string | null }>({
    fullBodyPhoto: null,
  });
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    myPhotos: true,
  });
  const router = useRouter();

  useEffect(() => {
    const loadProfile = () => {
      try {
        const savedProfile = localStorage.getItem("styleMe_user_profile");
        const onboardingData = loadCompleteOnboardingData();
        const userPhotos = getUserPhotos();

        let profile: UserProfile = onboardingData;

        if (savedProfile) {
          try {
            const parsedProfile = JSON.parse(savedProfile);
            profile = { ...onboardingData, ...parsedProfile };
          } catch (error) {
            console.error("Error parsing saved profile:", error);
          }
        }

        profile.photoMetadata = {
          hasFullBodyPhoto: !!userPhotos.fullBodyPhoto || !!onboardingData.fullBodyPhoto,
          photosStoredSeparately: true,
        };

        if (!profile.savedAt) {
          const onboardingCompleted = localStorage.getItem("styleMe_onboarding_completed");
          if (onboardingCompleted) {
            profile.savedAt = new Date().toISOString();
          }
        }

        setProfileData(profile);
        setPhotos(userPhotos);
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const hasCompletedOnboarding =
    profileData &&
    (profileData.stylePreferences?.length ||
      profileData.primaryScenario ||
      Object.keys(profileData).length > 2);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fff9f4] flex items-center justify-center pb-20">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-[#FF6EC7]" />
          <p className="text-gray-600">Loading your style profile...</p>
        </div>
      </div>
    );
  }

  if (!hasCompletedOnboarding) {
    return (
      <div className="min-h-screen bg-[#fff9f4] flex items-center justify-center p-4 pb-20">
        <Card className="w-full max-w-md text-center shadow-lg">
          <CardContent className="pt-6">
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-[#FF6EC7]" />
            <h2 className="text-xl font-semibold mb-2">No Style Profile Yet</h2>
            <p className="text-gray-600 mb-6">
              Complete the style assessment to get your personalized style profile
            </p>
            <Button
              onClick={() => router.push("/onboarding")}
              className="w-full bg-[#FF6EC7] hover:bg-[#FF6EC7]/90 text-white rounded-full font-bold"
            >
              Start Style Assessment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStructureCombination = () => {
    if (!profileData) return "";
    const face =
      profileData.facialIntensity === "strong"
        ? "Bold Features"
        : profileData.facialIntensity === "light"
          ? "Soft Features"
          : "Balanced Features";
    return `${face}`;
  };

  const getStyleLabels = () => {
    if (profileData?.styleProfile?.styleLabels?.length) {
      return profileData.styleProfile.styleLabels;
    }
    const labels = [];
    if (profileData?.facialIntensity === "light" && profileData?.facialMaturity === "youthful") {
      labels.push("Fresh & Youthful");
    }
    if (profileData?.stylePreferences?.includes("Edgy Cool")) {
      labels.push("Edgy Cool");
    }
    if (profileData?.stylePreferences?.includes("Elegant Refined")) {
      labels.push("Elegant Refined");
    }
    if (profileData?.stylePreferences?.includes("Fresh & Vibrant")) {
      labels.push("Fresh & Vibrant");
    }
    return labels.length > 0 ? labels : ["Unique Style"];
  };

  const getRecommendedKeywords = () => {
    if (profileData?.styleProfile?.recommendedKeywords?.length) {
      return profileData.styleProfile.recommendedKeywords;
    }
    const keywords = [];
    if (profileData?.bodyAdvantages?.includes("Slim Waist")) keywords.push("High Waistline");
    if (profileData?.bodyAdvantages?.includes("Long Legs")) keywords.push("Cropped Tops");
    if (profileData?.facialIntensity === "light") keywords.push("Soft Colors");
    if (profileData?.stylePreferences?.includes("Fresh & Vibrant")) keywords.push("Bright Tones");
    if (profileData?.primaryScenario === "Workplace") keywords.push("Professional");
    return keywords.length > 0 ? keywords : ["Comfortable", "Natural"];
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Recently";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Recently";
    }
  };

  return (
    <div className="min-h-screen bg-[#fff9f4] pb-20 relative overflow-hidden">
      {/* Gradient background elements - matching main page */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#D5F500] rounded-full opacity-50 blur-xl -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#FF6EC7] rounded-full opacity-50 blur-xl translate-y-1/2 -translate-x-1/2"></div>
      <div className="absolute top-1/3 left-1/4 w-20 h-20 bg-[#00C2FF] rounded-full opacity-30 blur-xl"></div>

      {/* Content with relative positioning */}
      <div className="relative z-10">
        {/* Compact Header */}
        <div className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-md mx-auto px-4 py-3">
            <h1 className="text-lg font-semibold text-center flex items-center justify-center gap-2">
              <Palette className="w-4 h-4 text-[#FF6EC7]" />
              My Style Profile
            </h1>
            {profileData?.savedAt && (
              <p className="text-xs text-gray-500 text-center mt-1 flex items-center justify-center gap-1">
                <Calendar className="w-3 h-3" />
                Updated {formatDate(profileData.savedAt)}
              </p>
            )}
          </div>
        </div>

        <div className="max-w-md mx-auto p-3 space-y-3">
          {/* Main Style Summary - Compact */}
          <Card className="bg-pink-500 text-white shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4" />
                <h2 className="font-semibold text-sm">Style Profile</h2>
              </div>
              <p className="font-bold text-base mb-2">{getStructureCombination()}</p>
              <div className="flex flex-wrap gap-1">
                {getStyleLabels()
                  .slice(0, 3)
                  .map((label, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="bg-white/25 text-white border-none text-xs px-2 py-0.5"
                    >
                      {label}
                    </Badge>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* My Photos Section */}
          <Card className="shadow-lg col-span-2">
            <CardContent className="p-3">
              <button
                onClick={() => toggleSection("myPhotos")}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-1">
                  <Camera className="w-3 h-3 text-[#FF6EC7]" />
                  <h3 className="font-medium text-xs">My Photos</h3>
                </div>
                {expandedSections["myPhotos"] ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>
              {expandedSections["myPhotos"] && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-center text-gray-600">Full Body</p>
                    {photos.fullBodyPhoto ? (
                      <img
                        src={photos.fullBodyPhoto}
                        alt="Full body"
                        className="w-full h-auto object-cover rounded-lg border"
                      />
                    ) : (
                      <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-400">
                        No Photo
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Grid Layout for Key Information */}
          <div className="grid grid-cols-1 gap-3">
            {/* Facial Features */}
            <Card className="shadow-lg">
              <CardContent className="p-3">
                <div className="flex items-center gap-1 mb-2">
                  <User className="w-3 h-3 text-[#FF6EC7]" />
                  <h3 className="font-medium text-xs">Facial Features</h3>
                </div>
                <div className="space-y-1 text-xs">
                  {profileData?.facialIntensity && (
                    <div>
                      <span className="text-gray-600">Intensity:</span>
                      <span className="ml-1 font-medium">
                        {profileData.facialIntensity === "strong"
                          ? "Bold"
                          : profileData.facialIntensity === "light"
                            ? "Soft"
                            : "Balanced"}
                      </span>
                    </div>
                  )}
                  {profileData?.facialMaturity && (
                    <div>
                      <span className="text-gray-600">Style:</span>
                      <span className="ml-1 font-medium">
                        {profileData.facialMaturity === "mature" ? "Mature" : "Youthful"}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recommended Keywords - Compact */}
          <Card className="shadow-lg">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-2">
                <Target className="w-3 h-3 text-[#FF6EC7]" />
                <h3 className="font-medium text-xs">Style Keywords</h3>
              </div>
              <div className="flex flex-wrap gap-1">
                {getRecommendedKeywords()
                  .slice(0, 6)
                  .map((keyword, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="border-[#FF6EC7]/30 text-[#FF6EC7] text-xs px-2 py-0.5"
                    >
                      {keyword}
                    </Badge>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Expandable Sections */}
          {/* Body Details */}
          {(profileData?.bodyAdvantages?.length || profileData?.bodyChallenges?.length) && (
            <Card className="shadow-lg">
              <CardContent className="p-3">
                <button
                  onClick={() => toggleSection("body")}
                  className="flex items-center justify-between w-full text-left"
                >
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3 text-[#FF6EC7]" />
                    <h3 className="font-medium text-xs">Body Analysis</h3>
                  </div>
                  {expandedSections.body ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>

                {expandedSections.body && (
                  <div className="mt-2 space-y-2">
                    {profileData.bodyAdvantages && profileData.bodyAdvantages.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Advantages</p>
                        <div className="flex flex-wrap gap-1">
                          {profileData.bodyAdvantages.map((advantage, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="bg-green-100 text-green-700 text-xs px-2 py-0.5"
                            >
                              {advantage}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {profileData.bodyChallenges && profileData.bodyChallenges.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Areas to Enhance</p>
                        <div className="flex flex-wrap gap-1">
                          {profileData.bodyChallenges.map((challenge, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5"
                            >
                              {challenge}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Style Preferences */}
          {(profileData?.stylePreferences?.length || profileData?.primaryScenario) && (
            <Card className="shadow-lg">
              <CardContent className="p-3">
                <button
                  onClick={() => toggleSection("preferences")}
                  className="flex items-center justify-between w-full text-left"
                >
                  <div className="flex items-center gap-1">
                    <Palette className="w-3 h-3 text-[#FF6EC7]" />
                    <h3 className="font-medium text-xs">Style Preferences</h3>
                  </div>
                  {expandedSections.preferences ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>

                {expandedSections.preferences && (
                  <div className="mt-2 space-y-2">
                    {profileData.stylePreferences && profileData.stylePreferences.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Preferred Styles</p>
                        <div className="flex flex-wrap gap-1">
                          {profileData.stylePreferences.map((style, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5"
                            >
                              {style}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {profileData.primaryScenario && (
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Primary Scenario</p>
                        <Badge
                          variant="outline"
                          className="border-blue-200 text-blue-700 text-xs px-2 py-0.5"
                        >
                          {profileData.primaryScenario}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Style Boundaries */}
          {profileData?.avoidElements && profileData.avoidElements.length > 0 && (
            <Card className="shadow-lg">
              <CardContent className="p-3">
                <button
                  onClick={() => toggleSection("boundaries")}
                  className="flex items-center justify-between w-full text-left"
                >
                  <div className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-[#FF6EC7]" />
                    <h3 className="font-medium text-xs">Style Boundaries</h3>
                  </div>
                  {expandedSections.boundaries ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>

                {expandedSections.boundaries && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-600 mb-1">Elements to Avoid</p>
                    <div className="flex flex-wrap gap-1">
                      {profileData.avoidElements.map((element, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="bg-red-100 text-red-700 text-xs px-2 py-0.5"
                        >
                          {element}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Compact Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              onClick={() => router.push("/")}
              className="bg-[#FF6EC7] hover:bg-[#FF6EC7]/90 text-white rounded-full font-bold text-sm py-2"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Generate Looks
            </Button>
            <Button
              onClick={() => router.push("/onboarding")}
              variant="outline"
              className="border-[#FF6EC7]/30 text-[#FF6EC7] hover:bg-[#FF6EC7]/10 rounded-full font-bold text-sm py-2"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Retake Test
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
