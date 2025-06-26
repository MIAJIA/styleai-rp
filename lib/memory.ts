// lib/memory.ts
interface ImageMetadata {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  format: string;
  dimensions: {
    width: number;
    height: number;
  };
  thumbnailUrl?: string;
  previewUrl?: string;
}

interface ConversationMessage {
  role: 'user' | 'ai';
  content: string;
  imageUrl?: string;
  imageMetadata?: ImageMetadata;
  agentInfo?: {
    type: string;
    name: string;
    emoji: string;
  };
  timestamp: Date;
  messageType: 'text' | 'image_upload' | 'image_generation' | 'text_with_image' | 'image_compressed';
}

interface ChatContext {
  conversationHistory: ConversationMessage[];
  sessionInfo: {
    lastGeneratedImage?: string;        // Last generated image
    lastUploadedImage?: string;         // Last uploaded image
    activeDiscussionTopic?: string;     // Current discussion topic
    mentionedClothingItems?: string[];  // Mentioned clothing items
    lastActiveAgent?: string;           // Last active agent
    compressionStats?: {                // Compression statistics
      totalImagesSent: number;
      totalBytesOriginal: number;
      totalBytesCompressed: number;
      averageCompressionRatio: number;
    };
  };
  windowSize: number;                   // Number of messages to keep
  lastUpdated: Date;
}

export class SmartContextManager {
  private conversationHistory: ConversationMessage[] = [];
  private readonly MAX_HISTORY = 10;
  private sessionInfo: ChatContext['sessionInfo'] = {
    compressionStats: {
      totalImagesSent: 0,
      totalBytesOriginal: 0,
      totalBytesCompressed: 0,
      averageCompressionRatio: 0
    }
  };

  addMessage(
    role: 'user' | 'ai',
    content: string,
    imageUrl?: string,
    agentInfo?: any,
    imageMetadata?: ImageMetadata
  ) {
    const messageType = this.detectMessageType(role, content, imageUrl, imageMetadata);

    const newMessage: ConversationMessage = {
      role,
      content,
      imageUrl,
      imageMetadata,
      agentInfo,
      timestamp: new Date(),
      messageType
    };

    this.conversationHistory.push(newMessage);

    console.log(`[SmartContextManager] Added message: Role: ${role}, Content: ${content}, Image URL: ${imageUrl ? '[Image Data]' : 'None'}${imageMetadata ? `, Compression: ${(imageMetadata.compressionRatio * 100).toFixed(1)}%` : ''}`);

    if (this.conversationHistory.length > this.MAX_HISTORY) {
      this.conversationHistory = this.conversationHistory.slice(-this.MAX_HISTORY);
    }

    this.updateSessionInfo(newMessage);
  }

  private detectMessageType(
    role: string,
    content: string,
    imageUrl?: string,
    imageMetadata?: ImageMetadata
  ): ConversationMessage['messageType'] {
    if (role === 'user' && imageUrl && imageMetadata) return 'image_compressed';
    if (role === 'user' && imageUrl) return 'image_upload';
    if (role === 'ai' && imageUrl) return 'image_generation';
    if (imageUrl) return 'text_with_image';
    return 'text';
  }

  private updateSessionInfo(message: ConversationMessage) {
    if (message.messageType === 'image_generation') {
      this.sessionInfo.lastGeneratedImage = message.imageUrl;
    } else if (message.messageType === 'image_upload' || message.messageType === 'image_compressed') {
      this.sessionInfo.lastUploadedImage = message.imageUrl;
    }

    // Update compression statistics
    if (message.imageMetadata && this.sessionInfo.compressionStats) {
      const stats = this.sessionInfo.compressionStats;
      stats.totalImagesSent++;
      stats.totalBytesOriginal += message.imageMetadata.originalSize;
      stats.totalBytesCompressed += message.imageMetadata.compressedSize;
      stats.averageCompressionRatio =
        (stats.totalBytesOriginal - stats.totalBytesCompressed) / stats.totalBytesOriginal;
    }

    this.sessionInfo.activeDiscussionTopic = this.inferDiscussionTopic(
      this.conversationHistory.slice(-3)
    );

    this.sessionInfo.mentionedClothingItems = this.extractClothingItems(
      this.conversationHistory.slice(-5).map(m => m.content).join(' ')
    );

    if (message.role === 'ai' && message.agentInfo) {
      this.sessionInfo.lastActiveAgent = message.agentInfo.type;
    }
  }

