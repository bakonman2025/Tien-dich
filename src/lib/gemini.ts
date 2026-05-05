import { GoogleGenAI } from "@google/genai";
import { RuleMapping, PronounRule } from "../types";

// Initialize the Gemini AI client lazily to avoid startup crashes if key is missing
let aiClient: GoogleGenAI | null = null;

const getAI = () => {
  if (aiClient) return aiClient;

  // AI Studio provides the key via process.env.GEMINI_API_KEY (mapped in vite.config.ts)
  // For Vercel, the user can set VITE_GEMINI_API_KEY which might also be available via process.env 
  // depending on how they set up their build.
  const apiKey = (process.env.GEMINI_API_KEY as string) || "";

  aiClient = new GoogleGenAI({ apiKey });
  return aiClient;
};

export async function translateNovelText(
  text: string,
  genres: string[],
  names: RuleMapping[],
  pronouns: PronounRule[],
  onChunk?: (text: string) => void
): Promise<string> {
  if (!text || !text.trim()) return "";

  const ai = getAI();

  // Prepare the rules for the prompt
  const namesRules = names.filter(n => n.zh.trim() && n.vi.trim());
  const pronounsRules = pronouns.filter(p => p.speaker.trim() || p.listener.trim());

  const namesPrompt = namesRules.length > 0 
    ? namesRules.map(n => `- Chữ/Tên "${n.zh}" -> BẮT BUỘC dịch là: "${n.vi}"`).join("\n")
    : "- Không có danh từ riêng đặc biệt.";

  const pronounsPrompt = pronounsRules.length > 0
    ? pronounsRules.map(p => `- Khi "${p.speaker || 'Ai đó'}" nói chuyện với "${p.listener || 'Ai đó'}": Xưng là "${p.selfPronoun || 'ta'}", gọi đối phương là "${p.otherPronoun || 'ngươi'}"`).join("\n")
    : "- Không có quy tắc xưng hô đặc biệt, hãy tự dịch cho phù hợp ngữ cảnh.";

  const genresPrompt = genres.length > 0
    ? genres.join(", ")
    : "Không xác định";

  const systemInstruction = `Bạn là một dịch giả Web Novel Trung - Việt chuyên nghiệp nhất với kiến thức sâu rộng về Hán Việt và văn học. Nhiệm vụ của bạn là dịch TOÀN BỘ văn bản gốc sang tiếng Việt một cách HOÀN HẢO.

YÊU CẦU CỐT LÕI (TUYỆT ĐỐI KHÔNG VI PHẠM):
1. KHÔNG ĐỂ SÓT BẤT KỲ CHỮ HÁN NÀO: Tuyệt đối không được để lại bất kỳ ký tự tiếng Trung nào trong bản dịch của bạn (Ví dụ: 的, 们, 我... TUYỆT ĐỐI KHÔNG ĐƯỢC XUẤT HIỆN). Mọi chữ Hán phải được dịch sang nghĩa tiếng Việt. Nếu gặp từ khó hiểu, hãy dịch theo âm Hán Việt. Bản dịch phải là 100% tiếng Việt thuần túy.
2. DỊCH ĐẦY ĐỦ 100%: Dịch chính xác từng dòng, từng câu. Không được lược bỏ, không được tóm tắt, không được tóm gọn đoạn văn, không được bỏ qua bất kỳ từ nào, kể cả những chi tiết nhỏ nhất.
3. BẢO TOÀN ĐỊNH DẠNG: Giữ nguyên cấu trúc xuống dòng, các dấu đoạn văn. Không tự ý gộp các đoạn.
4. CẤU TRÚC CHƯƠNG: Nếu rành rọt, bắt đầu bằng: *** Chương [Số] : [Tiêu đề chương]

VĂN PHONG VÀ NGỮ CẢNH:
- THỂ LOẠI: ${genresPrompt}. Hãy dùng hệ từ vựng phù hợp với thể loại này.
- MƯỢT MÀ: Ưu tiên tiếng Việt thuần thục, tránh cấu trúc câu "convert" khô cứng.
- DANH TỪ RIÊNG:
${namesPrompt}
- XƯNG HÔ GIAO TIẾP:
${pronounsPrompt}
- VĂN KỂ: Dùng ngôi thứ ba chuẩn mực (hắn, y, nàng, lão, thanh niên, nam tử...).`;

  try {
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3.1-pro-preview",
      contents: text,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.0,
      },
    });

    let fullText = "";
    for await (const chunk of responseStream) {
      if (chunk.text) {
        fullText += chunk.text;
        // Normalize chunks incrementally to avoid weird encoding artifacts if possible
        if (onChunk) {
          onChunk(fullText.normalize("NFC"));
        }
      }
    }
    
    return fullText.normalize("NFC");
  } catch (error) {
    console.error("Translation ERROR:", error);
    throw new Error("Lỗi khi kết nối tới AI. Vui lòng thử lại hoặc kiểm tra cấu hình.");
  }
}

