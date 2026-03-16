import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  Camera, 
  ChevronLeft, 
  ChevronRight,
  X,
  FileText,
  Loader2,
  RotateCcw,
  Key,
  Cpu
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
  engine: 'AI Cloud' | 'PureScan Local';
}

// --- Local Smart Intelligence Database (Fallback) ---
const LOCAL_DB: Record<string, any> = {
  "sugar": { category: "Sweetener", risk: "High", penalty: 15, description: "Refined sweetener.", impact: "Spikes insulin and blood sugar.", usedFor: "Flavor", dailyLimit: "25g" },
  "palm oil": { category: "Industrial", risk: "Moderate", penalty: 10, description: "Saturated fat.", impact: "Potential LDL cholesterol increase.", usedFor: "Texture", dailyLimit: "Limit intake" },
  "msg": { category: "Flavor", risk: "Moderate", penalty: 8, description: "Glutamate salt.", impact: "May cause sensitivities/headaches.", usedFor: "Savoriness", dailyLimit: "3g" },
  "red 40": { category: "Colorant", risk: "High", penalty: 12, description: "Synthetic dye.", impact: "Linked to hyperactivity in children.", usedFor: "Visuals", dailyLimit: "Minimize" },
  "titanium dioxide": { category: "Colorant", risk: "High", penalty: 15, description: "Whitener.", impact: "Potential genotoxicity concerns.", usedFor: "Color", dailyLimit: "Banned in EU" }
};

