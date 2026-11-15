// Re-export shared types and interfaces for client application
export interface ChatMessageParam {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIResponse {
  success: boolean;
  reply: string;
  provider: "gemini" | "groq" | "grok" | "openai" | "open-llm" | "local";
  modelUsed: string;
  error?: string;
}

export interface AISettingsConfig {
  gemini_api_key?: string;
  gemini_api_key_masked?: string;
  gemini_model?: string;
  gemini_configured?: boolean;

  groq_api_key?: string;
  groq_api_key_masked?: string;
  groq_model?: string;
  groq_configured?: boolean;

  grok_api_key?: string;
  grok_api_key_masked?: string;
  grok_model?: string;
  grok_configured?: boolean;

  openai_api_key?: string;
  openai_api_key_masked?: string;
  openai_model?: string;
  openai_configured?: boolean;

  ai_system_instructions?: string;
}