export async function extractRulesFromTranslation(
  sourceText: string,
  translatedText: string
): Promise<{ 
  names: { zh: string, vi: string }[], 
  pronouns: { speaker: string, listener: string, selfPronoun: string, otherPronoun: string }[] 
}> {
  const prompt = `Dưới đây là một đoạn văn bản gốc tiếng Trung và bản dịch tiếng Việt.
Hãy trích xuất:
1. Các danh từ riêng quan trọng (tên người, địa danh, vật phẩm, chiêu thức). Phải có cả tiếng Trung và tiếng Việt.
2. Quy tắc xưng hô: Mối quan hệ giữa 2 người, và cách họ xưng hô (dựa vào bản dịch).

TRẢ VỀ KẾT QUẢ DƯỚI DẠNG JSON THEO CẤU TRÚC SAU:
{
  "names": [{"zh": "tiếng Trung", "vi": "tiếng Việt"}],
  "pronouns": [{"speaker": "Người A", "listener": "Người B", "selfPronoun": "cách A tự xưng", "otherPronoun": "cách A gọi B"}]
}

VĂN BẢN GỐC: ${sourceText.substring(0, 3000)}
BẢN DỊCH: ${translatedText.substring(0, 3000)}`;

  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "Bạn là trợ lý trích xuất dữ liệu. Chỉ trả về JSON, không giải thích.",
      }
    });

    const text = response.text || "{}";
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(cleanJson);
    return {
      names: Array.isArray(data.names) ? data.names : [],
      pronouns: Array.isArray(data.pronouns) ? data.pronouns : []
    };
  } catch (e) {
    console.error("Extraction error:", e);
    return { names: [], pronouns: [] };
  }
}

export async function extractRulesFromContext(
  contextText: string
): Promise<{ 
  names: { zh?: string, vi: string }[], 
  pronouns: { speaker: string, listener: string, selfPronoun: string, otherPronoun: string }[] 
}> {
  const prompt = `Dưới đây là một đoạn trích truyện dịch. Hãy phân tích và trích xuất các quy tắc dịch thuật để dùng cho các chương sau.

1. Danh từ riêng (Tên nhân vật, địa danh, vật phẩm, chiêu thức). Tìm tên tiếng Việt, nếu đoán được tiếng Trung thì ghi, không thì để trống.
2. Quy tắc xưng hô: Mối quan hệ giữa 2 người, và cách họ xưng hô.

VĂN BẢN:
${contextText.substring(0, 5000)}

TRẢ VỀ KẾT QUẢ DƯỚI DẠNG JSON THEO CẤU TRÚC SAU (không có thêm văn bản nào khác):
{
  "names": [{"zh": "từ tiếng trung (nếu có thể đoán)", "vi": "tên tiếng việt"}],
  "pronouns": [{"speaker": "Người A", "listener": "Người B (hoặc 'chung')", "selfPronoun": "cách A tự xưng (VD: ta)", "otherPronoun": "cách A gọi B (VD: ngươi)"}]
}`;

  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        systemInstruction: "Bạn là trợ lý trích xuất quy tắc dịch thuật. Chỉ trả về JSON thuần túy.",
        temperature: 0.1
      }
    });

    const text = response.text || "{}";
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(cleanJson);
    return {
      names: Array.isArray(data.names) ? data.names : [],
      pronouns: Array.isArray(data.pronouns) ? data.pronouns : []
    };
  } catch (e) {
    console.error("Extraction rules error:", e);
    return { names: [], pronouns: [] };
  }
}
