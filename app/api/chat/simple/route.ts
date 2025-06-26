import { NextRequest, NextResponse } from 'next/server';
import { ChatAgent } from '@/lib/chat-agent';

// Use ChatAgent for session storage
const chatAgents = new Map<string, ChatAgent>();

function getChatAgent(sessionId: string): ChatAgent {
  if (!chatAgents.has(sessionId)) {
    chatAgents.set(sessionId, new ChatAgent());
  }
  return chatAgents.get(sessionId)!;
}

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId, imageUrl, imageUrls, action } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const agent = getChatAgent(sessionId);

    // 处理特殊动作：添加生成的图片到上下文
    if (action === 'add_generated_image' && imageUrl) {
      // 添加生成的图片到ChatAgent的上下文中
      agent.addGeneratedImageToContext(imageUrl);
      return NextResponse.json({
        success: true,
        message: 'Generated image added to context'
      });
    }

    // 处理特殊动作：添加多个生成的图片到上下文
    if (action === 'add_generated_images' && imageUrls && Array.isArray(imageUrls)) {
      // 添加多个生成的图片到ChatAgent的上下文中
      agent.addGeneratedImagesToContext(imageUrls);
      return NextResponse.json({
        success: true,
        message: `${imageUrls.length} generated images added to context`
      });
    }

    // 常规聊天处理
    if (!message) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const { aiResponse, agentInfo, searchResults } = await agent.chat(message, imageUrl);

    return NextResponse.json({
      response: aiResponse,
      agentInfo,
      searchResults,
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
