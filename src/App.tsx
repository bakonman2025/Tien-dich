import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowRightLeft, Settings2, BookOpen, UserCircle, 
  Plus, Trash2, Copy, Check, Sparkles, Loader2, Play,
  Zap, Save, Download, Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PronounRule, RuleMapping } from './types';
import { translateNovelText, extractRulesFromTranslation, extractRulesFromContext } from './lib/gemini';

const GENRES: string[] = [
  "Action", "Adult", "Adventure", "Comedy", "Crossdressing", "Dark Comedy", 
  "Depiction of Cruelty", "Drama", "Ecchi", "Fantasy", "Gender Bender", "Gore", 
  "Harem", "Historical", "Horror", "Josei", "Magical Girl", "Martial Arts", 
  "Mature", "Misunderstanding", "MTL", "Mystery", "No Romance", "Psychological", 
  "Pure Love", "R15", "Revenge", "Romance", "School Life", "Sci-fi", "Seinen", 
  "Shoujo", "Shoujo Ai", "Shounen", "Slice of Life", "Smut", "Straight", 
  "Supernatural", "System", "Tragedy", "Wuxia", "Xianxia", "Xuanhuan", "Yuri"
];

export default function App() {
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Context Tab State
  const [activeTab, setActiveTab] = useState<'translate' | 'context'>('translate');
  const [contextText, setContextText] = useState("");
  const [isExtractingContext, setIsExtractingContext] = useState(false);
  const [extractedPronouns, setExtractedPronouns] = useState<{ speaker: string, listener: string, selfPronoun: string, otherPronoun: string }[]>([]);

  // Settings State
  const [selectedGenres, setSelectedGenres] = useState<string[]>(["Xianxia"]);
  const [names, setNames] = useState<RuleMapping[]>([
    { id: '1', zh: '林动', vi: 'Lâm Động' }
  ]);
  const [pronouns, setPronouns] = useState<PronounRule[]>([
    { id: '1', speaker: 'Sư phụ', listener: 'Đồ đệ', selfPronoun: 'vi sư', otherPronoun: 'ngươi' }
  ]);
  const [suggestedNames, setSuggestedNames] = useState<{ zh: string; vi: string }[]>([]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(true);

  // Helpers cho Dynamic Rules
  const addName = (zh: string = '', vi: string = '') => {
    setNames([...names, { id: Date.now().toString(), zh, vi }]);
  };
  
  const moveSuggestedToNames = (index: number) => {
    const item = suggestedNames[index];
    addName(item.zh, item.vi);
    setSuggestedNames(suggestedNames.filter((_, i) => i !== index));
  };
  const removeName = (id: string) => setNames(names.filter(n => n.id !== id));
  const updateName = (id: string, field: 'zh'|'vi', value: string) => {
    setNames(names.map(n => n.id === id ? { ...n, [field]: value } : n));
  };

  const addPronoun = () => setPronouns([...pronouns, { id: Date.now().toString(), speaker: '', listener: '', selfPronoun: '', otherPronoun: '' }]);
  const removePronoun = (id: string) => setPronouns(pronouns.filter(p => p.id !== id));
  const updatePronoun = (id: string, field: keyof PronounRule, value: string) => {
     setPronouns(pronouns.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const toggleGenre = (g: string) => {
    if (selectedGenres.includes(g)) {
      setSelectedGenres(selectedGenres.filter(x => x !== g));
    } else {
      setSelectedGenres([...selectedGenres, g]);
    }
  };

  const exportPronouns = () => {
    const jsonString = JSON.stringify(pronouns, null, 2);
    const blob = new Blob([jsonString], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tien-dich-xung-ho-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importPronouns = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        
        let newPronouns = [];
        if (Array.isArray(parsed)) {
          newPronouns = parsed;
        } else if (parsed.pronouns && Array.isArray(parsed.pronouns)) { // backwards compatibility
          newPronouns = parsed.pronouns;
        }

        if (newPronouns.length > 0) {
          setPronouns(prev => {
             const newArr = [...prev];
             newPronouns.forEach((item: any) => {
               if(!newArr.some(p => p.speaker === item.speaker && p.listener === item.listener)) {
                  newArr.push({ ...item, id: Date.now().toString() + Math.random().toString(36).substring(7) });
               }
             });
             return newArr;
          });
          alert("Đã nhập quy tắc xưng hô thành công!");
        } else {
          alert("Không tìm thấy quy tắc xưng hô trong file.");
        }
      } catch (error) {
        alert("Có lỗi khi đọc file. Đảm bảo bạn đang chọn đúng file txt xưng hô.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const exportNames = () => {
    const jsonString = JSON.stringify(names, null, 2);
    const blob = new Blob([jsonString], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tien-dich-danh-tu-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importNames = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        
        let newNames = [];
        if (Array.isArray(parsed)) {
          newNames = parsed;
        } else if (parsed.names && Array.isArray(parsed.names)) { // backwards compatibility
          newNames = parsed.names;
        }

        if (newNames.length > 0) {
          setNames(prev => {
             const newArr = [...prev];
             newNames.forEach((item: any) => {
               if(!newArr.some(n => n.zh === item.zh && n.vi === item.vi)) {
                  newArr.push({ ...item, id: Date.now().toString() + Math.random().toString(36).substring(7) });
               }
             });
             return newArr;
          });
          alert("Đã nhập danh từ riêng thành công!");
        } else {
          alert("Không tìm thấy danh từ riêng trong file.");
        }
      } catch (error) {
        alert("Có lỗi khi đọc file. Đảm bảo bạn đang chọn đúng file txt danh từ.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;
    setIsTranslating(true);
    try {
      setTranslatedText("");
      const result = await translateNovelText(sourceText, selectedGenres, names, pronouns, (chunkText) => {
        const formattedChunk = chunkText.split('\n').filter(line => line.trim() !== '').join('\n\n');
        setTranslatedText(formattedChunk);
      });
      const formattedResult = result.split('\n').filter(line => line.trim() !== '').join('\n\n');
      setTranslatedText(formattedResult);
      // Automatically extract names and pronouns after translation
      const resultData = await extractRulesFromTranslation(sourceText, formattedResult);
      
      setSuggestedNames(prev => {
        const newArr = [...prev];
        resultData.names.forEach(s => {
          if (!names.some(n => n.vi === s.vi || (s.zh && n.zh === s.zh)) &&
              !newArr.some(r => r.vi === s.vi || (s.zh && r.zh === s.zh))) {
             newArr.push({ zh: s.zh || "", vi: s.vi });
          }
        });
        return newArr;
      });

      setExtractedPronouns(prev => {
        const newArr = [...prev];
        resultData.pronouns.forEach(p => {
          if (!pronouns.some(existing => existing.speaker === p.speaker && existing.listener === p.listener) &&
              !newArr.some(existing => existing.speaker === p.speaker && existing.listener === p.listener)) {
            newArr.push(p);
          }
        });
        return newArr;
      });
    } catch (error) {
      alert("Đã xảy ra lỗi khi phiên dịch. Vui lòng kiểm tra lại cấu hình.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleCopy = async () => {
    if (!translatedText) return;
    
    const textToCopyPlain = translatedText.replace(/\r?\n/g, '\r\n');
    
    try {
      const htmlCopied = translatedText.split(/\r?\n\r?\n/).map(p => `<p>${p}</p>`).join('');
      const clipboardItem = new ClipboardItem({
        'text/plain': new Blob([textToCopyPlain], { type: 'text/plain' }),
        'text/html': new Blob([htmlCopied], { type: 'text/html' })
      });
      await navigator.clipboard.write([clipboardItem]);
    } catch(e) {
      // Fallback
      await navigator.clipboard.writeText(textToCopyPlain);
    }
    
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExtractContext = async () => {
    if (!contextText.trim()) return;
    setIsExtractingContext(true);
    try {
      const result = await extractRulesFromContext(contextText);
      
      setSuggestedNames(prev => {
        const newArr = [...prev];
        result.names.forEach((s: { zh?: string, vi: string }) => {
          if (!names.some(n => n.vi === s.vi || (s.zh && n.zh === s.zh)) &&
              !newArr.some(r => r.vi === s.vi || (s.zh && r.zh === s.zh))) {
             newArr.push({ zh: s.zh || "", vi: s.vi });
          }
        });
        return newArr;
      });
      
      setExtractedPronouns(prev => {
        const newArr = [...prev];
        result.pronouns.forEach(p => {
          if (!pronouns.some(existing => existing.speaker === p.speaker && existing.listener === p.listener) &&
              !newArr.some(existing => existing.speaker === p.speaker && existing.listener === p.listener)) {
            newArr.push(p);
          }
        });
        return newArr;
      });
    } catch (e) {
      alert("Đã xảy ra lỗi khi trích xuất quy tắc.");
    } finally {
      setIsExtractingContext(false);
    }
  };

  const moveExtractedPronounToRules = (index: number) => {
    const item = extractedPronouns[index];
    setPronouns([...pronouns, { 
      id: Date.now().toString(), 
      ...item
    }]);
    setExtractedPronouns(extractedPronouns.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-sans selection:bg-amber-500/30 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-[#222] px-6 flex items-center justify-between bg-[#0a0a0a] sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-amber-500 to-red-600 rounded-lg text-black">
            <span className="font-bold text-xl">T</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Tiên Dịch <span className="text-amber-500 text-xs font-mono ml-1 px-1.5 py-0.5 border border-amber-500/30 rounded">PRO</span>
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-2 text-sm text-[#888]">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Engine: Advanced Neural v4.2
          </div>
          <button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-colors ${
              isSettingsOpen ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-white text-black hover:bg-amber-500'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span className="hidden sm:inline">Cấu hình dịch</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row h-full w-full overflow-hidden">
        
        {/* Left/Top Sidebar: Control Center */}
        <AnimatePresence initial={false}>
          {isSettingsOpen && (
            <motion.aside 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-r border-[#222] bg-[#0a0a0a] overflow-y-auto flex-shrink-0"
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            >
              <div className="w-72 p-5 flex flex-col gap-6">
                
                {/* Genre Select */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-amber-500" />
                    <h2 className="text-[10px] uppercase tracking-[0.2em] text-amber-500 font-bold block">Thể loại bối cảnh</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {GENRES.map(g => {
                      const isSelected = selectedGenres.includes(g);
                      return (
                        <button
                          key={g}
                          onClick={() => toggleGenre(g)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            isSelected 
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' 
                              : 'bg-[#151515] border-[#333] text-[#888] hover:border-[#555] hover:text-[#ccc]'
                          }`}
                        >
                          {g}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pronoun Rules */}
                <div>
                  <div className="flex items-center justify-between mb-3 text-[#aaa]">
                    <div className="flex items-center gap-2">
                      <UserCircle className="w-4 h-4 text-amber-500" />
                      <h2 className="text-[10px] uppercase tracking-[0.2em] text-amber-500 font-bold block">Đại từ xưng hô</h2>
                    </div>
                    <button onClick={addPronoun} className="p-1 hover:bg-[#1a1a1a] rounded-md text-amber-500 transition-colors border border-transparent hover:border-amber-500/30">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[11px] text-[#888] mb-2 leading-relaxed">Quy định cách nhân vật xưng hô với nhau (Ai gọi Ai là gì)</p>
                  
                  <div className="space-y-2">
                    {pronouns.map((rule) => (
                      <div key={rule.id} className="flex flex-col gap-2 p-2 bg-[#151515] border border-[#222] rounded-md relative">
                        <div className="flex gap-2">
                          <input 
                            type="text" placeholder="Người nói (A)" 
                            value={rule.speaker} onChange={(e) => updatePronoun(rule.id, 'speaker', e.target.value)}
                            className="flex-1 min-w-0 bg-[#050505] border border-[#333] rounded px-2 py-1.5 text-xs outline-none focus:border-amber-500/50"
                          />
                          <span className="text-[#555] text-[10px] flex items-center shrink-0 uppercase tracking-wider font-semibold">Nói Vị...</span>
                          <input 
                            type="text" placeholder="Người nghe (B)" 
                            value={rule.listener} onChange={(e) => updatePronoun(rule.id, 'listener', e.target.value)}
                            className="flex-1 min-w-0 bg-[#050505] border border-[#333] rounded px-2 py-1.5 text-xs outline-none focus:border-amber-500/50"
                          />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 mt-1">
                          <div className="flex-1 flex items-center bg-[#0a0a0a] border border-[#222] rounded overflow-hidden focus-within:border-amber-500/50">
                            <span className="text-[10px] text-amber-500/80 px-2 uppercase font-bold shrink-0">Xưng:</span>
                            <input 
                              type="text" placeholder="Vd: tại hạ" 
                              value={rule.selfPronoun} onChange={(e) => updatePronoun(rule.id, 'selfPronoun', e.target.value)}
                              className="flex-1 w-full bg-transparent border-none py-1.5 pr-2 text-xs outline-none text-white placeholder:text-[#444]"
                            />
                          </div>
                          <div className="flex-1 flex items-center bg-[#0a0a0a] border border-[#222] rounded overflow-hidden focus-within:border-amber-500/50">
                            <span className="text-[10px] text-amber-500/80 px-2 uppercase font-bold shrink-0">Hô:</span>
                            <input 
                              type="text" placeholder="Vd: các hạ" 
                              value={rule.otherPronoun} onChange={(e) => updatePronoun(rule.id, 'otherPronoun', e.target.value)}
                              className="flex-1 w-full bg-transparent border-none py-1.5 pr-2 text-xs outline-none text-white placeholder:text-[#444]"
                            />
                          </div>
                        </div>
                        <button onClick={() => removePronoun(rule.id)} className="absolute -right-2 -top-2 p-1 text-[#555] opacity-50 hover:opacity-100 hover:text-red-400 bg-[#151515] rounded-full border border-[#333] transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {pronouns.length === 0 && (
                      <div className="text-[11px] text-[#555] text-center p-3 bg-[#151515] rounded-md border border-[#222]">
                        Chưa có quy tắc xưng hô nào.
                      </div>
                    )}
                  </div>
                  <div className="pt-2">
                    <div className="flex gap-2">
                      <button onClick={exportPronouns} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#151515] border border-[#222] hover:border-amber-500/50 hover:text-amber-500 rounded text-xs transition-colors text-[#888]">
                        <Download className="w-3.5 h-3.5" /> Xuất xưng hô
                      </button>
                      <label className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#151515] border border-[#222] hover:border-amber-500/50 hover:text-amber-500 rounded text-xs transition-colors cursor-pointer text-[#888]">
                        <Upload className="w-3.5 h-3.5" /> Nhập (.txt)
                        <input type="file" accept=".txt" className="hidden" onChange={importPronouns} />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Specific Nouns */}
                <div>
                  <div className="flex items-center justify-between mb-3 text-[#aaa]">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-amber-500" />
                      <h2 className="text-[10px] uppercase tracking-[0.2em] text-amber-500 font-bold block">Danh từ riêng</h2>
                    </div>
                    <button onClick={addName} className="p-1 hover:bg-[#1a1a1a] rounded-md text-amber-500 transition-colors border border-transparent hover:border-amber-500/30">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[11px] text-[#888] mb-2 leading-relaxed">Cố định dịch tên nhân vật, địa danh, chiêu thức.</p>
                  
                  <div className="space-y-2">
                    {names.map((rule) => (
                      <div key={rule.id} className="flex gap-2">
                        <input 
                          type="text" placeholder="Tiếng Trung" 
                          value={rule.zh} onChange={(e) => updateName(rule.id, 'zh', e.target.value)}
                          className="flex-1 min-w-0 bg-[#151515] border border-[#222] rounded-md px-3 py-2 text-xs outline-none focus:border-amber-500/50"
                        />
                        <input 
                          type="text" placeholder="Tiếng Việt" 
                          value={rule.vi} onChange={(e) => updateName(rule.id, 'vi', e.target.value)}
                          className="flex-1 min-w-0 bg-[#151515] border border-[#222] rounded-md px-3 py-2 text-xs outline-none focus:border-amber-500/50"
                        />
                        <button onClick={() => removeName(rule.id)} className="p-2 text-[#555] hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {names.length === 0 && (
                      <div className="text-[11px] text-[#555] text-center p-3 bg-[#151515] rounded-md border border-[#222]">
                        Chưa có danh từ riêng nào.
                      </div>
                    )}
                  </div>
                </div>

                {/* Export/Import Rules */}
                <div className="pt-2">
                  <div className="flex gap-2">
                    <button onClick={exportNames} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#151515] border border-[#333] hover:border-amber-500/50 hover:text-amber-500 rounded text-xs transition-colors text-[#888]">
                      <Download className="w-3.5 h-3.5" /> Xuất danh từ
                    </button>
                    <label className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#151515] border border-[#333] hover:border-amber-500/50 hover:text-amber-500 rounded text-xs transition-colors cursor-pointer text-[#888]">
                      <Upload className="w-3.5 h-3.5" /> Nhập (.txt)
                      <input type="file" accept=".txt" className="hidden" onChange={importNames} />
                    </label>
                  </div>
                </div>

                {/* Suggested Names Section */}
                <AnimatePresence>
                  {suggestedNames.length > 0 && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-3 pt-4 border-t border-amber-500/10"
                    >
                      <div className="flex items-center justify-between text-slate-300">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-amber-500 animate-pulse" />
                          <h2 className="text-[10px] uppercase tracking-[0.2em] text-amber-500 font-bold block">Gợi ý từ bản dịch</h2>
                        </div>
                        <button 
                          onClick={() => setSuggestedNames([])} 
                          className="text-[10px] text-[#555] hover:text-white uppercase transition-colors"
                        >
                          Xóa hết
                        </button>
                      </div>
                      <p className="text-[10px] text-[#666] leading-relaxed italic">AI đã phát hiện các danh từ sau. Chọn {<Plus className="inline w-3 h-3"/>} để lưu vào quy định.</p>
                      
                      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                        {suggestedNames.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-amber-500/5 rounded border border-amber-500/10 group">
                            <div className="flex flex-col">
                              <span className="text-[11px] text-white font-medium">{item.vi}</span>
                              <span className="text-[9px] text-amber-500/50">{item.zh}</span>
                            </div>
                            <button 
                              onClick={() => moveSuggestedToNames(idx)}
                              className="p-1.5 bg-[#0a0a0a] border border-[#333] rounded hover:border-amber-500/50 hover:text-amber-500 transition-all shadow-sm"
                              title="Thêm vào danh sách chính thức"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Suggested Pronouns Section */}
                <AnimatePresence>
                  {extractedPronouns.length > 0 && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-3 pt-4 border-t border-amber-500/10"
                    >
                      <div className="flex items-center justify-between text-slate-300">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-emerald-500 animate-pulse" />
                          <h2 className="text-[10px] uppercase tracking-[0.2em] text-emerald-500 font-bold block">Gợi ý xưng hô</h2>
                        </div>
                        <button 
                          onClick={() => setExtractedPronouns([])} 
                          className="text-[10px] text-[#555] hover:text-white uppercase transition-colors"
                        >
                          Xóa hết
                        </button>
                      </div>
                      
                      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                        {extractedPronouns.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-emerald-500/5 rounded border border-emerald-500/10 group">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] text-amber-500/80">{item.speaker} → {item.listener}</span>
                              <span className="text-[11px] text-white font-medium">Xưng: {item.selfPronoun} | Hô: {item.otherPronoun}</span>
                            </div>
                            <button 
                              onClick={() => moveExtractedPronounToRules(idx)}
                              className="p-1.5 bg-[#0a0a0a] border border-[#333] rounded hover:border-emerald-500/50 hover:text-emerald-500 transition-all shadow-sm"
                              title="Thêm vào danh sách chính thức"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Translation Workspace */}
        <section className="flex-1 flex flex-col pt-[1px] bg-[#222] overflow-y-auto">
          {/* Top Tab Bar */}
          <div className="flex items-center justify-center p-4 bg-[#0a0a0a] border-b border-[#333]">
            <div className="flex bg-[#151515] p-1 rounded-full border border-[#222]">
              <button 
                onClick={() => setActiveTab('translate')}
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-colors ${activeTab === 'translate' ? 'bg-[#333] text-white shadow-sm' : 'text-[#888] hover:text-[#ccc]'}`}
              >
                🪄 Dịch Thuật
              </button>
              <button 
                onClick={() => setActiveTab('context')}
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-colors ${activeTab === 'context' ? 'bg-[#333] text-white shadow-sm' : 'text-[#888] hover:text-[#ccc]'}`}
              >
                🧠 Rút Trích Quy Tắc
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col md:flex-row gap-px relative max-w-6xl mx-auto w-full px-4 py-8 md:px-8">
            {activeTab === 'translate' ? (
              <>
                {/* Source Area */}
                <div className="flex-1 flex flex-col h-[400px] md:h-[600px] bg-[#050505] p-6 lg:p-8 border border-[#333] rounded-t-xl md:rounded-t-none md:rounded-l-xl">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-mono text-[#555] uppercase">Source: Chinese (Simplified)</span>
                    <span className="text-[#555] text-xs">{sourceText.length} chars</span>
                  </div>
                  <textarea
                    className="flex-1 w-full bg-transparent border-none resize-none text-lg leading-relaxed text-[#ccc] focus:outline-none"
                    placeholder="Dán chương truyện tiếng Trung vào đây..."
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    spellCheck="false"
                  />
                </div>

                {/* Action Button (Center on Desktop, Bottom of Source on Mobile) */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center pointer-events-none">
                  <button 
                    onClick={handleTranslate}
                    disabled={isTranslating || !sourceText.trim()}
                    className="pointer-events-auto bg-white hover:bg-amber-500 text-black p-4 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.2)] disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-all group"
                    title="Dịch nội dung"
                  >
                    {isTranslating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <ArrowRightLeft className="w-5 h-5 group-hover:text-black" />
                    )}
                  </button>
                </div>

                {/* Mobile Translate Button Float */}
                <div className="md:hidden absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <button 
                    onClick={handleTranslate}
                    disabled={isTranslating || !sourceText.trim()}
                    className="pointer-events-auto bg-amber-500 text-black p-3 rounded-full shadow-lg disabled:opacity-50 flex items-center"
                  >
                    {isTranslating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 ml-1 fill-black" />}
                  </button>
                </div>

                {/* Result Area */}
                <div className="flex-1 flex flex-col h-[400px] md:h-[600px] bg-[#080808] p-6 lg:p-8 relative border border-[#333] rounded-b-xl md:rounded-b-none md:rounded-r-xl">
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <span className="text-[10px] font-mono text-amber-500 uppercase">Target: Vietnamese (Advanced)</span>
                    <div className="flex gap-3 items-center">
                      <button 
                        onClick={handleCopy}
                        disabled={!translatedText}
                        className="flex items-center gap-1.5 text-xs text-[#888] hover:text-white disabled:text-[#444] transition-colors"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        <span>{copied ? 'Đã sao chép' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 w-full relative overflow-y-auto">
                    {!translatedText && !isTranslating && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-[#555] pointer-events-none text-center">
                        <p className="text-[#888] font-medium text-sm">Waiting for input...</p>
                        <p className="text-[11px] mt-2 max-w-xs leading-relaxed text-[#555]">Hệ thống sẽ áp dụng cấu trúc ngữ pháp và từ vựng chuyên ngành theo bộ quy tắc đã chọn.</p>
                      </div>
                    )}
                    {isTranslating && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-amber-500/80 bg-[#080808]/80 backdrop-blur-sm z-10">
                        <Loader2 className="w-8 h-8 animate-spin mb-4" />
                        <p className="font-medium text-sm animate-pulse">Running semantic translation...</p>
                      </div>
                    )}
                    
                    {/* Render Result (Preserving basic whitespace) */}
                    {translatedText && (
                      <div className="text-lg leading-relaxed text-[#eee]">
                        {translatedText.split('\n\n').map((paragraph, index) => (
                          <p key={index} className="mb-4">{paragraph}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Extract Rules Area */}
                <div className="flex-1 flex flex-col h-[600px] bg-[#050505] p-6 lg:p-8 border border-[#333] rounded-xl shadow-lg relative">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-mono text-emerald-500 uppercase">Context Extraction</span>
                    <span className="text-[#555] text-xs">{contextText.length} chars</span>
                  </div>
                  <p className="text-xs text-[#888] mb-4">
                    Dán một đoạn hoặc một chương đã dịch vào đây. AI sẽ phân tích văn cảnh để tìm ra danh từ riêng và quy tắc xưng hô cho bạn. Các quy tắc sẽ được cập nhật vào "Gợi ý" ở phần Cấu Hình.
                  </p>
                  <textarea
                    className="flex-1 w-full bg-transparent border-none resize-none text-lg leading-relaxed text-[#ccc] focus:outline-none mb-6"
                    placeholder="Dán đoạn truyện dịch ở đây..."
                    value={contextText}
                    onChange={(e) => setContextText(e.target.value)}
                    spellCheck="false"
                  />
                  <div className="flex items-center justify-center">
                    <button 
                      onClick={handleExtractContext}
                      disabled={isExtractingContext || !contextText.trim()}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-all flex items-center font-bold"
                    >
                      {isExtractingContext ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          Đang phân tích...
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5 mr-2" />
                          Rút Lấy Quy Tắc
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {/* Status Bar */}
          <footer className="h-6 bg-amber-600 text-black px-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider shrink-0">
            <span>Tiên Dịch Pro Engine Active</span>
            <span>API Status: Stable</span>
          </footer>
        </section>

      </main>
    </div>
  );
}

