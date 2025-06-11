// Utility functions for managing onboarding data storage
// Handles localStorage quota issues by separating large photo data

export interface OnboardingData {
  // Step 0: Photo Upload
  fullBodyPhoto?: string
  headPhoto?: string
  aiAnalysis?: {
    bodyType?: string
    faceShape?: string
    skinTone?: string
    proportions?: string
    styleInitialSense?: string
    bodyAdvantages?: string[]
    boneStructure?: string
    facialFeatures?: string
  }

  // Step 1: Body Analysis
  bodyAdvantages?: string[]
  bodyChallenges?: string[]
  customAdvantages?: string
  customChallenges?: string
  boneStructure?: "strong" | "delicate"
  upperBodyType?: "straight" | "curved"

  // Step 1.5: Facial Analysis
  facialIntensity?: "strong" | "light" | "medium"
  facialLines?: "straight" | "curved"
  facialMaturity?: "mature" | "youthful"

  // Step 2: Style Preferences
  stylePreferences?: string[]
  customStyle?: string

  // Step 3: Scenario
  primaryScenario?: string
  customScenario?: string

  // Step 4: Style Boundaries
  avoidElements?: string[]
  customAvoid?: string

  // Step 5: Style Summary (generated)
  styleProfile?: {
    structureCombination?: string
    styleLabels?: string[]
    recommendedKeywords?: string[]
  }
}

export const safeSetLocalStorage = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    console.error(`Failed to save to localStorage (${key}):`, error)
    return false
  }
}

export const safeGetLocalStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch (error) {
    console.error(`Failed to read from localStorage (${key}):`, error)
    return null
  }
}

export const loadCompleteOnboardingData = (): OnboardingData => {
  // Load main data
  const savedData = safeGetLocalStorage("styleMe_onboarding_data")
  let data: OnboardingData = {}

  if (savedData) {
    try {
      data = JSON.parse(savedData)
    } catch (error) {
      console.error("Error parsing onboarding data:", error)
    }
  }

  // Load photos from separate storage if not in main data
  if (!data.fullBodyPhoto) {
    const fullBodyPhoto = safeGetLocalStorage("styleMe_fullBodyPhoto")
    if (fullBodyPhoto) {
      data.fullBodyPhoto = fullBodyPhoto
    }
  }

  if (!data.headPhoto) {
    const headPhoto = safeGetLocalStorage("styleMe_headPhoto")
    if (headPhoto) {
      data.headPhoto = headPhoto
    }
  }

  return data
}

export const saveOnboardingData = (data: OnboardingData): boolean => {
  const dataToSave = JSON.stringify(data)
  if (!safeSetLocalStorage("styleMe_onboarding_data", dataToSave)) {
    // If saving fails due to quota, try saving without photos
    const { fullBodyPhoto, headPhoto, ...dataWithoutPhotos } = data
    const reducedData = JSON.stringify(dataWithoutPhotos)
    const success = safeSetLocalStorage("styleMe_onboarding_data", reducedData)

    // Store photos separately if they exist
    if (fullBodyPhoto) {
      safeSetLocalStorage("styleMe_fullBodyPhoto", fullBodyPhoto)
    }
    if (headPhoto) {
      safeSetLocalStorage("styleMe_headPhoto", headPhoto)
    }

    return success
  }
  return true
}

export const createUserProfile = (data: OnboardingData) => {
  // Create a profile without the large photo data
  const { fullBodyPhoto, headPhoto, ...profileData } = data

  // Store photos separately with metadata
  const photoMetadata = {
    hasFullBodyPhoto: !!fullBodyPhoto,
    hasHeadPhoto: !!headPhoto,
    photosStoredSeparately: true
  }

  return {
    ...profileData,
    photoMetadata
  }
}

export const saveUserProfile = (data: OnboardingData): boolean => {
  try {
    // Create user profile without large photo data
    const userProfile = createUserProfile(data)
    const profileJson = JSON.stringify(userProfile)

    if (!safeSetLocalStorage("styleMe_user_profile", profileJson)) {
      // If even the reduced profile fails, save minimal essential data
      const minimalProfile = {
        bodyAdvantages: data.bodyAdvantages,
        bodyChallenges: data.bodyChallenges,
        boneStructure: data.boneStructure,
        upperBodyType: data.upperBodyType,
        facialIntensity: data.facialIntensity,
        facialLines: data.facialLines,
        facialMaturity: data.facialMaturity,
        stylePreferences: data.stylePreferences,
        primaryScenario: data.primaryScenario,
        avoidElements: data.avoidElements,
        styleProfile: data.styleProfile,
        photoMetadata: {
          hasFullBodyPhoto: !!data.fullBodyPhoto,
          hasHeadPhoto: !!data.headPhoto,
          photosStoredSeparately: true
        }
      }
      return safeSetLocalStorage("styleMe_user_profile", JSON.stringify(minimalProfile))
    }

    // Store photos separately
    if (data.fullBodyPhoto) {
      safeSetLocalStorage("styleMe_fullBodyPhoto", data.fullBodyPhoto)
    }
    if (data.headPhoto) {
      safeSetLocalStorage("styleMe_headPhoto", data.headPhoto)
    }

    return true
  } catch (error) {
    console.error("Error saving user profile:", error)
    return false
  }
}

export const getUserPhotos = () => {
  return {
    fullBodyPhoto: safeGetLocalStorage("styleMe_fullBodyPhoto"),
    headPhoto: safeGetLocalStorage("styleMe_headPhoto")
  }
}

export const clearOnboardingData = () => {
  localStorage.removeItem("styleMe_onboarding_data")
  localStorage.removeItem("styleMe_fullBodyPhoto")
  localStorage.removeItem("styleMe_headPhoto")
  localStorage.removeItem("styleMe_user_profile")
  localStorage.removeItem("styleMe_onboarding_completed")
}