  private inferDiscussionTopic(recentMessages: ConversationMessage[]): string {
    const recentText = recentMessages.map(m => m.content).join(' ').toLowerCase();

    const topicPatterns = {
      'Color Matching': ['颜色', '色彩', '配色', '色调', '显白', '显黑', 'color', 'palette', 'matching', 'tone', 'hue'],
      'Item Replacement': ['换', '替换', '改成', '变成', '试试', 'change', 'replace', 'switch', 'swap', 'try'],
      'Occasion Styling': ['场合', '约会', '上班', '聚会', '婚礼', '面试', 'occasion', 'date', 'work', 'party', 'wedding', 'interview'],
      'Style Analysis': ['风格', '款式', '类型', '感觉', '气质', 'style', 'look', 'type', 'vibe', 'temperament'],
      'Size Adjustment': ['大小', '尺寸', '合身', '宽松', '紧身', 'size', 'fit', 'loose', 'tight'],
      'Material Discussion': ['材质', '面料', '质感', '舒适', '透气', 'material', 'fabric', 'texture', 'comfort', 'breathable']
    };

    for (const [topic, keywords] of Object.entries(topicPatterns)) {
      if (keywords.some(keyword => recentText.includes(keyword))) {
        return topic;
      }
    }

    return 'General Consultation';
  }

  private extractClothingItems(text: string): string[] {
    const clothingKeywords = [
      // Chinese keywords (keep for backward compatibility)
      '上衣', '衬衫', 'T恤', 'T恤衫', '毛衣', '针织衫', '外套', '夹克', '西装', '风衣',
      // English keywords
      'top', 'shirt', 'blouse', 't-shirt', 'tee', 'sweater', 'pullover', 'knitwear', 'cardigan', 'jacket', 'outerwear', 'coat', 'blazer', 'suit', 'trench coat',

      // Chinese keywords (keep for backward compatibility)
      '裤子', '牛仔裤', '短裤', '西装裤', '运动裤', '休闲裤', '阔腿裤',
      // English keywords
      'pants', 'trousers', 'jeans', 'shorts', 'dress pants', 'sweatpants', 'joggers', 'casual pants', 'wide-leg pants',

      // Chinese keywords (keep for backward compatibility)
      '裙子', 'A字裙', '连衣裙', '短裙', '长裙', '半身裙', '包臀裙',
      // English keywords
      'skirt', 'dress', 'a-line skirt', 'miniskirt', 'long skirt', 'maxi skirt', 'bodycon skirt',

      // Chinese keywords (keep for backward compatibility)
      '鞋子', '运动鞋', '高跟鞋', '平底鞋', '靴子', '凉鞋', '拖鞋', '皮鞋',
      // English keywords
      'shoes', 'footwear', 'sneakers', 'trainers', 'high heels', 'flats', 'boots', 'sandals', 'slippers', 'leather shoes',

      // Chinese keywords (keep for backward compatibility)
      '帽子', '围巾', '包包', '手包', '背包', '项链', '耳环', '手链', '戒指', '腰带',
      // English keywords
      'hat', 'cap', 'scarf', 'bag', 'handbag', 'purse', 'clutch', 'backpack', 'necklace', 'earrings', 'bracelet', 'ring', 'belt'
    ];

    return clothingKeywords.filter(item => text.toLowerCase().includes(item));
  }

