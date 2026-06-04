"use client";

import React, { useState, useEffect } from "react";
import { 
  Upload, 
  Activity, 
  History, 
  LogOut, 
  ShieldAlert, 
  CheckCircle2, 
  Search, 
  User, 
  ChevronRight,
  TrendingUp,
  FileSpreadsheet,
  AlertTriangle,
  RefreshCw
} from "lucide-react";

const API_BASE = "http://127.0.0.1:8000";

// Interface Definitions
interface UserSession {
  id: number;
  username: string;
  role: "farmer" | "admin";
}

interface AdvisoryReport {
  description: string;
  symptoms: string[];
  severity: "Low" | "Medium" | "Critical";
  organic_treatment: string[];
  chemical_treatment: string[];
  prevention: string[];
}

interface ScanRecord {
  id: number;
  username?: string;
  crop: string;
  disease: string;
  confidence: number;
  image_path: string;
  advisory: AdvisoryReport;
  created_at: string;
}

interface SystemStats {
  total_scans: number;
  total_farmers: number;
  crop_distribution: Record<string, number>;
  disease_distribution: Record<string, number>;
}

export default function Home() {
  // Authentication State
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoginView, setIsLoginView] = useState(true);
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authRole, setAuthRole] = useState("farmer");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  // Common UI State
  const [activeTab, setActiveTab] = useState<"scan" | "history" | "admin-dashboard" | "admin-history">("scan");
  const [loading, setLoading] = useState(false);

  // Farmer Scanner State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [predictionResult, setPredictionResult] = useState<any | null>(null);
  const [scanTab, setScanTab] = useState<"info" | "treatment" | "prevention">("info");
  const [historyLogs, setHistoryLogs] = useState<ScanRecord[]>([]);

  // Admin Dashboard State
  const [stats, setStats] = useState<SystemStats>({
    total_scans: 0,
    total_farmers: 0,
    crop_distribution: {},
    disease_distribution: {}
  });
  const [adminLogs, setAdminLogs] = useState<ScanRecord[]>([]);
  const [searchFilter, setSearchFilter] = useState("");

  // Load Session from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem("agrivision_session");
    if (saved) {
      const parsed = JSON.parse(saved);
      setSession(parsed);
      // Default views based on roles
      if (parsed.role === "admin") {
        setActiveTab("admin-dashboard");
        fetchAdminData();
      } else {
        setActiveTab("scan");
        fetchFarmerHistory(parsed.id);
      }
    }
  }, []);

  // Fetch Stats and Global logs (for Admin)
  const fetchAdminData = async () => {
    try {
      // 1. Stats
      const resStats = await fetch(`${API_BASE}/api/stats`);
      if (resStats.ok) {
        const data = await resStats.json();
        setStats(data);
      }
      // 2. Logs
      const resLogs = await fetch(`${API_BASE}/api/history?role=admin`);
      if (resLogs.ok) {
        const data = await resLogs.json();
        setAdminLogs(data);
      }
    } catch (e) {
      console.error("Error fetching admin stats:", e);
    }
  };

  // Fetch scan logs (for specific Farmer)
  const fetchFarmerHistory = async (userId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/history?user_id=${userId}&role=farmer`);
      if (res.ok) {
        const data = await res.json();
        setHistoryLogs(data);
      }
    } catch (e) {
      console.error("Error fetching history logs:", e);
    }
  };

  // Auth Handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");
    
    if (!authUsername.trim() || !authPassword.trim()) {
      setAuthError("Username and password are required.");
      return;
    }

    try {
      if (isLoginView) {
        // Login Request
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: authUsername, password: authPassword })
        });
        
        const data = await res.json();
        if (res.ok) {
          const userSession: UserSession = data.user;
          localStorage.setItem("agrivision_session", JSON.stringify(userSession));
          setSession(userSession);
          // Set active view based on role
          if (userSession.role === "admin") {
            setActiveTab("admin-dashboard");
            fetchAdminData();
          } else {
            setActiveTab("scan");
            fetchFarmerHistory(userSession.id);
          }
          // Reset form fields
          setAuthUsername("");
          setAuthPassword("");
        } else {
          setAuthError(data.detail || "Invalid credentials.");
        }
      } else {
        // Sign-up Request
        const res = await fetch(`${API_BASE}/api/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: authUsername, password: authPassword, role: authRole })
        });
        
        const data = await res.json();
        if (res.ok) {
          setAuthMessage("Account registered successfully! You can now log in.");
          setIsLoginView(true);
        } else {
          setAuthError(data.detail || "Signup failed.");
        }
      }
    } catch (e) {
      setAuthError("Could not connect to the backend server.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("agrivision_session");
    setSession(null);
    setPredictionResult(null);
    setPreviewUrl(null);
    setSelectedFile(null);
  };

  // Image Upload and Inference Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setPredictionResult(null);
    }
  };

  const handleScanSubmit = async () => {
    if (!selectedFile || !session) return;
    setLoading(true);
    setPredictionResult(null);
    
    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("user_id", session.id.toString());
    
    try {
      const res = await fetch(`${API_BASE}/api/predict`, {
        method: "POST",
        body: formData
      });
      
      const data = await res.json();
      if (res.ok) {
        setPredictionResult(data);
        fetchFarmerHistory(session.id); // Refresh history list
      } else {
        alert(data.detail || "Scanning failed.");
      }
    } catch (e) {
      alert("Error contacting the backend API.");
    } finally {
      setLoading(false);
    }
  };

  // Render Login/Signup view if not authenticated
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-[#030704]">
        {/* Glow Spheres */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#22c55e] opacity-[0.03] blur-[150px] rounded-full"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#10b981] opacity-[0.03] blur-[150px] rounded-full"></div>

        <div className="glass-card w-full max-w-md p-8 rounded-2xl relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-400 mb-3 border border-emerald-500/20">
              <Activity className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-extrabold text-white glow-text-green tracking-wide">AgriVision AI</h1>
            <p className="text-emerald-400/60 mt-1 text-sm">Crop Disease Detector & Advisory System</p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-5">
            {authError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2.5 rounded-lg text-sm text-center">
                {authError}
              </div>
            )}
            {authMessage && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-2.5 rounded-lg text-sm text-center">
                {authMessage}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-emerald-400/80 uppercase tracking-wider mb-2">Username</label>
              <input
                type="text"
                placeholder="enter username"
                className="w-full bg-[#050c07] border border-emerald-500/20 rounded-xl px-4 py-3 text-white placeholder-emerald-400/30 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-all"
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-400/80 uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full bg-[#050c07] border border-emerald-500/20 rounded-xl px-4 py-3 text-white placeholder-emerald-400/30 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-all"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
              />
            </div>



            <button
              type="submit"
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-[#020503] font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] active:scale-[0.98]"
            >
              {isLoginView ? "Sign In" : "Register Account"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-emerald-400/60">
            {isLoginView ? (
              <span>
                Don't have an account?{" "}
                <button onClick={() => { setIsLoginView(false); setAuthError(""); }} className="text-emerald-400 hover:underline font-semibold ml-1">
                  Create one here
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{" "}
                <button onClick={() => { setIsLoginView(true); setAuthError(""); }} className="text-emerald-400 hover:underline font-semibold ml-1">
                  Sign in here
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Helper to get severity colors
  const getSeverityBadge = (level: string) => {
    switch (level?.toLowerCase()) {
      case "critical":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "medium":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default:
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* GLOWING HEADER */}
      <header className="glass-card border-t-0 border-x-0 sticky top-0 z-50 rounded-none px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.15)]">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-wider glow-text-green">AgriVision AI</h1>
            <span className="text-[10px] text-emerald-400/40 uppercase tracking-widest font-semibold block -mt-0.5">
              Portal / {session.role === "admin" ? "Expert Control" : "Farmer Hub"}
            </span>
          </div>
        </div>

        {/* Navigation Tabs based on Roles */}
        <nav className="flex items-center gap-2">
          {session.role === "farmer" ? (
            <>
              <button
                onClick={() => setActiveTab("scan")}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeTab === "scan" 
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400" 
                    : "text-emerald-400/60 hover:text-white"
                }`}
              >
                <Upload className="h-4 w-4" /> Scan Leaf
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeTab === "history" 
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400" 
                    : "text-emerald-400/60 hover:text-white"
                }`}
              >
                <History className="h-4 w-4" /> My Scans
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setActiveTab("admin-dashboard"); fetchAdminData(); }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeTab === "admin-dashboard" 
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400" 
                    : "text-emerald-400/60 hover:text-white"
                }`}
              >
                <Activity className="h-4 w-4" /> Analytics Dashboard
              </button>
              <button
                onClick={() => { setActiveTab("admin-history"); fetchAdminData(); }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeTab === "admin-history" 
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400" 
                    : "text-emerald-400/60 hover:text-white"
                }`}
              >
                <FileSpreadsheet className="h-4 w-4" /> Global Records
              </button>
            </>
          )}

          <div className="h-5 w-px bg-emerald-500/20 mx-2"></div>

          {/* Logged in User info & Logout */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-white leading-tight capitalize">{session.username}</p>
              <span className="text-[10px] text-emerald-400/50 uppercase tracking-widest">{session.role}</span>
            </div>
            <div className="p-2 rounded-lg bg-[#0c140e] border border-emerald-500/10 text-emerald-400">
              <User className="h-4 w-4" />
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/25 active:scale-[0.96] transition-all"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </nav>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 relative">
        
        {/* --- FARMER VIEW: SCAN LEAF --- */}
        {session.role === "farmer" && activeTab === "scan" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Uploader Column */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
                <h3 className="text-lg font-bold text-white mb-4">Leaf Analysis Scanner</h3>
                
                {/* Upload drag drop zone */}
                <div className="border border-dashed border-emerald-500/20 hover:border-emerald-500/50 rounded-xl p-8 text-center bg-[#040804] relative group transition-all">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  
                  {previewUrl ? (
                    <div className="relative aspect-square w-full rounded-lg overflow-hidden border border-emerald-500/20 bg-black">
                      <img src={previewUrl} alt="Leaf Preview" className="w-full h-full object-cover" />
                      {loading && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                          <RefreshCw className="h-10 w-10 text-emerald-400 animate-spin mb-2" />
                          <p className="text-emerald-400 font-semibold text-sm">Processing image...</p>
                        </div>
                      )}
                      {/* Scanning Line overlay when loading */}
                      {loading && <div className="absolute inset-x-0 scanner-line"></div>}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6">
                      <div className="p-4 rounded-xl bg-emerald-500/5 text-emerald-400 group-hover:bg-emerald-500/10 border border-emerald-500/10 transition-all mb-4">
                        <Upload className="h-8 w-8" />
                      </div>
                      <p className="text-sm font-bold text-white mb-1">Click or drag leaf image</p>
                      <p className="text-xs text-emerald-400/40">Supports JPG, JPEG, PNG, WEBP, BMP, or JFIF formats</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleScanSubmit}
                  disabled={!selectedFile || loading}
                  className={`w-full py-3.5 mt-5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                    !selectedFile || loading
                      ? "bg-emerald-500/10 text-emerald-400/30 border border-emerald-500/5 cursor-not-allowed"
                      : "bg-emerald-500 hover:bg-emerald-400 text-[#020503] shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-[0.98]"
                  }`}
                >
                  <Activity className="h-4 w-4" /> {loading ? "Analyzing leaf..." : "Analyze Crop Health"}
                </button>
              </div>

              {/* Quick History List sidebar */}
              <div className="glass-card rounded-2xl p-6 flex-1">
                <h3 className="text-base font-bold text-white mb-4">Recent Diagnoses</h3>
                {historyLogs.length === 0 ? (
                  <p className="text-sm text-emerald-400/40 italic py-4 text-center">No recent scans logged yet.</p>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {historyLogs.slice(0, 4).map((log) => (
                      <div
                        key={log.id}
                        onClick={() => {
                          setPredictionResult(log);
                          setPreviewUrl(`${API_BASE}${log.image_path}`);
                        }}
                        className="p-3 bg-[#050c06] hover:bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center justify-between cursor-pointer group transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={`${API_BASE}${log.image_path}`}
                            alt="Scan Thumbnail"
                            className="h-10 w-10 rounded-lg object-cover border border-emerald-500/10"
                          />
                          <div>
                            <p className="text-sm font-bold text-white leading-tight group-hover:text-emerald-400 transition-colors">
                              {log.crop}
                            </p>
                            <span className="text-[11px] text-emerald-400/50 block mt-0.5">{log.disease}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-400/60">
                          {log.confidence.toFixed(1)}% <ChevronRight className="h-3 w-3" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Results Details Column */}
            <div className="lg:col-span-7">
              {predictionResult ? (
                <div className="glass-card rounded-2xl p-6 flex flex-col h-full">
                  
                  {/* Result Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-500/15 pb-5 mb-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-emerald-400/80">{predictionResult.crop}</span>
                        <ChevronRight className="h-3 w-3 text-emerald-400/40" />
                        <span className={`px-2.5 py-0.5 border text-xs font-bold rounded-full ${getSeverityBadge(predictionResult.advisory.severity)}`}>
                          {predictionResult.advisory.severity} Severity
                        </span>
                      </div>
                      <h2 className="text-2xl font-extrabold text-white mt-1 glow-text-green">
                        {predictionResult.disease}
                      </h2>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-emerald-400/50 uppercase tracking-widest font-semibold block">Confidence match</span>
                      <p className="text-3xl font-black text-emerald-400 glow-text-green mt-0.5">
                        {predictionResult.confidence.toFixed(1)}%
                      </p>
                      {predictionResult.is_demo && (
                        <span className="text-[10px] bg-amber-500/15 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-semibold mt-1 inline-block">
                          Demo Mode
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tabs Navigation */}
                  <div className="flex border-b border-emerald-500/10 mb-5 gap-2">
                    <button
                      onClick={() => setScanTab("info")}
                      className={`px-4 py-2.5 font-bold text-sm border-b-2 -mb-px transition-all ${
                        scanTab === "info"
                          ? "border-emerald-500 text-emerald-400"
                          : "border-transparent text-emerald-400/40 hover:text-emerald-400/80"
                      }`}
                    >
                      Information & Symptoms
                    </button>
                    <button
                      onClick={() => setScanTab("treatment")}
                      className={`px-4 py-2.5 font-bold text-sm border-b-2 -mb-px transition-all ${
                        scanTab === "treatment"
                          ? "border-emerald-500 text-emerald-400"
                          : "border-transparent text-emerald-400/40 hover:text-emerald-400/80"
                      }`}
                    >
                      Treatment Cures
                    </button>
                    <button
                      onClick={() => setScanTab("prevention")}
                      className={`px-4 py-2.5 font-bold text-sm border-b-2 -mb-px transition-all ${
                        scanTab === "prevention"
                          ? "border-emerald-500 text-emerald-400"
                          : "border-transparent text-emerald-400/40 hover:text-emerald-400/80"
                      }`}
                    >
                      Prevention Guidelines
                    </button>
                  </div>

                  {/* Tab Contents */}
                  <div className="flex-1">
                    {scanTab === "info" && (
                      <div className="space-y-5 animate-fade-in">
                        <div>
                          <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1.5">Disease Description</h4>
                          <p className="text-sm text-emerald-400/80 leading-relaxed bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl">
                            {predictionResult.advisory.description}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">Key Symptoms</h4>
                          <ul className="space-y-2">
                            {predictionResult.advisory.symptoms.map((sym: string, i: number) => (
                              <li key={i} className="text-sm text-white/95 flex items-start gap-2.5">
                                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                                {sym}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {scanTab === "treatment" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-in">
                        <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl">
                          <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2 mb-3">
                            <CheckCircle2 className="h-4 w-4" /> Organic Remedies
                          </h4>
                          <ul className="space-y-2">
                            {predictionResult.advisory.organic_treatment.map((tr: string, i: number) => (
                              <li key={i} className="text-xs text-emerald-400/80 leading-relaxed flex items-start gap-2">
                                <span className="text-emerald-400 flex-shrink-0">•</span> {tr}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-xl">
                          <h4 className="text-sm font-bold text-red-400 flex items-center gap-2 mb-3">
                            <ShieldAlert className="h-4 w-4" /> Chemical Treatments
                          </h4>
                          <ul className="space-y-2">
                            {predictionResult.advisory.chemical_treatment.map((tr: string, i: number) => (
                              <li key={i} className="text-xs text-red-400/80 leading-relaxed flex items-start gap-2">
                                <span className="text-red-400 flex-shrink-0">•</span> {tr}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {scanTab === "prevention" && (
                      <div className="bg-[#050c06] border border-emerald-500/10 p-5 rounded-xl animate-fade-in">
                        <h4 className="text-sm font-bold text-white mb-3">Best Farming Prevention Practices</h4>
                        <ul className="space-y-3">
                          {predictionResult.advisory.prevention.map((pr: string, i: number) => (
                            <li key={i} className="text-sm text-emerald-400/80 leading-relaxed flex items-start gap-3">
                              <span className="inline-flex h-5 w-5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-black rounded-full items-center justify-center flex-shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              {pr}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="glass-card rounded-2xl p-8 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
                  <div className="p-4 rounded-full bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 mb-4 animate-pulse">
                    <Activity className="h-10 w-10" />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-1">Awaiting Diagnosis</h4>
                  <p className="text-sm text-emerald-400/40 max-w-sm">
                    Upload a leaf photograph on the left, and the AI will analyze it and display organic and chemical remedies here.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- FARMER VIEW: SCAN HISTORY --- */}
        {session.role === "farmer" && activeTab === "history" && (
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">Your Leaf Scan History</h2>
            
            {historyLogs.length === 0 ? (
              <div className="py-16 text-center">
                <History className="h-12 w-12 text-emerald-400/20 mx-auto mb-3" />
                <p className="text-emerald-400/40 italic">You haven't scanned any leaves yet. Go to 'Scan Leaf' to start.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {historyLogs.map((log) => (
                  <div
                    key={log.id}
                    onClick={() => {
                      setPredictionResult(log);
                      setPreviewUrl(`${API_BASE}${log.image_path}`);
                      setActiveTab("scan");
                    }}
                    className="glass-card rounded-xl overflow-hidden hover:border-emerald-500/35 cursor-pointer group transition-all flex flex-col"
                  >
                    <div className="aspect-video w-full relative overflow-hidden bg-black border-b border-emerald-500/10">
                      <img src={`${API_BASE}${log.image_path}`} alt="Diagnosis" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute top-2 right-2 bg-[#030704]/80 px-2 py-0.5 rounded text-[11px] font-bold text-emerald-400 border border-emerald-500/20">
                        {log.confidence.toFixed(1)}% Match
                      </div>
                    </div>
                    
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-emerald-400/60 font-semibold">{log.crop}</span>
                          <span className="text-[10px] text-emerald-400/40 font-semibold">
                            {new Date(log.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-white mt-1 group-hover:text-emerald-400 transition-colors">
                          {log.disease}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold mt-4 justify-end">
                        View Advisory <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- ADMIN VIEW: ANALYTICS DASHBOARD --- */}
        {session.role === "admin" && activeTab === "admin-dashboard" && (
          <div className="space-y-6">
            
            {/* System statistics row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="glass-card rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-emerald-400/50 uppercase tracking-widest">Total Diagnoses</span>
                  <p className="text-3xl font-black text-white glow-text-green mt-1">{stats.total_scans}</p>
                </div>
                <div className="p-3 bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 rounded-xl">
                  <Activity className="h-6 w-6" />
                </div>
              </div>

              <div className="glass-card rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-emerald-400/50 uppercase tracking-widest">Active Farmers</span>
                  <p className="text-3xl font-black text-white glow-text-green mt-1">{stats.total_farmers}</p>
                </div>
                <div className="p-3 bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 rounded-xl">
                  <User className="h-6 w-6" />
                </div>
              </div>

              <div className="glass-card rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-emerald-400/50 uppercase tracking-widest">Alerts Status</span>
                  <p className="text-3xl font-black text-amber-400 mt-1">Active</p>
                </div>
                <div className="p-3 bg-amber-500/5 text-amber-400 border border-amber-500/10 rounded-xl animate-pulse">
                  <AlertTriangle className="h-6 w-6" />
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Crop Analytics Chart */}
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-bold text-white">Crop Distribution (Total Scans)</h3>
                  <TrendingUp className="h-4 w-4 text-emerald-400/60" />
                </div>
                
                {Object.keys(stats.crop_distribution).length === 0 ? (
                  <p className="text-sm text-emerald-400/40 italic py-12 text-center">No crop data available yet.</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(stats.crop_distribution).map(([crop, count]) => {
                      const maxVal = Math.max(...Object.values(stats.crop_distribution));
                      const percentage = maxVal > 0 ? (count / maxVal) * 100 : 0;
                      
                      return (
                        <div key={crop} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-white capitalize">{crop}</span>
                            <span className="text-emerald-400">{count} scans</span>
                          </div>
                          <div className="h-2 w-full bg-[#050c05] rounded-full overflow-hidden border border-emerald-500/5">
                            <div
                              className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)] transition-all duration-1000"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Disease Analytics Chart */}
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-bold text-white">Top 5 Detected Diseases</h3>
                  <ShieldAlert className="h-4 w-4 text-emerald-400/60" />
                </div>

                {Object.keys(stats.disease_distribution).length === 0 ? (
                  <p className="text-sm text-emerald-400/40 italic py-12 text-center">No disease data available yet.</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(stats.disease_distribution).map(([disease, count]) => {
                      const maxVal = Math.max(...Object.values(stats.disease_distribution));
                      const percentage = maxVal > 0 ? (count / maxVal) * 100 : 0;
                      
                      return (
                        <div key={disease} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-white truncate max-w-[200px]">{disease}</span>
                            <span className="text-emerald-400">{count} cases</span>
                          </div>
                          <div className="h-2 w-full bg-[#050c05] rounded-full overflow-hidden border border-emerald-500/5">
                            <div
                              className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)] transition-all duration-1000"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* --- ADMIN VIEW: GLOBAL RECORDS --- */}
        {session.role === "admin" && activeTab === "admin-history" && (
          <div className="glass-card rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">Global Diagnosis Ledger</h2>
                <p className="text-xs text-emerald-400/40">Audit list of all scans conducted by farmers across the network</p>
              </div>

              {/* Search filter */}
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400/40" />
                <input
                  type="text"
                  placeholder="Filter by farmer, crop or disease..."
                  className="w-full bg-[#050c07] border border-emerald-500/20 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-emerald-400/30 focus:outline-none focus:border-emerald-500/55"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>
            </div>

            {/* Filtered logs */}
            {adminLogs.length === 0 ? (
              <p className="text-sm text-emerald-400/40 italic py-12 text-center">No global records found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-emerald-500/15 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      <th className="pb-3 pr-4">Image</th>
                      <th className="pb-3 px-4">Farmer</th>
                      <th className="pb-3 px-4">Crop</th>
                      <th className="pb-3 px-4">Disease</th>
                      <th className="pb-3 px-4">Confidence</th>
                      <th className="pb-3 pl-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-500/10 text-xs">
                    {adminLogs
                      .filter((log) => {
                        const term = searchFilter.toLowerCase();
                        return (
                          log.crop.toLowerCase().includes(term) ||
                          log.disease.toLowerCase().includes(term) ||
                          log.username?.toLowerCase().includes(term)
                        );
                      })
                      .map((log) => (
                        <tr key={log.id} className="hover:bg-emerald-500/5 transition-colors">
                          <td className="py-3.5 pr-4">
                            <img
                              src={`${API_BASE}${log.image_path}`}
                              alt="Log Thumbnail"
                              className="h-10 w-12 rounded object-cover border border-emerald-500/10 bg-black"
                            />
                          </td>
                          <td className="py-3.5 px-4 font-bold text-white capitalize">{log.username}</td>
                          <td className="py-3.5 px-4 text-emerald-400/90 font-semibold">{log.crop}</td>
                          <td className="py-3.5 px-4 text-white font-medium">{log.disease}</td>
                          <td className="py-3.5 px-4 font-bold text-emerald-400">{log.confidence.toFixed(1)}%</td>
                          <td className="py-3.5 pl-4 text-emerald-400/60 font-semibold">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
