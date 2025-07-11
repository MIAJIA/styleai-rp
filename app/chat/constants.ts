import {
  BookOpen,
  Footprints,
  Coffee,
  Mic,
  Palmtree,
  PartyPopper,
  Heart,
  Sparkles,
  Briefcase,
  Wine,
  Plane,
  Crown,
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

// Style prompts for different occasions
export const stylePrompts = {
  "work":
    "Modern office environment with clean lines and professional atmosphere. Natural lighting from large windows, contemporary office furniture, neutral color palette with subtle textures. The setting conveys competence and reliability while maintaining approachability. Shot with professional business photography style, crisp details, confident posture, 4k resolution.",
  "casual-chic":
    "Trendy urban setting with artistic elements - exposed brick walls, modern coffee shop interior, or stylish boutique district. Natural daylight with soft shadows, contemporary art pieces in background, relaxed yet curated atmosphere. Street style photography aesthetic with effortless sophistication, 4k resolution.",
  "date-night":
    "Romantic evening setting with warm, intimate lighting - upscale restaurant with soft candlelight, elegant rooftop terrace with city lights, or charming wine bar atmosphere. Golden hour lighting with bokeh effects, sophisticated ambiance that's alluring yet tasteful. Shot with cinematic romantic photography style, 4k resolution.",
  "cocktail":
    "Sophisticated cocktail lounge or upscale bar setting with ambient lighting, rich textures like velvet and marble, elegant floral arrangements. Warm lighting with dramatic shadows, luxurious yet approachable atmosphere. Fashion-forward photography with emphasis on style and elegance, 4k resolution.",
  "vacation":
    "Bright, airy vacation destination - beachside resort with ocean views, tropical poolside setting, or charming European street cafe. Natural sunlight with vibrant colors, relaxed holiday atmosphere with palm trees or scenic backgrounds. Travel photography style with fresh, carefree energy, 4k resolution.",
  "formal":
    "Elegant formal venue with grand architecture - luxury hotel ballroom, opera house foyer, or prestigious gala setting. Dramatic lighting with crystal chandeliers, rich fabrics and ornate details. Classical formal photography with emphasis on dignity and sophistication, 4k resolution.",
}