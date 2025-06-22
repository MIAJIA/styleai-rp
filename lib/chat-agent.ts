import { ChatOpenAI } from '@langchain/openai';
import { ConversationChain } from 'langchain/chains';
import { BufferMemory } from 'langchain/memory';

export class SimpleChatAgent {
  private chain: ConversationChain;

  constructor() {
    const llm = new ChatOpenAI({
      modelName: 'gpt-4',
      temperature: 0.7,
    });

    this.chain = new ConversationChain({
      llm,
      memory: new BufferMemory(),
    });
  }

  async chat(message: string): Promise<string> {
    const response = await this.chain.call({ input: message });
    return response.response;
  }
}