  generateContextPrompt(): string {
    if (this.conversationHistory.length === 0) return '';

    let prompt = '\n\n--- CONVERSATION CONTEXT ---';

    if (this.sessionInfo.lastGeneratedImage) {
      prompt += `\n🖼️ Last generated image: ${this.sessionInfo.lastGeneratedImage}`;
    }
    if (this.sessionInfo.lastUploadedImage) {
      prompt += `\n📤 Last uploaded image: ${this.sessionInfo.lastUploadedImage}`;
    }
    if (this.sessionInfo.activeDiscussionTopic) {
      prompt += `\n💬 Current discussion topic: ${this.sessionInfo.activeDiscussionTopic}`;
    }
    if (this.sessionInfo.mentionedClothingItems && this.sessionInfo.mentionedClothingItems.length > 0) {
      prompt += `\n👕 Recently mentioned clothing items: ${this.sessionInfo.mentionedClothingItems.join(', ')}`;
    }
    if (this.sessionInfo.lastActiveAgent) {
      prompt += `\n🤖 Last active agent: ${this.sessionInfo.lastActiveAgent}`;
    }

    // 添加压缩统计信息
    if (this.sessionInfo.compressionStats && this.sessionInfo.compressionStats.totalImagesSent > 0) {
      const stats = this.sessionInfo.compressionStats;
      prompt += `\n📊 Image compression stats: ${stats.totalImagesSent} images, ${(stats.averageCompressionRatio * 100).toFixed(1)}% average compression`;
    }

    console.log(`[SmartContextManager] Current context state: ${JSON.stringify(this.sessionInfo)}`);

    prompt += '\n\n--- RECENT CONVERSATION ---';
    const recentMessages = this.conversationHistory.slice(-5);

    recentMessages.forEach(msg => {
      const role = msg.role === 'user' ? '👤 User' : `🤖 ${msg.agentInfo?.name || 'AI'}`;
      prompt += `\n${role}: ${msg.content}`;
      if (msg.imageUrl) {
        const imageType = msg.messageType === 'image_generation' ? 'Generated' :
          msg.messageType === 'image_compressed' ? 'Compressed' : 'Uploaded';
        prompt += ` [${imageType} Image`;
        if (msg.imageMetadata) {
          prompt += ` - ${msg.imageMetadata.format}, ${(msg.imageMetadata.compressionRatio * 100).toFixed(1)}% compressed`;
        }
        prompt += ']';
      }
    });

    prompt += '\n\n⚠️ CONTEXT AWARENESS INSTRUCTIONS:';
    prompt += '\n- When user says "this", "that", "it", they are likely referring to the last generated/uploaded image';
    prompt += '\n- When user says "换"(change), "替换"(replace), they want to modify the last generated image';
    prompt += '\n- Pay attention to the current discussion topic and mentioned clothing items';
    prompt += '\n- Maintain conversation continuity by referencing previous exchanges when relevant';

    return prompt;
  }

  shouldIncludeContext(userMessage: string): boolean {
    const contextTriggerWords = [
      '这个', '那个', '它', '这些', '那些',
      'this', 'that', 'it', 'these', 'those',
      '刚才', '之前', '上面', '前面', '刚刚',
      'just now', 'before', 'above', 'previously',
      '换', '改', '替换', '调整', '修改',
      'change', 'switch', 'replace', 'adjust', 'modify',
      '比较', '对比', '不如', '更好',
      'compare', 'than', 'better'
    ];

    return contextTriggerWords.some(word => userMessage.toLowerCase().includes(word)) ||
      this.sessionInfo.lastGeneratedImage !== undefined ||
      this.conversationHistory.length > 1;
  }

  // 新增方法：获取压缩统计
  getCompressionStats() {
    return this.sessionInfo.compressionStats;
  }

  // 新增方法：重置压缩统计
  resetCompressionStats() {
    this.sessionInfo.compressionStats = {
      totalImagesSent: 0,
      totalBytesOriginal: 0,
      totalBytesCompressed: 0,
      averageCompressionRatio: 0
    };
  }

  // 新增方法：检查是否有最近的图片
  hasRecentImage(): boolean {
    return !!this.sessionInfo.lastUploadedImage || !!this.sessionInfo.lastGeneratedImage;
  }

  // 新增方法：获取最后上传的图片URL
  getLastUploadedImage(): string | undefined {
    return this.sessionInfo.lastUploadedImage;
  }
}
