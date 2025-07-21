import {
  Briefcase,
  Crown,
  Heart,
  Sparkles,
  Palmtree,
  PartyPopper,
} from "lucide-react"

// Style configuration for different occasions
export const styles = [
  { id: "work", name: "Work", icon: Briefcase },
  { id: "casual-chic", name: "Casual Chic", icon: Sparkles },
  { id: "date-night", name: "Date Night", icon: Heart },
  { id: "cocktail", name: "Cocktail", icon: PartyPopper },
  { id: "vacation", name: "Vacation", icon: Palmtree },
  { id: "formal", name: "Formal", icon: Crown },
]

// Style prompts for different occasions
export const stylePrompts = {
  "work": "Professional office environment with modern architecture, clean lines, and natural lighting. The person is in a contemporary workplace setting with glass panels, minimalist furniture, and a sophisticated atmosphere. The style emphasizes business professionalism with high-quality textures and sharp details, shot with professional corporate photography standards, 4k resolution.",
  "casual-chic": "trendy Brooklyn street with colorful murals, chic coffee shop with exposed brick walls, urban rooftop garden with city views, stylish boutique district, contemporary art gallery setting, natural daylight with artistic shadows, street style fashion photography, 4k resolution",
  "date-night": "A realistic romantic evening on a backyard patio--string lights overhead, wine glasses, laughing mid-conversation with friend. Subtle body language, soft bokeh lights, hint of connection. Created using: Sony Alpha A7R IV, cinematic lighting, shallow depth of field, natural expressions, sunset color grading Shot in kodak gold 200 with a canon EOS R6, 4k resolution.",
  "cocktail": "opulent ballroom with crystal chandeliers, luxurious velvet curtains and gold accents, dramatic spotlight effects with rich jewel tones, champagne bar with marble countertops, exclusive VIP lounge atmosphere, professional event photography with glamorous lighting, 4k resolution",
  "vacation": "On the beach, soft sunlight, gentle waves in the background, highly detailed, lifelike textures, natural lighting, vivid colors, 4k resolution",
  "formal": "Elegant formal event setting with sophisticated architecture, marble columns, and refined lighting. The atmosphere conveys luxury and elegance with attention to fine details, formal event photography with dramatic yet tasteful lighting, emphasizing classic beauty and timeless style, 4k resolution",
}