"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Camera,
  Palette,
  Heart,
  Settings,
  Edit,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import {
  loadCompleteOnboardingData,
  getUserPhotos,
  type OnboardingData,
} from "@/lib/onboarding-storage";
import { useRouter } from "next/navigation";
import IOSTabBar from "../components/ios-tab-bar";
import UserInfo from "../components/userInfo";

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
  const [isLoading, setIsLoading] = useState(true);
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

        setProfileData(profile);
        setPhotos(userPhotos);
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, []);

  const hasCompletedOnboarding = profileData && (
    profileData.stylePreferences?.length ||
    Object.keys(profileData).length > 2
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!hasCompletedOnboarding) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white-50 via-purple-50 to-blue-50 flex items-center justify-center p-4 pb-20">
        <div className="w-full max-w-md text-center bg-white rounded-3xl shadow-xl p-8">
          <div className="w-20 h-20 bg-gradient-to-br from-white-50 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <User className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Complete Your Style Profile</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">
            Create your personalized style profile to get the best recommendations and see your fashion journey!
          </p>
          <Button
            onClick={() => router.push("/onboarding")}
            className="w-full bg-gradient-to-r from-white-50 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-full font-bold py-4 text-lg shadow-lg"
          >
            <Camera className="w-5 h-5 mr-2" />
            Start Style Assessment
          </Button>
        </div>
        <IOSTabBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white-50 via-purple-50 to-blue-50 pb-20">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="p-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-800">My Style Profile</h1>
              <p className="text-sm text-gray-500">Your personalized fashion journey</p>
            </div>
            <UserInfo />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Profile Photo Section */}
        <Card className="p-6 bg-white shadow-lg border-0">
          <div className="flex items-center gap-4">
            <div className="relative">
              {photos.fullBodyPhoto || profileData?.fullBodyPhoto ? (
                <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-pink-200">
                  <img
                    src={photos.fullBodyPhoto || profileData?.fullBodyPhoto || "/placeholder.svg"}
                    alt="Profile"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              ) : (
                <div className="w-20 h-20 bg-gradient-to-br from-pink-200 to-purple-200 rounded-full flex items-center justify-center">
                  <Camera className="w-8 h-8 text-gray-600" />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-800">Style Profile</h2>
              <p className="text-gray-600">
                {profileData?.savedAt
                  ? `Created ${new Date(profileData.savedAt).toLocaleDateString()}`
                  : "Recently created"
                }
              </p>
              {profileData?.photoMetadata?.hasFullBodyPhoto && (
                <div className="flex items-center gap-1 mt-1">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-green-600">Photo analyzed</span>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* AI Analysis Results */}
        {profileData && (
          <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">AI Analysis Results</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profileData.skinTone && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Skin Tone</p>
                  <p className="text-gray-800">{profileData.skinTone}</p>
                </div>
              )}
              {profileData.bodyType && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Body Type</p>
                  <p className="text-gray-800">{profileData.bodyType}</p>
                </div>
              )}
              {profileData.bodyStructure && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Bone Structure</p>
                  <p className="text-gray-800">{profileData.bodyStructure}</p>
                </div>
              )}
              {profileData.selectedStyles && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Selected Styles</p>
                  <p className="text-gray-800">{profileData.selectedStyles}</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Body Analysis */}
       

        {/* Style Preferences */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-semibold text-gray-800">Style Preferences</h3>
          </div>

                     {profileData?.stylePreferences && profileData.stylePreferences.length > 0 && (
             <div className="mb-6">
               <div className="flex items-center gap-2 mb-3">
                 <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                   <Palette className="w-3 h-3 text-purple-600" />
                 </div>
                 <p className="text-sm font-semibold text-gray-700">Preferred Styles</p>
               </div>
               <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                 {profileData.stylePreferences.map((style, index) => (
                   <Badge key={index} className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 border-purple-200 px-3 py-1 rounded-full font-medium hover:from-purple-200 hover:to-pink-200 transition-all duration-200 text-center">
                     {style}
                   </Badge>
                 ))}
               </div>
             </div>
           )}

          {profileData?.customStyle && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                  <Edit className="w-3 h-3 text-blue-600" />
                </div>
                <p className="text-sm font-semibold text-gray-700">Custom Style Description</p>
              </div>
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4">
                <p className="text-gray-700 text-sm leading-relaxed">{profileData.customStyle}</p>
              </div>
            </div>
          )}

                     {profileData?.specificStyles && profileData.specificStyles.length > 0 && (
             <div>
               <div className="flex items-center gap-2 mb-3">
                 <div className="w-6 h-6 bg-pink-100 rounded-full flex items-center justify-center">
                   <Heart className="w-3 h-3 text-pink-600" />
                 </div>
                 <p className="text-sm font-semibold text-gray-700">Specific Style Interests</p>
               </div>
               <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                 {profileData.specificStyles.map((style, index) => (
                   <Badge key={index} variant="outline" className="border-pink-300 text-pink-700 bg-pink-50 px-3 py-1 rounded-full font-medium hover:bg-pink-100 transition-all duration-200 text-center">
                     {style}
                   </Badge>
                 ))}
               </div>
             </div>
           )}
        </Card>

        {/* Personalization Settings */}
        {/* <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-800">Personal Preferences</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Sustainable Fashion</span>
              <div className="flex items-center gap-2">
                {profileData?.sustainableFashion ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-gray-400" />
                )}
                <span className="text-xs text-gray-500">
                  {profileData?.sustainableFashion ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Accessory Matching</span>
              <div className="flex items-center gap-2">
                {profileData?.accessoryMatching ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-gray-400" />
                )}
                <span className="text-xs text-gray-500">
                  {profileData?.accessoryMatching ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>
        </Card> */}

        {/* Style Profile Summary */}
        {profileData?.styleProfile && (
          <Card className="p-6 bg-gradient-to-r from-white-50 via-rose-50 to-orange-50 border-pink-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-white-50 to-orange-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">AI Style Profile</h3>
            </div>

            {profileData.styleProfile.structureCombination && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-600 mb-1">Body Structure Analysis</p>
                <p className="text-gray-800">{profileData.styleProfile.structureCombination}</p>
              </div>
            )}

                         {profileData.styleProfile.styleLabels && profileData.styleProfile.styleLabels.length > 0 && (
               <div className="mb-6">
                 <div className="flex items-center gap-2 mb-3">
                   <div className="w-6 h-6 bg-pink-100 rounded-full flex items-center justify-center">
                     <Palette className="w-3 h-3 text-pink-600" />
                   </div>
                   <p className="text-sm font-semibold text-gray-700">Your Style Labels</p>
                 </div>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                   {profileData.styleProfile.styleLabels.map((label, index) => (
                     <Badge key={index} className="bg-gradient-to-r from-pink-100 to-rose-100 text-pink-800 border-pink-200 px-3 py-1 rounded-full font-medium hover:from-pink-200 hover:to-rose-200 transition-all duration-200 text-center">
                       {label}
                     </Badge>
                   ))}
                 </div>
               </div>
             )}

                         {profileData.styleProfile.recommendedKeywords && profileData.styleProfile.recommendedKeywords.length > 0 && (
               <div>
                 <div className="flex items-center gap-2 mb-3">
                   <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                     <CheckCircle className="w-3 h-3 text-orange-600" />
                   </div>
                   <p className="text-sm font-semibold text-gray-700">Recommended Style Keywords</p>
                 </div>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                   {profileData.styleProfile.recommendedKeywords.map((keyword, index) => (
                     <Badge key={index} variant="outline" className="border-orange-300 text-orange-700 bg-orange-50 px-3 py-1 rounded-full font-medium hover:bg-orange-100 transition-all duration-200 text-center">
                       {keyword}
                     </Badge>
                   ))}
                 </div>
               </div>
             )}
          </Card>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={() => router.push("/")}
            className="w-full bg-gradient-to-r from-white-50 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-full py-3 font-semibold"
          >
            Start Styling Session
          </Button>

          <Button
            variant="outline"
            onClick={() => router.push("/onboarding")}
            className="w-full border-pink-200 text-pink-600 hover:bg-pink-50 rounded-full py-3"
          >
            Update Profile
          </Button>
        </div>
      </div>

      {/* iOS Tab Bar */}
      <IOSTabBar />
    </div>
  );
}
