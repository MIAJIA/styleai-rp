import { NextRequest, NextResponse } from 'next/server';
import { SimpleChatAgent } from '@/lib/chat-agent';

// 简单的内存存储，用于保存会话
const chatAgents = new Map<string, SimpleChatAgent>();

function getChatAgent(sessionId: string): SimpleChatAgent {
  if (!chatAgents.has(sessionId)) {
    chatAgents.set(sessionId, new SimpleChatAgent());
  }
  return chatAgents.get(sessionId)!;
}

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId } = await request.json();

    if (!message || !sessionId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const agent = getChatAgent(sessionId);
    const response = await agent.chat(message);

    return NextResponse.json({
      response,
      success: true
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: '服务器内部错误', success: false },
      { status: 500 }
    );
  }
}