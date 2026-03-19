import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Tesseract from 'tesseract.js';
import { 
  Camera, 
  ChevronLeft, 
  ChevronRight,
  X,
  FileText,
  Loader2,
  RotateCcw,
  Key,
  Cpu,
  AlertTriangle
} from 'lucide-react';

// --- Types ---
interface IngredientDetail {
  name: string;
  category: string;
  risk: 'Low' | 'Moderate' | 'High';
  description: string;
  impact: string;
  usedFor: string;
  dailyLimit: string;
}

interface AnalysisResult {
  productName: string;
  score: number;
  detectedIngredients: IngredientDetail[];
  recommendation: string;
  alternatives: string[];
  stats: {
    preservatives: number;
    sugars: number;
    colors: number;
    others: number;
  };
  engine: string;
}

// --- Local Smart Intelligence Database (Massive Expansion) ---
const LOCAL_DB: Record<string, any> = {
  "sugar": { category: "Sweetener", risk: "High", penalty: 15, description: "Refined sugar.", impact: "Insulin spikes.", usedFor: "Taste", dailyLimit: "25g" },
  "palm oil": { category: "Fat", risk: "Moderate", penalty: 10, description: "Industrial fat.", impact: "Heart health risk.", usedFor: "Texture", dailyLimit: "Limit" },
  "msg": { category: "Flavor", risk: "Moderate", penalty: 8, description: "Enhancer.", impact: "Sensitivities.", usedFor: "Taste", dailyLimit: "3g" },
  "hfcs": { category: "Sweetener", risk: "High", penalty: 18, description: "High Fructose Corn Syrup.", impact: "Metabolic syndrome.", usedFor: "Sugar substitute", dailyLimit: "Avoid" },
  "high fructose corn syrup": { category: "Sweetener", risk: "High", penalty: 18, description: "Artificial sweetener.", impact: "Liver health concerns.", usedFor: "Cheap sweetener", dailyLimit: "Avoid" },
  "aspartame": { category: "Sweetener", risk: "High", penalty: 15, description: "Artificial sugar.", impact: "Neurotoxicity risk.", usedFor: "Zero calorie", dailyLimit: "Limit" },
  "sucralose": { category: "Sweetener", risk: "Moderate", penalty: 10, description: "Artificial sugar.", impact: "Gut health impact.", usedFor: "Sweetener", dailyLimit: "Limit" },
  "maltodextrin": { category: "Filler", risk: "Moderate", penalty: 7, description: "Corn starch derivative.", impact: "Very high glycemic index.", usedFor: "Thickening", dailyLimit: "Limit" },
  "sodium benzoate": { category: "Preservative", risk: "Moderate", penalty: 9, description: "Fungal inhibitor.", impact: "Hyperactivity in kids.", usedFor: "Shelf life", dailyLimit: "5mg/kg" },
  "potassium sorbate": { category: "Preservative", risk: "Moderate", penalty: 6, description: "Mold inhibitor.", impact: "Generally safe but processed.", usedFor: "Shelf life", dailyLimit: "Limit" },
  "bha": { category: "Preservative", risk: "High", penalty: 15, description: "Antioxidant.", impact: "Possible carcinogen.", usedFor: "Shelf life", dailyLimit: "Avoid" },
  "bht": { category: "Preservative", risk: "High", penalty: 15, description: "Antioxidant.", impact: "Endocrine disruptor.", usedFor: "Shelf life", dailyLimit: "Avoid" },
  "red 40": { category: "Color", risk: "High", penalty: 12, description: "Synthetic dye.", impact: "Behavorial issues.", usedFor: "Visuals", dailyLimit: "Avoid" },
  "yellow 5": { category: "Color", risk: "High", penalty: 12, description: "Tartrazine.", impact: "Asthma/Allergies.", usedFor: "Color", dailyLimit: "Avoid" },
  "blue 1": { category: "Color", risk: "High", penalty: 12, description: "Synthetic dye.", impact: "Kidney health.", usedFor: "Visual", dailyLimit: "Limit" },
  "titanium dioxide": { category: "Color", risk: "High", penalty: 15, description: "Whitener.", impact: "DNA damage concerns.", usedFor: "Color", dailyLimit: "Banned in EU" },
  "carrageenan": { category: "Thickener", risk: "Moderate", penalty: 12, description: "Seafood gum.", impact: "Intestinal inflammation.", usedFor: "Creaminess", dailyLimit: "Limit" },
  "guar gum": { category: "Thickener", risk: "Low", penalty: 4, description: "Seed fiber.", impact: "Gas/Bloating.", usedFor: "Texture", dailyLimit: "Normal" },
  "soy lecithin": { category: "Emulsifier", risk: "Low", penalty: 3, description: "Soy extract.", impact: "Allergies.", usedFor: "Binding", dailyLimit: "Normal" },
  "dextrose": { category: "Sweetener", risk: "Moderate", penalty: 10, description: "Simple sugar.", impact: "Blood sugar spike.", usedFor: "Sweetener", dailyLimit: "Limit" },
  "canola oil": { category: "Fat", risk: "Moderate", penalty: 8, description: "Refined oil.", impact: "Omega-6 ratio.", usedFor: "Cooking", dailyLimit: "Limit" },
  "hydrogenated oil": { category: "Fat", risk: "High", penalty: 20, description: "Trans fat.", impact: "Heart disease.", usedFor: "Stability", dailyLimit: "Avoid" },
  "acesulfame k": { category: "Sweetener", risk: "High", penalty: 15, description: "Artificial sugar.", impact: "Thyroid issues.", usedFor: "Sweetener", dailyLimit: "Limit" }
};

