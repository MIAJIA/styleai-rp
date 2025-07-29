export interface ButtonAction {
    id: string
    label: string
    type: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
    icon?: string
    action: string
}

export interface Message {
    id: string
    content: string
    sender: 'user' | 'ai'
    timestamp: Date
    isEditing?: boolean
    buttons?: ButtonAction[]
    metadata?: {
        likes?: number
        dislikes?: number
        isLiked?: boolean
        isDisliked?: boolean
    },
    imageUrls?: string[]
}