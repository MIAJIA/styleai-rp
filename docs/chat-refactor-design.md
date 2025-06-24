# ChatPage 代码架构重构设计方案

## 🎯 重构目标

将1476行的巨型组件 `app/chat/page.tsx` 重构为模块化、可维护、可扩展的架构

## 📊 当前问题分析

### **代码复杂度统计**

- **总行数**: 1476行
- **状态变量**: 18个 useState + 2个 useRef
- **函数方法**: 15个主要函数
- **硬编码数据**: 样式配置、提示语等
- **职责混合**: UI渲染、状态管理、业务逻辑、API调用全在一个文件

### **主要问题**

1. **单一职责原则违反**: 一个组件处理所有逻辑
2. **状态管理混乱**: 18个状态变量互相依赖
3. **代码重复**: 消息处理逻辑重复
4. **难以测试**: 业务逻辑与UI紧耦合
5. **扩展困难**: 添加新功能需要修改核心文件

## 🏗️ 重构架构设计

### **目录结构**

```
app/chat/
├── page.tsx                    # 主入口 (< 100行)
├── components/                 # UI组件
│   ├── ChatContainer.tsx       # 聊天容器
│   ├── ChatHeader.tsx          # 头部导航
│   ├── MessageList.tsx         # 消息列表
│   ├── ChatBubble.tsx          # 消息气泡
│   ├── MessageInput.tsx        # 输入组件
│   ├── ModeSwitch.tsx          # 模式切换
│   ├── QuickSuggestions.tsx    # 快捷建议
│   └── DebugPanel.tsx          # 调试面板
├── hooks/                      # 自定义Hooks
│   ├── useChat.ts              # 聊天逻辑
│   ├── useChatMessages.ts      # 消息管理
│   ├── useChatGeneration.ts    # 生成流程
│   ├── useFreeChat.ts          # 自由对话
│   ├── usePolling.ts           # 轮询管理
│   └── useChatData.ts          # 数据管理
├── types/                      # 类型定义
│   ├── chat.ts                 # 聊天相关类型
│   └── generation.ts           # 生成相关类型
├── utils/                      # 工具函数
│   ├── messageHelpers.ts       # 消息处理
│   ├── chatHelpers.ts          # 聊天工具
│   └── constants.ts            # 常量配置
└── contexts/                   # Context提供者
    └── ChatContext.tsx         # 聊天上下文
```

## 📝 详细重构方案

### **1. 类型定义重构**

```typescript
// app/chat/types/chat.ts
export interface ChatMessage {
  id: string;
  type: 'text' | 'image' | 'loading' | 'audio' | 'suggestion' | 'system';
  role: 'ai' | 'user' | 'system';
  content?: string;
  imageUrl?: string;
  audioUrl?: string;
  loadingText?: string;
  timestamp: Date;
  metadata?: {
    suggestions?: string[];
    confidence?: number;
    replyTo?: string;
    reactions?: Reaction[];
  };
}

export interface ChatState {
  messages: ChatMessage[];
  isGenerating: boolean;
  currentStep: ChatStep;
  isFreeMode: boolean;
  sessionId: string;
  isLoading: boolean;
}

export interface ChatActions {
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  deleteMessage: (id: string) => void;
  clearMessages: () => void;
  setGenerating: (generating: boolean) => void;
  switchMode: (mode: boolean) => void;
}
```

```typescript
// app/chat/types/generation.ts
export interface ChatModeData {
  selfiePreview: string;
  clothingPreview: string;
  occasion: string;
  generationMode: 'tryon-only' | 'simple-scene' | 'advanced-scene';
  selectedPersona: object | null;
  selfieFile: File | null;
  clothingFile: File | null;
  timestamp: number;
}

export type ChatStep = 'suggestion' | 'generating' | 'complete' | 'error';

export interface GenerationState {
  jobId: string | null;
  pollingIntervalId: NodeJS.Timeout | null;
  hasAutoStarted: boolean;
  hasProcessedCompletion: boolean;
  pollingError: string | null;
  intermediateImageDisplayed: boolean;
}
```

### **2. Context 和状态管理**

