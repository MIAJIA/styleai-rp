export interface ButtonAction {
    id: string
    label: string
    type: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
    icon?: string
    action: string
    jobId?: string
    suggestionIndex?: number
}

export interface Message {
    id: string
    content: string
    sender: 'user' | 'ai'
    timestamp: Date
    isEditing?: boolean
    buttons?: ButtonAction[]
    isSaveDB?: boolean
    metadata?: {
        likes?: number
        dislikes?: number
        isLiked?: boolean
        isDisliked?: boolean
    },
    imageUrls?: string[]
    // Progress bar related fields
    progress?: {
        current: number
        total: number
        status: 'pending' | 'processing' | 'completed' | 'error'
        message?: string
    }
}
