import { GoogleGenAI } from "@google/genai";
import { ImageSize } from "../types";

export const chatWithGemini = async (
  message: string,
  history: { role: 'user' | 'model'; parts: { text: string }[] }[]
): Promise<string> => {
  // Initialize Gemini Client inside the function to ensure the latest API key is used
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview',
      config: {
        systemInstruction: `你是 'ToyBox Bot'，ToyBox 公仔店的超級可愛且樂於助人的 AI 購物助手。
        
        你的語氣：開朗、有禮貌，喜歡使用 ✨, 🌸, 🧸 等表情符號。非常友善和甜蜜。請用繁體中文回答。
        你的目標：幫助顧客找到可愛的公仔，回答運送問題（我們充滿愛心地運送到世界各地！❤️），讓他們的購物體驗充滿快樂。
        
        商店資訊：
        - 我們販售科幻 (Sci-Fi)、奇幻 (Fantasy) 和動漫 (Anime) 公仔。
        - 我們有一個 '夢想工廠 (Dream Factory)'，您可以在那裡設計自己的公仔！
        - 30 天退貨政策（如果您不是 100% 滿意）。
        - 訂單滿 $200 免運費。
        
        如果用戶詢問生成圖片，請興奮地引導他們去 '夢想工廠' 頁面！
        `,
      },
      history: history,
    });

    const result = await chat.sendMessage({ message });
    return result.text || "哎呀！我有點糊塗了。你能再說一遍嗎？🌸";
  } catch (error) {
    console.error("Chat Error:", error);
    return "哎呀！我的大腦需要小睡一下。請稍後再試！💤";
  }
};

export const generateFigureImage = async (
  prompt: string,
  size: ImageSize
): Promise<string | null> => {
  // Initialize Gemini Client inside the function to ensure the latest API key is used
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          {
            text: `A cute, high-quality collectible figure: ${prompt}. Bright studio lighting, soft pastel colors where appropriate, detailed textures, 8k resolution, on a clean soft background.`,
          },
        ],
      },
      config: {
        imageConfig: {
          imageSize: size,
          aspectRatio: "1:1",
        },
      },
    });

    // Extract image from response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image Gen Error:", error);
    throw error;
  }
};