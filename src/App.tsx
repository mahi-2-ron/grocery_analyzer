import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  Camera, 
  ChevronLeft, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  History, 
  User, 
  Scan, 
  ChevronRight,
  ShieldCheck,
  Zap,
  Leaf,
  Barcode,
  X,
  Target,
  Upload,
  AlertTriangle,
  Activity,
  FileText,
  Loader2,
  Trash2,
  RotateCcw,
  Key,
  Sparkles
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
}

const App: React.FC = () => {
  // Prioritize the hardcoded key if nothing is set or if it's an old placeholder
  const getDefaultKey = () => {
    const saved = localStorage.getItem('GEMINI_API_KEY');
    if (!saved || saved.length < 10) return 'AIzaSyBItLUxARnmvTJf5E6agjlFVQoFIBRXbw0';
    return saved;
  };

  const [screen, setScreen] = useState<'home' | 'manual' | 'result' | 'settings'>('home');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [apiKey, setApiKey] = useState<string>(getDefaultKey());
  const [manualText, setManualText] = useState<string>('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeIng, setActiveIng] = useState<IngredientDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('GEMINI_API_KEY', key);
    setScreen('home');
  };

  /**
   * Gemini Analysis Engine
   */
  const analyzeWithGemini = async (text: string, base64Image?: string) => {
    if (!apiKey) {
      setError("Please add your Gemini API Key in Settings.");
      setScreen('settings');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    const performAiCall = async (modelName: string) => {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });

      const prompt = `
        ACT AS A PROFESSIONAL NUTRITIONIST AND TOXICOLOGIST.
        Analyze the food ingredients provided (from text or image).
        
        TASK:
        1. Identify Product Name
        2. Extract all ingredients and their Health Risks (Low, Moderate, High)
        3. Assign a Health Score (0-100)
        4. Provide Biological Impact for controversial ingredients
        5. Suggest 2-3 healthier alternatives
        
        RETURN ONLY A PURE JSON OBJECT (NO MARKDOWN BLOCKS):
        {
          "productName": "string",
          "score": number,
          "detectedIngredients": [
            {
              "name": "string",
              "category": "string",
              "risk": "Low | Moderate | High",
              "description": "string",
              "impact": "string",
              "usedFor": "string",
              "dailyLimit": "string"
            }
          ],
          "recommendation": "string",
          "alternatives": ["string"],
          "stats": { "preservatives": number, "sugars": number, "colors": number, "others": number }
        }
      `;

      if (base64Image) {
        const result = await model.generateContent([
          prompt,
          { inlineData: { data: base64Image.split(',')[1], mimeType: "image/jpeg" } }
        ]);
        return result.response;
      } else {
        const result = await model.generateContent([prompt, `Ingredients list: ${text}`]);
        return result.response;
      }
    };

    try {
      let response;
      try {
        // Try Flash first (faster, cheaper)
        response = await performAiCall("gemini-1.5-flash");
      } catch (flashErr: any) {
        console.warn("Flash model failed, trying Pro fallback...", flashErr);
        if (flashErr.message?.includes("404") || flashErr.message?.includes("not found")) {
          // Fallback to Pro
          response = await performAiCall("gemini-1.5-pro");
        } else {
          throw flashErr;
        }
      }

      const responseText = response.text();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("AI failed to generate a valid nutritional report. Please try again with a clearer list.");

      const parsed = JSON.parse(jsonMatch[0]) as AnalysisResult;
      setResult(parsed);
      setScreen('result');
    } catch (err: any) {
      console.error("Critical Analysis Error:", err);
      setError(`Lab Error: ${err.message || 'The AI is currently busy. Please try manual entry.'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !apiKey) {
      if (!apiKey) setScreen('settings');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      analyzeWithGemini("", reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const reset = () => {
    setScreen('home');
    setResult(null);
    setError(null);
    setManualText('');
  };

  return (
    <div className="mobile-app-container">
      <AnimatePresence mode="wait">
        {isAnalyzing ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="safe-area" style={{ textAlign: 'center', paddingTop: '8rem' }}>
            <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto 2rem' }}>
              <Loader2 size={100} color="var(--primary)" className="animate-spin" />
              <Sparkles size={32} color="var(--primary)" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>AI Analysis Active</h2>
            <p style={{ color: 'var(--text-soft)', marginTop: '0.8rem' }}>Gemini is decoding molecular structures...</p>
          </motion.div>
        ) : screen === 'home' ? (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="safe-area">
             <header style={{ marginTop: '2rem', marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>
                    PureScan <br/><span style={{ color: 'var(--primary)' }}>AI Lab</span>
                  </h1>
                  <p style={{ color: 'var(--text-soft)', marginTop: '0.8rem', fontSize: '1rem' }}>
                    Next-Gen Food Intelligence.
                  </p>
                </div>
                <button onClick={() => setScreen('settings')} style={{ background: '#f1f5f9', border: 'none', padding: '1rem', borderRadius: '16px' }}>
                  <Key size={20} color="var(--text-soft)" />
                </button>
             </header>

             {error && (
               <div className="card" style={{ background: '#fff1f2', border: '1px solid #fecaca', color: '#e11d48', marginBottom: '1.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <AlertTriangle size={16} /> {error}
               </div>
             )}

             <div className="card" onClick={() => apiKey ? fileInputRef.current?.click() : setScreen('settings')} style={{ background: 'var(--primary-light)', border: '2px dashed var(--primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2.5rem', cursor: 'pointer' }}>
               <Camera size={48} color="var(--primary)" style={{ marginBottom: '1rem' }} />
               <h3 style={{ fontWeight: 800 }}>Scan Label with AI</h3>
               <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Gemini-Powered Vision</p>
               <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} accept="image/*" />
            </div>

            <div className="card" onClick={() => setScreen('manual')} style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
               <FileText size={24} color="var(--text-soft)" />
               <div>
                 <h4 style={{ fontWeight: 700 }}>Ingredient Text</h4>
                 <p style={{ fontSize: '0.75rem', color: 'var(--text-soft)' }}>Powered by Gemini AI</p>
               </div>
               <ChevronRight size={20} style={{ marginLeft: 'auto', opacity: 0.3 }} />
            </div>

            <div className="card" style={{ marginTop: '1rem', background: 'var(--secondary)', color: 'white', display: 'flex', gap: '1rem', alignItems: 'center' }}>
               <Sparkles size={32} color="var(--primary)" />
               <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>AI Insights Mode</h4>
                  <p style={{ fontSize: '0.7rem', opacity: 0.8 }}>Using Gemini Pro for deep health cross-referencing.</p>
               </div>
            </div>
          </motion.div>
        ) : screen === 'settings' ? (
          <motion.div key="settings" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="safe-area">
             <header className="screen-header" style={{ background: 'none', border: 'none', padding: '0 0 1.5rem' }}>
                <button onClick={() => setScreen('home')} style={{ background: 'none', border: 'none' }}><ChevronLeft size={24}/></button>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Connect AI</h2>
             </header>
             <div className="card" style={{ background: '#f8fafc', padding: '1.5rem' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Enter your <strong>Gemini API Key</strong> to unlock high-accuracy ingredient analysis and label scanning.</p>
                <input 
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your API Key here..."
                  style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1.5px solid var(--border)', fontSize: '0.9rem', marginBottom: '1.5rem' }}
                />
                <button className="btn-minimal" style={{ width: '100%', background: 'var(--primary)' }} onClick={() => saveApiKey(apiKey)}>
                  Save Configuration
                </button>
             </div>
             <p style={{ fontSize: '0.75rem', textAlign: 'center', marginTop: '1rem', color: 'var(--text-soft)' }}>Get a free key at <a href="https://aistudio.google.com/" target="_blank" style={{ color: 'var(--primary)' }}>Google AI Studio</a></p>
          </motion.div>
        ) : screen === 'manual' ? (
          <motion.div key="manual" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="safe-area">
             <header className="screen-header" style={{ background: 'none', border: 'none', padding: '0 0 1.5rem' }}>
                <button onClick={() => setScreen('home')} style={{ background: 'none', border: 'none' }}><ChevronLeft size={24}/></button>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>AI Audit</h2>
             </header>
             <textarea 
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Paste ingredients list..."
                style={{ width: '100%', height: '300px', borderRadius: '24px', border: '1.5px solid var(--border)', padding: '1.5rem', fontSize: '1rem', outline: 'none' }}
             />
             <button 
                className="btn-minimal" 
                style={{ width: '100%', marginTop: '1.5rem', background: 'var(--primary)', padding: '1.2rem', fontWeight: 800 }}
                onClick={() => analyzeWithGemini(manualText)}
                disabled={!manualText.trim()}
             >
                Run AI Analysis
             </button>
          </motion.div>
        ) : screen === 'result' && result ? (
          <motion.div key="result" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="safe-area">
             <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <button onClick={reset} style={{ background: '#f1f5f9', border: 'none', padding: '0.8rem', borderRadius: '50%' }}><RotateCcw size={20}/></button>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>AI Report</h2>
                <button onClick={reset} style={{ background: '#f1f5f9', border: 'none', padding: '0.8rem', borderRadius: '50%' }}><ChevronRight size={20} /></button>
             </header>

             <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{ position: 'relative', width: '180px', height: '180px', margin: '0 auto' }}>
                   <svg width="180" height="180">
                      <circle cx="90" cy="90" r="80" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                      <motion.circle 
                        cx="90" cy="90" r="80" fill="none" 
                        stroke={result.score > 70 ? 'var(--success)' : result.score > 40 ? 'var(--warning)' : 'var(--danger)'} 
                        strokeWidth="12" strokeDasharray="502"
                        initial={{ strokeDashoffset: 502 }}
                        animate={{ strokeDashoffset: 502 - (502 * result.score) / 100 }}
                        transition={{ duration: 1.5 }}
                        strokeLinecap="round"
                      />
                   </svg>
                   <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                      <span style={{ fontSize: '3.5rem', fontWeight: 900 }}>{result.score}</span>
                   </div>
                </div>
                <h2 style={{ marginTop: '1rem', fontWeight: 800 }}>{result.productName}</h2>
             </div>

             <div className="card" style={{ background: 'var(--secondary)', color: 'white', marginTop: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                   <Sparkles size={24} color="var(--primary)" />
                   <div>
                      <h4 style={{ fontWeight: 800 }}>AI Verdict</h4>
                      <p style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: '0.2rem' }}>{result.recommendation}</p>
                   </div>
                </div>
             </div>

             <div style={{ marginTop: '2.5rem' }}>
                <h3 className="section-title">Detected Components</h3>
                {result.detectedIngredients.map((ing, i) => (
                    <div key={i} className="ingredient-row" onClick={() => setActiveIng(ing)} style={{ cursor: 'pointer' }}>
                       <div>
                          <p style={{ fontWeight: 700 }}>{ing.name}</p>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-soft)' }}>{ing.category}</p>
                       </div>
                       <span className={`badge badge-${ing.risk.toLowerCase()}`}>
                          {ing.risk}
                       </span>
                    </div>
                ))}
             </div>

             {result.alternatives.length > 0 && (
               <div style={{ marginTop: '2.5rem', paddingBottom: '4rem' }}>
                  <h3 className="section-title">Healthier Choices</h3>
                  <div style={{ display: 'grid', gap: '0.8rem' }}>
                    {result.alternatives.map((alt, i) => (
                       <div key={i} className="card" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                         <Leaf size={18} color="var(--primary)" />
                         <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{alt}</span>
                       </div>
                    ))}
                  </div>
               </div>
             )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Ingredient Insight Popup */}
      <AnimatePresence>
        {activeIng && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="slide-up" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--surface)', padding: '2rem', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', overflowY: 'auto' }}>
             <div style={{ height: '4px', width: '40px', background: 'var(--border)', borderRadius: '999px', margin: '0 auto 1.5rem' }} />
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{activeIng.name}</h2>
                <button onClick={() => setActiveIng(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '36px', height: '36px' }}><X size={18}/></button>
             </div>
             
             <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
                <span className={`badge badge-${activeIng.risk.toLowerCase()}`}>{activeIng.risk} Risk</span>
                <span className="badge" style={{ background: '#f1f5f9', color: 'var(--text-soft)' }}>{activeIng.category}</span>
             </div>

             <div style={{ display: 'grid', gap: '2rem' }}>
                <div>
                   <span className="popup-label">Deep Explanation</span>
                   <p style={{ fontSize: '1rem' }}>{activeIng.description}</p>
                </div>
                <div>
                   <span className="popup-label">Health Risk Insight</span>
                   <div className="card" style={{ background: activeIng.risk === 'High' ? '#fff1f2' : '#f8fafc', border: 'none', padding: '1.2rem', color: activeIng.risk === 'High' ? 'var(--danger)' : 'inherit' }}>
                      <p style={{ fontWeight: 600 }}>{activeIng.impact}</p>
                   </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                   <div>
                      <span className="popup-label">Used For</span>
                      <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>{activeIng.usedFor}</p>
                   </div>
                   <div>
                      <span className="popup-label">Limit</span>
                      <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)' }}>{activeIng.dailyLimit}</p>
                   </div>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer style={{ textAlign: 'center', padding: '2rem 1.5rem 6rem', fontSize: '0.75rem', color: 'var(--text-soft)', borderTop: '1px solid var(--border)', marginTop: '2rem' }}>
        <p style={{ fontWeight: 700 }}>PureScan AI Pipeline v3.0</p>
        <p style={{ marginTop: '0.4rem' }}>
          Made with ❤️ by <a href="https://maheshmadiwalar18.netlify.app/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 800, textDecoration: 'none' }}>Mahesh Madiwalar</a>
        </p>
      </footer>
    </div>
  );
};

export default App;
