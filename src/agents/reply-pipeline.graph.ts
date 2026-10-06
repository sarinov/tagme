import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';
import { RELEVANCE_SYSTEM_PROMPT, REPLY_SYSTEM_PROMPT } from './prompts';

export interface CandidateInput {
  threadsPostId: string;
  text: string;
  authorUsername?: string;
  matchedKeyword?: string;
  source: string;
}

const RelevanceSchema = z.object({
  score: z.number().min(0).max(1),
  reason: z.string(),
});

const ReplySchema = z.object({
  reply: z.string().max(500),
});

/**
 * Typed wrapper around withStructuredOutput. The `as any` casts are deliberate:
 * zod-schema generic inference here causes a TS type-instantiation explosion
 * (minutes-long typechecks). Runtime behavior (tool-calling + zod validation)
 * is unchanged.
 */
function structured<T>(llm: ChatGoogleGenerativeAI, schema: z.ZodType<T>) {
  return llm.withStructuredOutput(schema as any) as unknown as {
    invoke: (messages: [string, string][]) => Promise<T>;
  };
}

const PipelineState = Annotation.Root({
  candidate: Annotation<CandidateInput>(),
  relevanceScore: Annotation<number>(),
  relevanceReason: Annotation<string>(),
  isRelevant: Annotation<boolean>(),
  draftReply: Annotation<string | null>(),
});

export type PipelineResult = typeof PipelineState.State;

export interface PipelineOptions {
  googleApiKey: string;
  model: string;
  relevanceThreshold: number;
}

/**
 * LangGraph pipeline: score relevance -> (if above threshold) draft a reply.
 *
 *   START -> relevanceFilter -> [relevant?] -> replyDrafter -> END
 *                                     \-> END (irrelevant)
 */
export function buildReplyPipeline(opts: PipelineOptions) {
  const llm = new ChatGoogleGenerativeAI({
    apiKey: opts.googleApiKey,
    model: opts.model,
    temperature: 0.3,
    maxOutputTokens: 512,
  });

  const relevanceFilter = async (state: typeof PipelineState.State) => {
    const result = await structured(llm, RelevanceSchema).invoke([
      ['system', RELEVANCE_SYSTEM_PROMPT],
      [
        'human',
        `Источник: ${state.candidate.source}` +
          (state.candidate.matchedKeyword ? ` (запрос: "${state.candidate.matchedKeyword}")` : '') +
          `\nАвтор: @${state.candidate.authorUsername ?? 'unknown'}\n\nПост:\n${state.candidate.text}`,
      ],
    ]);
    return {
      relevanceScore: result.score,
      relevanceReason: result.reason,
      isRelevant: result.score >= opts.relevanceThreshold,
    };
  };

  const replyDrafter = async (state: typeof PipelineState.State) => {
    const result = await structured(llm, ReplySchema).invoke([
      ['system', REPLY_SYSTEM_PROMPT],
      [
        'human',
        `Пост от @${state.candidate.authorUsername ?? 'unknown'}:\n${state.candidate.text}\n\nНапиши ответ.`,
      ],
    ]);
    return { draftReply: result.reply };
  };

  const graph = new StateGraph(PipelineState)
    .addNode('relevanceFilter', relevanceFilter)
    .addNode('replyDrafter', replyDrafter)
    .addEdge(START, 'relevanceFilter')
    .addConditionalEdges('relevanceFilter', (state) => (state.isRelevant ? 'replyDrafter' : END), {
      replyDrafter: 'replyDrafter',
      [END]: END,
    })
    .addEdge('replyDrafter', END);

  return graph.compile();
}
