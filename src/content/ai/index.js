import aiWhy from './ai-why.js'
import aiLlmInternals from './ai-llm-internals.js'
import aiInference from './ai-inference.js'
import aiFirstCall from './ai-first-call.js'
import aiPrompting from './ai-prompting.js'
import aiStructuredOutput from './ai-structured-output.js'
import aiContext from './ai-context.js'
import aiEmbeddings from './ai-embeddings.js'
import aiChunking from './ai-chunking.js'
import aiRag from './ai-rag.js'
import aiRagAdvanced from './ai-rag-advanced.js'
import aiTools from './ai-tools.js'
import aiAgentLoop from './ai-agent-loop.js'
import aiAgentDesign from './ai-agent-design.js'
import aiMemory from './ai-memory.js'
import aiMcp from './ai-mcp.js'
import aiMultiAgent from './ai-multi-agent.js'
import aiWorkflows from './ai-workflows.js'
import aiEvals from './ai-evals.js'
import aiSafety from './ai-safety.js'
import aiProduction from './ai-production.js'

export const topics = [
  aiWhy, aiLlmInternals, aiInference, aiFirstCall, aiPrompting,
  aiStructuredOutput, aiContext, aiEmbeddings, aiChunking, aiRag, aiRagAdvanced,
  aiTools, aiAgentLoop, aiAgentDesign, aiMemory, aiMcp, aiMultiAgent,
  aiWorkflows, aiEvals, aiSafety, aiProduction,
]

export const tiers = [
  {
    name: 'Foundations',
    blurb: 'What a language model actually is, how it works inside, how inference behaves, and how to prompt it so the output is predictable.',
  },
  {
    name: 'Core',
    blurb: 'Everything you put into the context window: guaranteed output shapes, a deliberate token budget, embeddings, chunking and RAG.',
  },
  {
    name: 'Advanced',
    blurb: 'Letting the model act — tool use, the agent loop, tool-surface design, memory, MCP and multi-agent systems.',
  },
  {
    name: 'Elite',
    blurb: 'Making it survive: workflow topologies, evals that turn opinion into a number, prompt-injection defence and production operations.',
  },
]