```typescript
// app/chat/contexts/ChatContext.tsx
import React, { createContext, useContext, useReducer } from 'react';
import { ChatState, ChatActions, ChatMessage } from '../types/chat';

interface ChatContextValue extends ChatState, ChatActions {}

const ChatContext = createContext<ChatContextValue | null>(null);

type ChatAction =
  | { type: 'ADD_MESSAGE'; payload: Omit<ChatMessage, 'id' | 'timestamp'> }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; updates: Partial<ChatMessage> } }
  | { type: 'DELETE_MESSAGE'; payload: string }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'SET_GENERATING'; payload: boolean }
  | { type: 'SWITCH_MODE'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean };

const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case 'ADD_MESSAGE':
      const newMessage: ChatMessage = {
        ...action.payload,
        id: generateMessageId(),
        timestamp: new Date(),
      };
      return { ...state, messages: [...state.messages, newMessage] };

    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.id ? { ...msg, ...action.payload.updates } : msg
        ),
      };

    case 'DELETE_MESSAGE':
      return {
        ...state,
        messages: state.messages.filter(msg => msg.id !== action.payload),
      };

    case 'CLEAR_MESSAGES':
      return { ...state, messages: [] };

    case 'SET_GENERATING':
      return { ...state, isGenerating: action.payload };

    case 'SWITCH_MODE':
      return { ...state, isFreeMode: action.payload };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    default:
      return state;
  }
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, {
    messages: [],
    isGenerating: false,
    currentStep: 'suggestion',
    isFreeMode: false,
    sessionId: generateSessionId(),
    isLoading: false,
  });

  const actions: ChatActions = {
    addMessage: (message) => dispatch({ type: 'ADD_MESSAGE', payload: message }),
    updateMessage: (id, updates) => dispatch({ type: 'UPDATE_MESSAGE', payload: { id, updates } }),
    deleteMessage: (id) => dispatch({ type: 'DELETE_MESSAGE', payload: id }),
    clearMessages: () => dispatch({ type: 'CLEAR_MESSAGES' }),
    setGenerating: (generating) => dispatch({ type: 'SET_GENERATING', payload: generating }),
    switchMode: (mode) => dispatch({ type: 'SWITCH_MODE', payload: mode }),
  };

  return (
    <ChatContext.Provider value={{ ...state, ...actions }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider');
  }
  return context;
};
```

### **3. 核心Hooks重构**

```typescript
// app/chat/hooks/useChatMessages.ts
import { useCallback } from 'react';
import { useChatContext } from '../contexts/ChatContext';
import { ChatMessage } from '../types/chat';

export const useChatMessages = () => {
  const { messages, addMessage, updateMessage, deleteMessage } = useChatContext();

  const addTextMessage = useCallback((content: string, role: 'ai' | 'user') => {
    addMessage({
      type: 'text',
      role,
      content,
    });
  }, [addMessage]);

  const addImageMessage = useCallback((imageUrl: string, role: 'ai' | 'user') => {
    addMessage({
      type: 'image',
      role,
      imageUrl,
    });
  }, [addMessage]);

  const addLoadingMessage = useCallback((loadingText?: string) => {
    addMessage({
      type: 'loading',
      role: 'ai',
      loadingText,
    });
  }, [addMessage]);

  const replaceLastLoadingMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const lastLoadingIndex = messages.findLastIndex(msg => msg.type === 'loading');
    if (lastLoadingIndex !== -1) {
      updateMessage(messages[lastLoadingIndex].id, message);
    } else {
      addMessage(message);
    }
  }, [messages, updateMessage, addMessage]);

  return {
    messages,
    addTextMessage,
    addImageMessage,
    addLoadingMessage,
    replaceLastLoadingMessage,
    updateMessage,
    deleteMessage,
  };
};
```

