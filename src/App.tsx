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
  engine: string;
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
  const getDefaultGeminiKey = () => {
    const saved = localStorage.getItem('GEMINI_API_KEY');
    return saved || 'AIzaSyBItLUxARnmvTJf5E6agjlFVQoFIBRXbw0';
  };

  const getDefaultDeepSeekKey = () => {
    const saved = localStorage.getItem('DEEPSEEK_API_KEY');
    return saved || 'sk-50eb81dcd5e44eb79254963757aa04f7';
  };

  const [apiProvider, setApiProvider] = useState<'gemini' | 'deepseek'>(localStorage.getItem('API_PROVIDER') as any || 'deepseek');
  const [deepseekKey, setDeepseekKey] = useState<string>(getDefaultDeepSeekKey());
  const [geminiKey, setGeminiKey] = useState<string>(getDefaultGeminiKey());
  
  const [screen, setScreen] = useState<'home' | 'manual' | 'result' | 'settings'>('home');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [manualText, setManualText] = useState<string>('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeIng, setActiveIng] = useState<IngredientDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
   * DeepSeek Chat Engine
   */
  const analyzeWithDeepSeek = async (text: string) => {
    if (!deepseekKey) throw new Error("Missing DeepSeek Key");

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${deepseekKey.trim()}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are a professional nutritionist. Return a JSON object with productName, score, detectedIngredients: [{name, category, risk, description, impact, usedFor, dailyLimit}], recommendation, alternatives: [], stats: {preservatives, sugars, colors, others}." },
          { role: "user", content: `Analyze: ${text}` }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (!data.choices) throw new Error("DeepSeek API Failure: " + (data.error?.message || "Unknown error"));
    const parsed = JSON.parse(data.choices[0].message.content);
    return { ...parsed, engine: 'DeepSeek AI' };
  };

  /**
   * Gemini Vision Engine
   */
  const analyzeWithGemini = async (text: string, base64Image?: string) => {
    if (!geminiKey) throw new Error("Missing Gemini Key");
    const genAI = new GoogleGenerativeAI(geminiKey.trim());
    
    // Attempt standard model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Analyze: ${text || 'image'}. Return JSON with productName, score, detectedIngredients (as list of detail objects), recommendation, alternatives, stats.`;

    let result;
    if (base64Image) {
      result = await model.generateContent([prompt, { inlineData: { data: base64Image.split(',')[1], mimeType: "image/jpeg" } }]);
    } else {
      result = await model.generateContent([prompt]);
    }

    const response = await result.response;
    const jsonMatch = response.text().match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid AI Format");
    return { ...JSON.parse(jsonMatch[0]), engine: 'Gemini AI' };
  };

  /**
   * Unified Bio-Audit Pipeline (Master Controller)
   */
  const startAudit = async (text: string, base64Image?: string) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      let finalResult = null;

      // 1. Try DeepSeek if selected and no image
      if (apiProvider === 'deepseek' && !base64Image) {
        try {
          finalResult = await analyzeWithDeepSeek(text);
        } catch (e) {
          console.error("DeepSeek Failed, trying Gemini fallback...", e);
        }
      }

      // 2. Try Gemini if DeepSeek skipped or failed
      if (!finalResult) {
        try {
          finalResult = await analyzeWithGemini(text, base64Image);
        } catch (e) {
          console.error("Gemini Failed (404/Other), using Local Fallback...", e);
        }
      }

      // 3. Absolute Fallback: Local Intel
      if (!finalResult) {
        finalResult = performLocalAnalysis(text || "Visual Scan Data");
      }

      setResult(finalResult);
      setScreen('result');
    } catch (err: any) {
      setError("Audit Interrupted: " + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setScreen('home');
    setResult(null);
    setManualText("");
    setError(null);
  };

  return (
    <div className="mobile-app-container">
      <AnimatePresence mode="wait">
        {isAnalyzing ? (
          <motion.div key="loading" className="safe-area" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', paddingTop: '8rem' }}>
            <Loader2 size={80} color="var(--primary)" className="animate-spin" style={{ margin: '0 auto 2rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Audit in Progress...</h2>
            <p style={{ color: 'var(--text-soft)' }}>Scanning via {apiProvider === 'deepseek' ? 'DeepSeek + Local' : 'Gemini + Local'}</p>
          </motion.div>
        ) : screen === 'home' ? (
          <motion.div key="home" className="safe-area" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
             <header style={{ marginTop: '2rem', marginBottom: '3rem', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text)' }}>PureScan</h1>
                  <p style={{ color: 'var(--text-soft)' }}>Bio-Integrity Pipeline v3.6</p>
                </div>
                <button onClick={() => setScreen('settings')} style={{ background: '#f1f5f9', border: 'none', padding: '1rem', borderRadius: '16px' }}><Key size={20}/></button>
             </header>

             {error && (
               <div className="card" style={{ background: '#fff1f2', color: 'var(--danger)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                 <AlertTriangle size={16} style={{ marginRight: '0.5rem', display: 'inline' }} /> {error}
               </div>
             )}

             <div className="card" onClick={() => fileInputRef.current?.click()} style={{ background: 'var(--primary-light)', border: '2px dashed var(--primary)', padding: '2.5rem', textAlign: 'center', cursor: 'pointer' }}>
               <Camera size={48} color="var(--primary)" style={{ marginBottom: '1rem' }} />
               <h3 style={{ fontWeight: 800 }}>Vision Audit</h3>
               <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Multi-Model Image Analysis</p>
               <input type="file" ref={fileInputRef} hidden onChange={(e) => {
                 const file = e.target.files?.[0];
                 if (file) {
                   const reader = new FileReader();
                   reader.onloadend = () => startAudit("", reader.result as string);
                   reader.readAsDataURL(file);
                 }
               }} accept="image/*" />
            </div>

            <div className="card" onClick={() => setScreen('manual')} style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
               <FileText size={24} color="var(--primary)" />
               <div style={{ flex: 1 }}>
                 <h4 style={{ fontWeight: 700 }}>Ingredient Text</h4>
                 <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>Analysis with DeepSeek Fallback</p>
               </div>
               <ChevronRight size={20} style={{ opacity: 0.3 }} />
            </div>

            <div className="card" style={{ marginTop: '1rem', background: 'var(--secondary)', color: 'white', display: 'flex', gap: '1rem', alignItems: 'center' }}>
               <Cpu size={32} color="var(--primary)" />
               <p style={{ fontSize: '0.75rem', fontWeight: 500 }}>Active Path: {apiProvider.toUpperCase()} Cloud Intelligence with Local Integrity Fallback.</p>
            </div>
          </motion.div>
        ) : screen === 'manual' ? (
          <motion.div key="manual" className="safe-area" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
             <header className="screen-header" style={{ padding: '1rem 0 2rem' }}>
                <button onClick={reset} style={{ background: 'none', border: 'none' }}><ChevronLeft size={24}/></button>
                <h2 style={{ fontWeight: 800 }}>Audit Input</h2>
             </header>
             <textarea 
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Paste ingredients list here..."
                style={{ width: '100%', height: '320px', borderRadius: '24px', border: '1.5px solid var(--border)', padding: '1.5rem', outline: 'none' }}
             />
             <button className="btn-minimal" style={{ width: '100%', marginTop: '1.5rem', background: 'var(--primary)', fontWeight: 800 }} onClick={() => startAudit(manualText)}>Start Analysis</button>
          </motion.div>
        ) : screen === 'settings' ? (
          <motion.div key="settings" className="safe-area" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
             <header className="screen-header" style={{ paddingBottom: '2rem' }}>
                <h2 style={{ fontWeight: 800 }}>Control Panel</h2>
                <button onClick={reset} style={{ background: 'none', border: 'none' }}><X size={24}/></button>
             </header>
             <div className="card">
                <p style={{ fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 700 }}>AI Intelligence Provider</p>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                   <button onClick={() => { setApiProvider('gemini'); localStorage.setItem('API_PROVIDER', 'gemini'); }} style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', background: apiProvider === 'gemini' ? 'var(--primary-light)' : 'white', color: apiProvider === 'gemini' ? 'var(--primary)' : 'inherit', fontWeight: 800 }}>Gemini</button>
                   <button onClick={() => { setApiProvider('deepseek'); localStorage.setItem('API_PROVIDER', 'deepseek'); }} style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', background: apiProvider === 'deepseek' ? 'var(--primary-light)' : 'white', color: apiProvider === 'deepseek' ? 'var(--primary)' : 'inherit', fontWeight: 800 }}>DeepSeek</button>
                </div>

                {apiProvider === 'gemini' ? (
                  <>
                    <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>Gemini Cloud Key</p>
                    <input type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '1rem' }} />
                    <button className="btn-minimal" style={{ width: '100%', background: 'var(--primary)' }} onClick={() => { localStorage.setItem('GEMINI_API_KEY', geminiKey); reset(); }}>Save Gemini Config</button>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>DeepSeek API Key</p>
                    <input type="password" value={deepseekKey} onChange={(e) => setDeepseekKey(e.target.value)} style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '1rem' }} />
                    <button className="btn-minimal" style={{ width: '100%', background: 'var(--primary)' }} onClick={() => { localStorage.setItem('DEEPSEEK_API_KEY', deepseekKey); reset(); }}>Save DeepSeek Config</button>
                  </>
                )}
             </div>
          </motion.div>
        ) : screen === 'result' && result ? (
          <motion.div key="result" className="safe-area" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
             <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <button onClick={reset} style={{ background: '#f1f5f9', border: 'none', padding: '0.8rem', borderRadius: '50%' }}><RotateCcw size={20}/></button>
                <div style={{ textAlign: 'center' }}>
                   <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary)' }}>{result.engine.toUpperCase()}</p>
                   <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Report Summary</h2>
                </div>
                <div style={{ width: 40 }} />
             </header>

             <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{ fontSize: '4.5rem', fontWeight: 900, lineHeight: 1 }}>{result.score}</div>
                <p style={{ fontWeight: 700, opacity: 0.5 }}>HEALTH SCORE</p>
                <div className={`badge badge-${result.score > 70 ? 'success' : 'danger'}`} style={{ marginTop: '1rem' }}>{result.score > 70 ? 'Reliable' : 'Hazardous'}</div>
             </div>

             <div className="card" style={{ background: 'var(--secondary)', color: 'white' }}>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>{result.recommendation}</p>
             </div>

             <div style={{ marginTop: '2rem' }}>
                <h3 className="section-title">Detected Lab Markers</h3>
                {result.detectedIngredients.map((ing, i) => (
                   <div key={i} className="ingredient-row" onClick={() => setActiveIng(ing)}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 800 }}>{ing.name}</p>
                        <p style={{ fontSize: '0.7rem', opacity: 0.5 }}>{ing.category}</p>
                      </div>
                      <span className={`badge badge-${ing.risk.toLowerCase()}`}>{ing.risk}</span>
                   </div>
                ))}
             </div>

             <button onClick={reset} className="btn-minimal" style={{ width: '100%', marginTop: '2rem', background: 'var(--secondary)', marginBottom: '5rem' }}>New Audit</button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Popups */}
      <AnimatePresence>
        {activeIng && (
          <motion.div key="popup" className="slide-up" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--surface)', padding: '2rem', borderTopLeftRadius: '32px', borderTopRightRadius: '32px' }}>
             <div style={{ height: 4, width: 40, background: 'var(--border)', margin: '0 auto 2rem', borderRadius: 2 }} />
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{activeIng.name}</h2>
                <button onClick={() => setActiveIng(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', padding: '0.5rem' }}><X size={20}/></button>
             </div>
             <p style={{ marginTop: '1.5rem', fontSize: '1.1rem', opacity: 0.8 }}>{activeIng.description}</p>
             <div className="card" style={{ marginTop: '1.5rem', background: '#fff1f2', color: 'var(--danger)', border: 'none' }}>
                <p style={{ fontWeight: 700 }}>{activeIng.impact}</p>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer style={{ textAlign: 'center', padding: '2rem 1.5rem 6rem', fontSize: '0.7rem', color: 'var(--text-soft)', marginTop: '2rem' }}>
        <p>PureScan AI Hub v3.6 (Hybrid Mode)</p>
        <p>Made by <a href="https://maheshmadiwalar18.netlify.app/" style={{ color: 'var(--primary)', fontWeight: 800 }}>Mahesh Madiwalar</a></p>
      </footer>
    </div>
  );
};

export default App;
