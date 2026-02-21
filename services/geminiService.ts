import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateSecurePassword = async (context: string = ""): Promise<string> => {
  try {
    const ai = getAiClient();
    const model = "gemini-3-flash-preview";
    
    const prompt = context 
      ? `Generate a strong, secure, and unique password relevant to the context: "${context}". Return ONLY the password string, no explanation.`
      : `Generate a strong, secure, random password with a mix of letters, numbers, and symbols. Return ONLY the password string, no explanation.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    return response.text?.trim() || "S3cur3P@ssw0rd!";
  } catch (error) {
    console.error("Gemini password generation failed:", error);
    // Fallback if API fails
    return "Gemini-Err-Fallback-123!";
  }
};

export const analyzeSecurity = async (email: string): Promise<string> => {
    try {
        const ai = getAiClient();
        const model = "gemini-3-flash-preview";
        
        const prompt = `Act as a humorous security guard robot. The user "${email}" is trying to log in. Give a short, witty, 1-sentence welcome message acknowledging them.`;
    
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });
    
        return response.text?.trim() || "Welcome to the mainframe, human.";
      } catch (error) {
        console.error("Gemini analysis failed:", error);
        return "Access Request Processed.";
      }
}

export const searchWeb = async (query: string): Promise<string> => {
  try {
    const ai = getAiClient();
    const model = "gemini-3-flash-preview";
    
    const response = await ai.models.generateContent({
      model,
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const text = response.text || "No results found.";
    
    let sources = "";
    if (groundingMetadata?.groundingChunks) {
      const links = groundingMetadata.groundingChunks
        .map((chunk: any) => chunk.web?.uri)
        .filter((uri: string) => uri)
        .map((uri: string) => `[Source: ${uri}]`)
        .join("\n");
      if (links) sources = "\n\nSources:\n" + links;
    }

    return text + sources;
  } catch (error) {
    console.error("Gemini search failed:", error);
    return "Search unavailable at the moment.";
  }
};