```typescript
// app/chat/hooks/useFreeChat.ts
import { useState, useCallback } from 'react';
import { useChatMessages } from './useChatMessages';

export const useFreeChat = (sessionId: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [userInput, setUserInput] = useState('');
  const { addTextMessage, addLoadingMessage, replaceLastLoadingMessage } = useChatMessages();

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || isLoading) return;

    setIsLoading(true);

    // Add user message
    addTextMessage(message, 'user');

    // Add loading message
    addLoadingMessage('AI正在思考中...');

    try {
      const response = await fetch('/api/chat/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId }),
      });

      const data = await response.json();

      if (data.success && data.response) {
        replaceLastLoadingMessage({
          type: 'text',
          role: 'ai',
          content: data.response,
        });
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      replaceLastLoadingMessage({
        type: 'text',
        role: 'ai',
        content: '抱歉，我遇到了一些问题。请稍后再试。',
      });
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, isLoading, addTextMessage, addLoadingMessage, replaceLastLoadingMessage]);

  return {
    userInput,
    setUserInput,
    isLoading,
    sendMessage,
  };
};
```

```typescript
// app/chat/hooks/useChatGeneration.ts
import { useState, useRef, useCallback } from 'react';
import { GenerationState } from '../types/generation';
import { useChatMessages } from './useChatMessages';

export const useChatGeneration = () => {
  const [state, setState] = useState<GenerationState>({
    jobId: null,
    pollingIntervalId: null,
    hasAutoStarted: false,
    hasProcessedCompletion: false,
    pollingError: null,
    intermediateImageDisplayed: false,
  });

  const processedStatusesRef = useRef<Set<string>>(new Set());
  const { addLoadingMessage, replaceLastLoadingMessage, addImageMessage } = useChatMessages();

  const startGeneration = useCallback(async (chatData: any) => {
    // 生成逻辑实现
    setState(prev => ({ ...prev, hasAutoStarted: true }));
    addLoadingMessage('正在准备生成您的专属穿搭建议...');

    // 调用生成API
    // ... 实现生成逻辑
  }, [addLoadingMessage]);

  const startPolling = useCallback((jobId: string) => {
    // 轮询逻辑实现
    // ... 实现轮询逻辑
  }, []);

  return {
    ...state,
    startGeneration,
    startPolling,
    processedStatusesRef,
  };
};
```

### **4. UI组件重构**

```typescript
// app/chat/components/ChatHeader.tsx
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export const ChatHeader = () => {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200">
      <div className="flex items-center justify-between px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="p-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-playfair text-lg font-bold text-gray-800">AI Stylist</h1>
        <div className="w-9" />
      </div>
    </header>
  );
};
```