const App: React.FC = () => {
  const getDefaultKey = () => {
    const saved = localStorage.getItem('GEMINI_API_KEY');
    if (!saved || saved.length < 10) return 'AIzaSyBItLUxARnmvTJf5E6agjlFVQoFIBRXbw0';
    return saved;
  };

  const [apiProvider, setApiProvider] = useState<'gemini' | 'deepseek'>(localStorage.getItem('API_PROVIDER') as any || 'gemini');
  const [deepseekKey, setDeepseekKey] = useState<string>(localStorage.getItem('DEEPSEEK_API_KEY') || '');
  const [screen, setScreen] = useState<'home' | 'manual' | 'result' | 'settings'>('home');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [apiKey, setApiKey] = useState<string>(getDefaultKey());
  const [manualText, setManualText] = useState<string>('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeIng, setActiveIng] = useState<IngredientDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * DeepSeek Analysis Engine
   */
  const analyzeWithDeepSeek = async (text: string) => {
    if (!deepseekKey) {
      setError("Please add your DeepSeek API Key in Settings.");
      setScreen('settings');
      return;
    }

    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${deepseekKey.trim()}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "You are a professional nutritionist. Analyze food ingredients and return only a JSON object." },
            { role: "user", content: `Analyze these ingredients and return a JSON object with this structure: {productName, score: number(0-100), detectedIngredients: [{name, category, risk, description, impact, usedFor, dailyLimit}], recommendation, alternatives: [], stats: {preservatives, sugars, colors, others}}. Ingredients: ${text}` }
          ],
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      const raw = data.choices[0].message.content;
      const parsed = JSON.parse(raw);
      setResult({ ...parsed, engine: 'AI Cloud (DeepSeek)' });
      setScreen('result');
    } catch (err: any) {
      console.error("DeepSeek Error:", err);
      throw err;
    }
  };

  /**
   * Unified AI Analysis Engine
   */
  const startAIAnalysis = async (text: string, base64Image?: string) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      if (apiProvider === 'deepseek' && !base64Image) {
        await analyzeWithDeepSeek(text);
      } else {
        // Fallback to Gemini for Image Vision or if Gemini is selected
        await analyzeWithGemini(text, base64Image);
      }
    } catch (err: any) {
      console.error("Master Engine Error:", err);
      // Fallback already happens inside analyzeWithGemini, 
      // but if DeepSeek failed and it was manual text, let's try local.
      if (!base64Image) {
        const local = performLocalAnalysis(text || "Emergency Scan");
        setResult(local);
        setScreen('result');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Local Intelligence Fallback
   */
  const performLocalAnalysis = (text: string): AnalysisResult => {
    const detected: IngredientDetail[] = [];
    let score = 100;
    let counts = { preservatives: 0, sugars: 0, colors: 0, others: 0 };

    Object.entries(LOCAL_DB).forEach(([key, data]) => {
      if (text.toLowerCase().includes(key)) {
        detected.push({ name: key.toUpperCase(), ...data });
        score -= data.penalty;
        if (data.category === 'Sweetener') counts.sugars++;
        else if (data.category === 'Colorant') counts.colors++;
        else counts.others++;
      }
    });

    return {
      productName: "Local Scan Mode",
      score: Math.max(15, score),
      detectedIngredients: detected.length > 0 ? detected : [{ name: "General Analysis", category: "N/A", risk: "Low", description: "Minimal hazardous markers found.", impact: "Product looks safe compared to high-risk markers.", usedFor: "Daily use", dailyLimit: "Follow servings" }],
      recommendation: score > 80 ? "This looks relatively clean." : "Contains some processed markers.",
      alternatives: ["Switch to Organic Brands", "Choose Whole Foods"],
      stats: counts,
      engine: 'PureScan Local'
    };
  };

  /**
   * Gemini Analysis Engine
   */
  const analyzeWithGemini = async (text: string, base64Image?: string) => {
    setIsAnalyzing(true);
    setError(null);

    const performAiCall = async (modelName: string) => {
      const genAI = new GoogleGenerativeAI(apiKey.trim());
      const model = genAI.getGenerativeModel({ model: modelName });
      const prompt = `Analyze: ${text || 'the image provided'}. Return JSON: {productName, score, detectedIngredients: [{name, category, risk, description, impact, usedFor, dailyLimit}], recommendation, alternatives: [], stats: {preservatives, sugars, colors, others}}`;

      if (base64Image) {
        const r = await model.generateContent([prompt, { inlineData: { data: base64Image.split(',')[1], mimeType: "image/jpeg" } }]);
        return r.response;
      } else {
        const r = await model.generateContent([prompt]);
        return r.response;
      }
    };

    try {
      // Wide model hunt!
      const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro", "gemini-1.0-pro"];
      let response = null;

      for (const m of models) {
        try {
          response = await performAiCall(m);
          if (response) break;
        } catch (e) {
          console.warn(`Model ${m} failed... trying next.`);
        }
      }

      if (response) {
        const raw = response.text();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setResult({ ...parsed, engine: 'AI Cloud' });
          setScreen('result');
          return;
        }
      }
      
      // If AI fails COMPLETELY, use Local Intelligence
      console.log("AI Failed or Timed out. Switching to Local Engine.");
      const localResult = performLocalAnalysis(text || "Processed Ingredients Scan");
      setResult(localResult);
      setScreen('result');

    } catch (err) {
      // Emergency switch to Local
      const localResult = performLocalAnalysis(text || "Emergency Scan");
      setResult(localResult);
      setScreen('result');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleManualSubmit = () => {
    if (!manualText.trim()) return;
    startAIAnalysis(manualText);
  };

  const reset = () => {
    setScreen('home');
    setResult(null);
    setManualText("");
  };

  return (
    <div className="mobile-app-container">
      <AnimatePresence mode="wait">
        {isAnalyzing ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="safe-area" style={{ textAlign: 'center', paddingTop: '8rem' }}>
            <Loader2 size={80} color="var(--primary)" className="animate-spin" style={{ margin: '0 auto 2rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Smart-Engine Pulse...</h2>
            <p style={{ color: 'var(--text-soft)' }}>Hunting for best available intelligence (AI vs Local)</p>
          </motion.div>
        ) : screen === 'home' ? (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="safe-area">
             <header style={{ marginTop: '2rem', marginBottom: '3rem', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>PureScan</h1>
                  <p style={{ color: 'var(--text-soft)', marginTop: '0.4rem' }}>Hybrid Bio-Audit Pipeline</p>
                </div>
                <button onClick={() => setScreen('settings')} style={{ background: '#f1f5f9', border: 'none', padding: '1rem', borderRadius: '16px' }}><Key size={20}/></button>
             </header>

             <div className="card" onClick={() => fileInputRef.current?.click()} style={{ background: 'var(--primary-light)', border: '2px dashed var(--primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2.5rem', cursor: 'pointer' }}>
               <Camera size={48} color="var(--primary)" style={{ marginBottom: '1rem' }} />
               <h3 style={{ fontWeight: 800 }}>Vision Audit</h3>
               <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Multi-Model Image Analysis</p>
               <input type="file" ref={fileInputRef} hidden onChange={(e) => {
                 const file = e.target.files?.[0];
                 if (file) {
                   const reader = new FileReader();
                   reader.onloadend = () => startAIAnalysis("", reader.result as string);
                   reader.readAsDataURL(file);
                 }
               }} accept="image/*" />
            </div>

            <div className="card" onClick={() => setScreen('manual')} style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
               <FileText size={24} color="var(--primary)" />
               <div>
                 <h4 style={{ fontWeight: 700 }}>Ingredient Text</h4>
                 <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>Analysis with Local Fallback</p>
               </div>
               <ChevronRight size={20} style={{ marginLeft: 'auto', opacity: 0.3 }} />
            </div>

            <div className="card" style={{ marginTop: '1rem', background: 'var(--secondary)', color: 'white', display: 'flex', gap: '1rem', alignItems: 'center' }}>
               <Cpu size={32} color="var(--primary)" />
               <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Dual-Engine Integrity</h4>
                  <p style={{ fontSize: '0.7rem', opacity: 0.8 }}>Uses Gemini AI with an on-device local database fallback.</p>
               </div>
            </div>
          </motion.div>
        ) : screen === 'manual' ? (
          <motion.div key="manual" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="safe-area">
             <header className="screen-header" style={{ background: 'none', border: 'none', padding: '0 0 1.5rem' }}>
                <button onClick={reset} style={{ background: 'none', border: 'none' }}><ChevronLeft size={24}/></button>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Audit Input</h2>
             </header>
             <textarea 
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Paste nutrients or ingredients..."
                style={{ width: '100%', height: '320px', borderRadius: '24px', border: '1.5px solid var(--border)', padding: '1.5rem', fontSize: '1rem', outline: 'none' }}
             />
             <button className="btn-minimal" style={{ width: '100%', marginTop: '1.5rem', background: 'var(--primary)', fontWeight: 800 }} onClick={handleManualSubmit}>Start Analysis</button>
          </motion.div>
        ) : screen === 'settings' ? (
          <motion.div key="settings" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="safe-area">
             <header className="screen-header" style={{ paddingBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Laboratory Settings</h2>
                <button onClick={reset} style={{ background: 'none', border: 'none' }}><X size={24}/></button>
             </header>
             <div className="card">
                <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}><strong>Intelligence Provider</strong></p>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                   <button onClick={() => { setApiProvider('gemini'); localStorage.setItem('API_PROVIDER', 'gemini'); }} style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--border)', background: apiProvider === 'gemini' ? 'var(--primary-light)' : 'white', color: apiProvider === 'gemini' ? 'var(--primary)' : 'inherit', fontWeight: 700 }}>Gemini</button>
                   <button onClick={() => { setApiProvider('deepseek'); localStorage.setItem('API_PROVIDER', 'deepseek'); }} style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--border)', background: apiProvider === 'deepseek' ? 'var(--primary-light)' : 'white', color: apiProvider === 'deepseek' ? 'var(--primary)' : 'inherit', fontWeight: 700 }}>DeepSeek</button>
                </div>

                {apiProvider === 'gemini' ? (
                  <>
                    <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Gemini API Key</p>
                    <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }} />
                    <button className="btn-minimal" style={{ width: '100%', marginTop: '1rem', background: 'var(--primary)' }} onClick={() => { localStorage.setItem('GEMINI_API_KEY', apiKey); reset(); }}>Save Gemini Key</button>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>DeepSeek API Key</p>
                    <input type="password" value={deepseekKey} onChange={(e) => setDeepseekKey(e.target.value)} style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }} />
                    <button className="btn-minimal" style={{ width: '100%', marginTop: '1rem', background: 'var(--primary)' }} onClick={() => { localStorage.setItem('DEEPSEEK_API_KEY', deepseekKey); reset(); }}>Save DeepSeek Key</button>
                  </>
                )}
             </div>
          </motion.div>
        ) : screen === 'result' && result ? (
          <motion.div key="result" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="safe-area">
             <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <button onClick={reset} style={{ background: '#f1f5f9', border: 'none', padding: '0.8rem', borderRadius: '50%' }}><RotateCcw size={20}/></button>
                <div style={{ textAlign: 'center' }}>
                   <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>{result.engine} Result</p>
                   <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Report Summary</h2>
                </div>
                <div style={{ width: 40 }} />
             </header>

             <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{ fontSize: '4rem', fontWeight: 900, lineHeight: 1 }}>{result.score}</div>
                <p style={{ fontWeight: 700, opacity: 0.5, marginBottom: '1.5rem' }}>HEALTH INDEX</p>
                <div className={`badge badge-${result.score > 70 ? 'success' : 'danger'}`}>{result.score > 70 ? 'Clean Product' : 'Caution Required'}</div>
             </div>

             <div className="card" style={{ background: 'var(--secondary)', color: 'white' }}>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.4 }}>{result.recommendation}</p>
             </div>

             <div style={{ marginTop: '2rem' }}>
                <h3 className="section-title">Lab Details</h3>
                {result.detectedIngredients.map((ing, i) => (
                   <div key={i} className="ingredient-row" onClick={() => setActiveIng(ing)}>
                      <div>
                        <p style={{ fontWeight: 700 }}>{ing.name}</p>
                        <p style={{ fontSize: '0.7rem', opacity: 0.6 }}>{ing.category}</p>
                      </div>
                      <span className={`badge badge-${ing.risk.toLowerCase()}`}>{ing.risk}</span>
                   </div>
                ))}
             </div>

             <button onClick={reset} className="btn-minimal" style={{ width: '100%', marginTop: '2rem', background: 'var(--secondary)', marginBottom: '4rem' }}>New Audit</button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Detail Popup */}
      <AnimatePresence>
        {activeIng && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="slide-up" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--surface)', padding: '2rem', borderTopLeftRadius: '32px', borderTopRightRadius: '32px' }}>
             <div style={{ height: 4, width: 40, background: 'var(--border)', margin: '0 auto 2rem', borderRadius: 2 }} />
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{activeIng.name}</h2>
                <button onClick={() => setActiveIng(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', padding: '0.5rem' }}><X size={20}/></button>
             </div>
             <div style={{ marginTop: '1.5rem' }}>
                <p style={{ fontSize: '1rem', lineHeight: 1.5 }}>{activeIng.description}</p>
                <div className="card" style={{ marginTop: '1.5rem', background: '#fff1f2', color: 'var(--danger)', fontWeight: 600 }}>{activeIng.impact}</div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer style={{ textAlign: 'center', padding: '2rem 1.5rem 6rem', fontSize: '0.7rem', color: 'var(--text-soft)', marginTop: '2rem' }}>
        <p>PureScan Bio-Intelligence v3.5 (Hybrid Mode)</p>
        <p>Made by <a href="https://maheshmadiwalar18.netlify.app/" style={{ color: 'var(--primary)', fontWeight: 700 }}>Mahesh Madiwalar</a></p>
      </footer>
    </div>
  );
};

export default App;
