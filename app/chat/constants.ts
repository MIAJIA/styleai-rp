import {
  Briefcase,
  Crown,
  Heart,
  Sparkles,
  Wine,
  Plane,
} from "lucide-react"

// Style configuration for different occasions
export const styles = [
  { id: "work", name: "Work", icon: Briefcase },
  { id: "casual-chic", name: "Casual Chic", icon: Sparkles },
  { id: "date-night", name: "Date Night", icon: Heart },
  { id: "cocktail", name: "Cocktail", icon: Wine },
  { id: "vacation", name: "Vacation", icon: Plane },
  { id: "formal", name: "Formal", icon: Crown },
]

export const stylePrompts = {
  "work": "office outfit, professional and polished, comfortable and well-fitted, with flexible piece combinations that are appropriate for both office work and everyday client meetings. The scene is a bright and open-plan office with glass partitions",
  "casual-chic": "casual outfit, relaxed and comfortable, effortlessly stylish, easy to move in, ideal for weekend downtime, coffee and shopping. The scene is a urban street lined with outdoor café tables and chairs",
  "date-night": "date night outfit, alluring and confidently charming, creating a soft, romantic atmosphere that showcases personal style without revealing too much. The scene is an intimate candlelit bistro terrace",
  "cocktail": "cocktail attire, fashionable and elegant, semi-formal with the right balance of sophistication and personality, thoughtfully chosen colors without appearing overly grand. The scene is an upscale lounge bar with sleek marble counters, ambient pendant lighting",
  "vacation": "vacation outfit, fresh and comfortable with a clear vacation vibe, perfectly suited for beach days, resort lounging, or city sightseeing. The scene is a pristine beachfront resort featuring turquoise waves and palm trees",
  "formal": " formal attire, elegant and dignified with a strong sense of luxury, strictly adheres to formal-event dress codes. The scene is an opulent ballroom with crystal chandeliers",
}