```typescript
// app/chat/components/ModeSwitch.tsx
import { MessageCircle, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatContext } from '../contexts/ChatContext';

export const ModeSwitch = () => {
  const { isFreeMode, isGenerating, isLoading, switchMode } = useChatContext();

  const handleModeSwitch = () => {
    switchMode(!isFreeMode);
  };

  return (
    <div className="sticky top-16 z-20 px-4 py-2 bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/95 backdrop-blur-lg rounded-2xl p-4 shadow-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
                isFreeMode
                  ? 'bg-blue-500 animate-pulse shadow-lg shadow-blue-200'
                  : 'bg-green-500 shadow-lg shadow-green-200'
              }`}></div>
              <div>
                <span className="text-sm font-semibold text-gray-800">
                  {isFreeMode ? '🗣️ 自由对话模式' : '🎯 引导生成模式'}
                </span>
                <p className="text-xs text-gray-600 mt-0.5">
                  {isFreeMode
                    ? '随意提问任何穿搭问题，AI会智能回答'
                    : '按流程上传照片，AI生成个性化穿搭建议'
                  }
                </p>
              </div>
            </div>
            <Button
              onClick={handleModeSwitch}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 hover:bg-gray-50 active:bg-gray-100 transition-all duration-200 border-2 px-4 py-2 min-w-[100px]"
              disabled={isLoading}
              type="button"
            >
              {isFreeMode ? (
                <>
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline font-medium">引导模式</span>
                </>
              ) : (
                <>
                  <MessageCircle className="w-4 h-4" />
                  <span className="hidden sm:inline font-medium">自由对话</span>
                  {isGenerating && (
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse ml-1"
                         title="生成进行中，可以切换但进程将在后台继续">
                    </div>
                  )}
                </>
              )}
            </Button>
          </div>

          {/* Status indicator */}
          {(isGenerating || isLoading) && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  <span className="text-xs text-gray-600 font-medium">
                    {isGenerating ? '正在生成穿搭建议...' : '正在处理您的问题...'}
                  </span>
                </div>
                {isGenerating && (
                  <span className="text-xs text-gray-500">可随时切换模式 →</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

```typescript
// app/chat/components/MessageInput.tsx
import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFreeChat } from '../hooks/useFreeChat';
import { useChatContext } from '../contexts/ChatContext';
import { QuickSuggestions } from './QuickSuggestions';

export const MessageInput = () => {
  const { isFreeMode, sessionId } = useChatContext();
  const { userInput, setUserInput, isLoading, sendMessage } = useFreeChat(sessionId);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (userInput.trim()) {
        sendMessage(userInput);
        setUserInput('');
      }
    }
  };

  const handleSend = () => {
    if (userInput.trim()) {
      sendMessage(userInput);
      setUserInput('');
    }
  };

  if (!isFreeMode) return null;

  return (
    <div className="max-w-2xl mx-auto mt-6">
      <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="问我任何穿搭问题... (按Enter发送，Shift+Enter换行)"
              className="w-full p-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent resize-none bg-white/70"
              rows={3}
              disabled={isLoading}
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={!userInput.trim() || isLoading}
            className="bg-[#FF6EC7] hover:bg-[#FF6EC7]/90 p-3 transition-all"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>

        <QuickSuggestions
          onSuggestionClick={(suggestion) => {
            setUserInput(suggestion);
            setTimeout(() => handleSend(), 100);
          }}
          disabled={isLoading}
        />
      </div>
    </div>
  );
};
```

```typescript
// app/chat/components/MessageList.tsx
import { useEffect, useRef } from 'react';
import { ChatBubble } from './ChatBubble';
import { useChatContext } from '../contexts/ChatContext';

export const MessageList = () => {
  const { messages } = useChatContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex-1 px-4 py-6 space-y-4">
      <div className="max-w-2xl mx-auto">
        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
```

### **5. 主页面重构**

```typescript
// app/chat/page.tsx
'use client';

import { ChatProvider } from './contexts/ChatContext';
import { ChatContainer } from './components/ChatContainer';

export default function ChatPage() {
  return (
    <ChatProvider>
      <ChatContainer />
    </ChatProvider>
  );
}
```

```typescript
// app/chat/components/ChatContainer.tsx
import { ChatHeader } from './ChatHeader';
import { ModeSwitch } from './ModeSwitch';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { DebugPanel } from './DebugPanel';
import { ImageModal } from './ImageModal';

export const ChatContainer = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 pb-20">
      <ChatHeader />
      <ModeSwitch />
      <MessageList />
      <MessageInput />
      <DebugPanel />
      <ImageModal />
    </div>
  );
};
```

## 🚀 重构实施计划

### **阶段1: 基础架构 (1天)**

1. 创建目录结构和类型定义
2. 实现 ChatContext 和基础状态管理
3. 重构主页面入口

### **阶段2: 核心Hooks (1天)**

1. 实现 useChatMessages
2. 实现 useFreeChat
3. 实现 useChatGeneration

### **阶段3: UI组件拆分 (0.5天)**

1. 拆分 ChatHeader, ModeSwitch
2. 拆分 MessageList, MessageInput
3. 重构 ChatBubble

### **阶段4: 测试和优化 (0.5天)**

1. 功能测试确保无回归
2. 性能优化
3. 代码清理

## 📊 重构效果预期

### **代码质量提升**

- **主文件行数**: 1476行 → < 50行
- **单一职责**: ✅ 每个组件职责明确
- **可测试性**: ✅ 业务逻辑与UI分离
- **可维护性**: ✅ 模块化结构清晰

### **开发效率提升**

- **功能扩展**: 新增功能只需修改相关模块
- **Bug修复**: 问题定位更加精准
- **团队协作**: 多人可并行开发不同模块
- **代码复用**: Hooks和组件可在其他页面复用

### **性能优化**

- **渲染优化**: 组件粒度更细，减少不必要重渲染
- **代码分割**: 支持懒加载和代码分割
- **内存管理**: 更好的状态管理和清理机制

这个重构方案将显著提升代码质量和开发效率，为后续功能扩展打下坚实基础。