const App: React.FC = () => {
  const [apiProvider, setApiProvider] = useState<'gemini' | 'deepseek'>(localStorage.getItem('API_PROVIDER') as any || 'deepseek');
  const [deepseekKey, setDeepseekKey] = useState<string>(localStorage.getItem('DEEPSEEK_API_KEY') || (import.meta as any).env?.VITE_DEEPSEEK_API_KEY || '');
  const [geminiKey, setGeminiKey] = useState<string>(localStorage.getItem('GEMINI_API_KEY') || (import.meta as any).env?.VITE_GEMINI_API_KEY || '');
  
  const [screen, setScreen] = useState<'home' | 'manual' | 'result' | 'settings'>('home');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [manualText, setManualText] = useState<string>('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeIng, setActiveIng] = useState<IngredientDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Local Audit Engine (On-Device Intelligence)
   */
  const performLocalAnalysis = (text: string): AnalysisResult => {
    const rawText = text.toLowerCase();
    const detected: IngredientDetail[] = [];
    let score = 100;
    let counts = { preservatives: 0, sugars: 0, colors: 0, others: 0 };

    Object.entries(LOCAL_DB).forEach(([key, data]) => {
      if (rawText.includes(key)) {
        detected.push({ name: key.toUpperCase(), ...data });
        score -= data.penalty;
        if (data.category === 'Sweetener') counts.sugars++;
        else if (data.category === 'Preservative') counts.preservatives++;
        else if (data.category === 'Color') counts.colors++;
        else counts.others++;
      }
    });

    return {
      productName: "Neural-Local Audit",
      score: Math.max(10, score),
      detectedIngredients: detected.length > 0 ? detected : [{ name: "Safe Marker Found", category: "General", risk: "Low", description: "No high-risk additives found in local DB.", impact: "Lower health risk.", usedFor: "Standard product", dailyLimit: "N/A" }],
      recommendation: score > 75 ? "Safe for moderate consumption." : "Highly processed. Limit usage.",
      alternatives: ["Switch to Organic Brands", "Choose unprocessed whole foods"],
      stats: counts,
      engine: 'PureScan Local Intel'
    };
  };

  /**
   * DeepSeek Cloud Engine (Primary)
   */
  const analyzeWithDeepSeek = async (text: string) => {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${deepseekKey.trim()}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "system", content: "Return ONLY JSON with productName, score, detectedIngredients: [{name, category, risk, description, impact, usedFor, dailyLimit}], recommendation, alternatives: [], stats: {preservatives, sugars, colors, others}." }, { role: "user", content: text }],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
        if (response.status === 402) throw new Error("DeepSeek Wallet Empty (Insufficient Balance)");
        throw new Error(`Cloud Error: ${response.status}`);
    }

    const data = await response.json();
    return { ...JSON.parse(data.choices[0].message.content), engine: 'DeepSeek AI' };
  };

  /**
   * Gemini Cloud Engine (Secondary Hybrid)
   */
  const analyzeWithGemini = async (text: string, base64Image?: string) => {
    if (!geminiKey.trim()) throw new Error("Gemini API key missing. Add it in Settings or set VITE_GEMINI_API_KEY.");

    const callGemini = async (model: string) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey.trim())}`;
      const prompt = "Analyze food components. Return ONLY JSON structure: productName, score, detectedIngredients, recommendation, alternatives, stats.";
      const contents = base64Image
        ? [{
            role: "user",
            parts: [
              { text: prompt },
              {
                inline_data: {
                  data: base64Image.split(',')[1],
                  mime_type: "image/jpeg",
                },
              },
            ],
          }]
        : [{ role: "user", parts: [{ text: `${prompt}\n\n${text}` }] }];

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
      });

      const raw = await response.text();
      if (!response.ok) {
        throw new Error(`Gemini HTTP ${response.status}: ${raw.slice(0, 500)}`);
      }

      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Gemini invalid JSON response: ${raw.slice(0, 500)}`);
      }

      const candidateText = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") || "";
      return candidateText;
    };

    const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.0-pro", "gemini-pro"];
    let lastErr;

    for (const m of models) {
      try {
        const textRes = await callGemini(m);
        const jsonMatch = textRes.match(/\{[\s\S]*\}/);
        if (jsonMatch) return { ...JSON.parse(jsonMatch[0]), engine: 'Gemini AI' };
        throw new Error("Gemini response did not contain JSON object.");
      } catch (e) {
        lastErr = e;
        console.warn(`Gemini model ${m} request failed.`, e);
      }
    }
    throw lastErr;
  };

  /**
   * Emergency OCR
   */
  const performOCR = async (base64: string) => {
    const { data: { text } } = await Tesseract.recognize(base64, 'eng');
    return text;
  };

  /**
   * Master Pipeline v3.8
   */
  const startAudit = async (text: string, base64Image?: string) => {
    setIsAnalyzing(true);
    setError(null);
    let finalResult = null;

    try {
      // 1. Image Scan Path
      if (base64Image) {
        try {
          finalResult = await analyzeWithGemini("", base64Image);
        } catch {
          console.log("Vision failed, trying local OCR...");
          const extractedText = await performOCR(base64Image);
          try {
            finalResult = await analyzeWithDeepSeek(extractedText);
          } catch (e: any) {
            setError(e.message);
            finalResult = performLocalAnalysis(extractedText);
          }
        }
      } 
      // 2. Text Scan Path
      else {
        try {
          finalResult = await analyzeWithDeepSeek(text);
        } catch (e: any) {
          setError(e.message);
          console.log("DeepSeek failed, trying Gemini fallback...");
          try {
            finalResult = await analyzeWithGemini(text);
          } catch {
            finalResult = performLocalAnalysis(text);
          }
        }
      }

      if (finalResult) {
        setResult(finalResult);
        setScreen('result');
      }
    } catch (err: any) {
      setError("Audit Interrupted: " + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => { setScreen('home'); setResult(null); setManualText(""); setError(null); };

  return (
    <div className="mobile-app-container">
      <AnimatePresence mode="wait">
        {isAnalyzing ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="safe-area" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 size={64} className="animate-spin" style={{ color: 'var(--primary)', marginBottom: '2rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Neural Auditing...</h2>
            <p style={{ color: 'var(--text-soft)', marginTop: '0.5rem' }}>Cloud + Local Intelligence Active</p>
          </motion.div>
        ) : screen === 'home' ? (
          <motion.div key="home" className="safe-area" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
             <header>
                <div>
                  <h1 className="logo-text">PureScan</h1>
                  <div className="status-bar">
                    <div className="status-dot" />
                    <span>Bio Pipeline v3.9 Online</span>
                  </div>
                </div>
                <button onClick={() => setScreen('settings')} className="btn-ghost" style={{ padding: '0.75rem', borderRadius: '14px' }}>
                  <Key size={20}/>
                </button>
             </header>

             {error && (
               <div className="card" style={{ borderColor: 'rgba(244, 63, 94, 0.3)', background: 'rgba(244, 63, 94, 0.05)', color: '#fb7185', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                 <AlertTriangle size={18} /> <span style={{ fontSize: '0.85rem' }}>{error}</span>
               </div>
             )}

             <div className="card card-primary" onClick={() => fileInputRef.current?.click()}>
               <div className="card-icon-container">
                 <Camera size={28} style={{ color: 'var(--primary)' }} />
               </div>
               <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Vision Audit</h3>
               <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Multi-model AI analysis via image capture</p>
               <input type="file" ref={fileInputRef} hidden onChange={(e) => {
                 const file = e.target.files?.[0];
                 if (file) {
                   const reader = new FileReader();
                   reader.onloadend = () => startAudit("", reader.result as string);
                   reader.readAsDataURL(file);
                 }
               }} accept="image/*" />
            </div>

            <div className="card" onClick={() => setScreen('manual')} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
               <div className="card-icon-container" style={{ marginBottom: 0 }}>
                 <FileText size={24} style={{ color: 'var(--secondary)' }} />
               </div>
               <div style={{ flex: 1 }}>
                 <h4 style={{ fontWeight: 600 }}>Text Intelligence</h4>
                 <p style={{ fontSize: '0.8rem', color: 'var(--text-soft)' }}>Direct ingredient string audit</p>
               </div>
               <ChevronRight size={20} style={{ color: 'var(--text-soft)' }} />
            </div>
          </motion.div>
        ) : screen === 'manual' ? (
          <motion.div key="manual" className="safe-area" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
             <header style={{ marginBottom: '2rem' }}>
               <button onClick={reset} className="btn-ghost" style={{ padding: '0.5rem', borderRadius: '12px' }}><ChevronLeft size={24}/></button>
               <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Ingredient Audit</h2>
               <div style={{ width: 40 }} />
             </header>
             <textarea 
               value={manualText} 
               onChange={(e) => setManualText(e.target.value)} 
               placeholder="Paste ingredient list here..." 
               style={{ width: '100%', height: '280px', borderRadius: '20px', padding: '1.5rem', marginBottom: '1.5rem' }} 
             />
             <button className="btn-minimal btn-primary" onClick={() => startAudit(manualText)}>
               <Cpu size={20} /> Start Neural Scan
             </button>
          </motion.div>
        ) : screen === 'settings' ? (
          <motion.div key="settings" className="safe-area" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
             <header style={{ marginBottom: '2rem' }}>
               <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Config Panel</h2>
               <button onClick={reset} className="btn-ghost" style={{ padding: '0.5rem', borderRadius: '12px' }}><X size={24}/></button>
             </header>
             <div className="card">
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '1rem' }}>Select Intelligence Provider</p>
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <button onClick={() => setApiProvider('gemini')} className={apiProvider === 'gemini' ? 'btn-minimal btn-primary' : 'btn-minimal btn-ghost'} style={{ flex: 1, padding: '0.75rem' }}>Gemini</button>
                  <button onClick={() => setApiProvider('deepseek')} className={apiProvider === 'deepseek' ? 'btn-minimal btn-primary' : 'btn-minimal btn-ghost'} style={{ flex: 1, padding: '0.75rem' }}>DeepSeek</button>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-soft)', marginBottom: '0.5rem' }}>API Key Certification</p>
                <input 
                  type="password" 
                  value={apiProvider === 'gemini' ? geminiKey : deepseekKey} 
                  onChange={(e) => apiProvider === 'gemini' ? setGeminiKey(e.target.value) : setDeepseekKey(e.target.value)} 
                  style={{ width: '100%', padding: '1rem', marginBottom: '1.5rem' }} 
                  placeholder={`Enter ${apiProvider} Key`}
                />
                <button className="btn-minimal btn-primary" onClick={() => {
                  localStorage.setItem('API_PROVIDER', apiProvider);
                  localStorage.setItem('GEMINI_API_KEY', geminiKey);
                  localStorage.setItem('DEEPSEEK_API_KEY', deepseekKey);
                  reset();
                }}>Save & Initialize</button>
             </div>
          </motion.div>
        ) : screen === 'result' && result ? (
          <motion.div key="result" className="safe-area" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
             <header style={{ marginBottom: '1rem' }}>
                <button onClick={reset} className="btn-ghost" style={{ padding: '0.5rem', borderRadius: '12px' }}><RotateCcw size={20}/></button>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 800, letterSpacing: '0.1em' }}>{result.engine.toUpperCase()} AUDIT</span>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Scan Report</h3>
                </div>
                <div style={{ width: 40 }} />
             </header>

             <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', marginTop: '1rem' }}>
                <div className="score-display">{result.score}</div>
                <p style={{ color: 'var(--text-dim)', fontWeight: 600, fontSize: '0.9rem', letterSpacing: '0.1em' }}>HEALTH INTEGRITY SCORE</p>
             </div>

             <div className="card" style={{ background: 'linear-gradient(135deg, var(--surface) 0%, #000 100%)', borderLeft: `4px solid ${result.score > 70 ? 'var(--primary)' : 'var(--accent)'}` }}>
               <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', fontStyle: 'italic' }}>"{result.recommendation}"</p>
             </div>

             <div style={{ marginTop: '2rem' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-soft)', fontWeight: 700, marginBottom: '1rem', textTransform: 'uppercase' }}>Detected Components</h4>
                {result.detectedIngredients.map((ing, i) => (
                   <div key={i} className="ingredient-row" onClick={() => setActiveIng(ing)}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700, color: 'var(--text-main)' }}>{ing.name}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-soft)' }}>{ing.category}</p>
                      </div>
                      <span className={`badge badge-${ing.risk.toLowerCase()}`}>{ing.risk}</span>
                   </div>
                ))}
             </div>

             <button onClick={reset} className="btn-minimal btn-primary" style={{ marginTop: '2.5rem', marginBottom: '4rem' }}>
               Run New Audit
             </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {activeIng && (
          <motion.div 
            key="popup" 
            className="slide-up" 
            initial={{ y: '100%' }} 
            animate={{ y: 0 }} 
            exit={{ y: '100%' }} 
            style={{ position: 'fixed', inset: 0, zIndex: 1000, padding: '2rem', borderRadius: '32px 32px 0 0', display: 'flex', flexDirection: 'column' }}
          >
             <div style={{ height: 4, width: 40, background: 'var(--border)', margin: '0 auto 2rem', borderRadius: '2px' }} />
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{activeIng.name}</h2>
                  <span className={`badge badge-${activeIng.risk.toLowerCase()}`} style={{ marginTop: '0.5rem', display: 'inline-block' }}>{activeIng.risk} RISK</span>
                </div>
                <button onClick={() => setActiveIng(null)} className="btn-ghost" style={{ padding: '0.5rem', borderRadius: '50%' }}><X/></button>
             </div>
             
             <div style={{ marginTop: '2rem', flex: 1 }}>
                <p style={{ color: 'var(--text-dim)', fontSize: '1.1rem' }}>{activeIng.description}</p>
                
                <div className="card" style={{ marginTop: '2rem', borderColor: 'rgba(244, 63, 94, 0.2)', background: 'rgba(244, 63, 94, 0.03)' }}>
                  <h4 style={{ color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Biological Impact</h4>
                  <p style={{ color: 'var(--text-main)' }}>{activeIng.impact}</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                   <div className="card" style={{ marginBottom: 0, padding: '1rem' }}>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-soft)', textTransform: 'uppercase' }}>Daily Limit</p>
                      <p style={{ fontWeight: 700 }}>{activeIng.dailyLimit}</p>
                   </div>
                   <div className="card" style={{ marginBottom: 0, padding: '1rem' }}>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-soft)', textTransform: 'uppercase' }}>Usage</p>
                      <p style={{ fontWeight: 700 }}>{activeIng.usedFor}</p>
                   </div>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer>
        <p style={{ fontWeight: 600, color: 'var(--text-dim)' }}>PureScan Neural Audit v3.9</p>
        <p style={{ marginTop: '0.25rem' }}>Powered by Gemini & DeepSeek Intelligence</p>
      </footer>
    </div>
  );
};

export default App;
