// Utility functions for managing onboarding data storage
// Handles localStorage quota issues by separating large photo data

export interface OnboardingData {
  // Step 0: Photo Upload
  fullBodyPhoto?: string;
  aiAnalysis?: {
    bodyType?: string;
    faceShape?: string;
    styleInitialSense?: string;
    bodyAdvantages?: string[];
    boneStructure?: string;
    facialFeatures?: string;
  };

  // Basic Demographics
  gender?: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';

  // Step 1: Body Analysis
  bodyAdvantages?: string[];
  bodyChallenges?: string[];
  customAdvantages?: string;
  customChallenges?: string;

  // Step 2: Style Preferences
  stylePreferences?: string[];
  customStyle?: string;

  // Step 3: Personalization
  sustainableFashion?: boolean;
  accessoryMatching?: boolean;
  specificStyles?: string[];
  customSpecificStyle?: string;

  // Step 4: Style Summary (generated)
  styleProfile?: {
    structureCombination?: string;
    styleLabels?: string[];
    recommendedKeywords?: string[];
  };
}

export const safeSetLocalStorage = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`Failed to save to localStorage (${key}):`, error);
    return false;
  }
};

export const safeGetLocalStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error(`Failed to read from localStorage (${key}):`, error);
    return null;
  }
};

export const loadCompleteOnboardingData = (): OnboardingData => {
  // Load main data
  const savedData = safeGetLocalStorage("styleMe_onboarding_data");
  let data: OnboardingData = {};

  if (savedData) {
    try {
      data = JSON.parse(savedData);
    } catch (error) {
      console.error("Error parsing onboarding data:", error);
    }
  }

  // Load photos from separate storage if not in main data
  if (!data.fullBodyPhoto) {
    const fullBodyPhoto = safeGetLocalStorage("styleMe_fullBodyPhoto");
    if (fullBodyPhoto) {
      data.fullBodyPhoto = fullBodyPhoto;
    }
  }

  return data;
};

export const saveOnboardingData = (data: OnboardingData): boolean => {
  const dataToSave = JSON.stringify(data);
  if (!safeSetLocalStorage("styleMe_onboarding_data", dataToSave)) {
    // If saving fails due to quota, try saving without photos
    const { fullBodyPhoto, ...dataWithoutPhotos } = data;
    const reducedData = JSON.stringify(dataWithoutPhotos);
    const success = safeSetLocalStorage("styleMe_onboarding_data", reducedData);

    // Store photos separately if they exist
    if (fullBodyPhoto) {
      safeSetLocalStorage("styleMe_fullBodyPhoto", fullBodyPhoto);
    }

    return success;
  }
  return true;
};

export const createUserProfile = (data: OnboardingData) => {
  // Create a profile without the large photo data
  const { fullBodyPhoto, ...profileData } = data;

  // Store photos separately with metadata
  const photoMetadata = {
    hasFullBodyPhoto: !!fullBodyPhoto,
    photosStoredSeparately: true,
  };

  return {
    ...profileData,
    photoMetadata,
  };
};

export const saveUserProfile = (data: OnboardingData): boolean => {
  // --- STRATEGY 1: IDEAL ---
  // Save profile (without photos) and photos separately.
  const { fullBodyPhoto, ...profileData } = data;
  const userProfile = {
    ...profileData,
    photoMetadata: {
      hasFullBodyPhoto: !!fullBodyPhoto,
    },
    savedAt: new Date().toISOString(),
  };

  const profileJson = JSON.stringify(userProfile);
  const profileSaveSuccess = safeSetLocalStorage("styleMe_user_profile", profileJson);

  // Try to save photos, but don't let failure block success
  if (fullBodyPhoto) {
    safeSetLocalStorage("styleMe_fullBodyPhoto", fullBodyPhoto);
  }

  if (profileSaveSuccess) {
    console.log("Storage Strategy 1: Successfully saved full user profile.");
    return true;
  }

  // --- STRATEGY 2: CORE DATA ---
  // The full profile was too large. Save only the most essential style data.
  console.warn("Storage Strategy 1 failed. Trying Strategy 2: Core Data.");
  const coreProfile = {
    // Drop potentially large custom text fields
    bodyAdvantages: data.bodyAdvantages,
    bodyChallenges: data.bodyChallenges,
    stylePreferences: data.stylePreferences,
    photoMetadata: userProfile.photoMetadata,
    savedAt: userProfile.savedAt,
  };
  const coreProfileJson = JSON.stringify(coreProfile);
  const coreSaveSuccess = safeSetLocalStorage("styleMe_user_profile", coreProfileJson);

  if (coreSaveSuccess) {
    console.log("Storage Strategy 2: Successfully saved core profile data.");
    return true;
  }

  // --- STRATEGY 3: MINIMAL DATA ---
  // Core data was too large. Save absolute minimum.
  console.warn("Storage Strategy 2 failed. Trying Strategy 3: Minimal Data.");
  const minimalProfile = {
    stylePreferences: data.stylePreferences,
    photoMetadata: userProfile.photoMetadata,
    savedAt: userProfile.savedAt,
  };
  const minimalProfileJson = JSON.stringify(minimalProfile);
  const minimalSaveSuccess = safeSetLocalStorage("styleMe_user_profile", minimalProfileJson);

  if (minimalSaveSuccess) {
    console.log("Storage Strategy 3: Successfully saved minimal profile data.");
    return true;
  }

  // --- STRATEGY 4: FINAL RESORT ---
  // Everything failed. Save just a marker that onboarding was completed.
  console.error(
    "Storage Strategy 3 failed. All profile save attempts failed. Saving completion marker only.",
  );
  safeSetLocalStorage(
    "styleMe_user_profile",
    JSON.stringify({
      error: "Failed to save profile data due to storage limitations.",
      photoMetadata: userProfile.photoMetadata,
      savedAt: userProfile.savedAt,
    }),
  );

  return false; // Indicate that the main profile save was not successful.
};

export const getUserPhotos = () => {
  return {
    fullBodyPhoto: safeGetLocalStorage("styleMe_fullBodyPhoto"),
  };
};

export const clearOnboardingData = () => {
  localStorage.removeItem("styleMe_onboarding_data");
  localStorage.removeItem("styleMe_fullBodyPhoto");
  localStorage.removeItem("styleMe_user_profile");
  localStorage.removeItem("styleMe_onboarding_completed");
};
