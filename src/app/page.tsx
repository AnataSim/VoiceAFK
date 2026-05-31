"use client";

import React, { useState, useEffect, useRef } from "react";

interface LogEntry {
  timestamp: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

interface DiscordChannel {
  id: string;
  name: string;
}

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  channels: DiscordChannel[];
}

interface BackendState {
  isBotLoggedIn: boolean;
  botUsername: string | null;
  botAvatar: string | null;
  isConnectedToVoice: boolean;
  guildId: string | null;
  channelId: string | null;
  status: "offline" | "logging_in" | "ready" | "connecting_voice" | "connected_voice";
  logs: LogEntry[];
  guilds?: DiscordGuild[];
  inviteLink?: string | null;
}

export default function Home() {
  // Config States (Persistent in LocalStorage)
  const [apiUrl, setApiUrl] = useState("http://localhost:3001");
  const [botToken, setBotToken] = useState("");
  const [guildId, setGuildId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [showToken, setShowToken] = useState(false);

  // Connection State
  const [backendState, setBackendState] = useState<BackendState>({
    isBotLoggedIn: false,
    botUsername: null,
    botAvatar: null,
    isConnectedToVoice: false,
    guildId: null,
    channelId: null,
    status: "offline",
    logs: [],
    guilds: [],
    inviteLink: null,
  });

  // UI Local States
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingInBot, setIsLoggingInBot] = useState(false);
  const [useManualInput, setUseManualInput] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localLogs, setLocalLogs] = useState<LogEntry[]>([]);
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(30).fill(6));

  const animationRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load configs from LocalStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedApiUrl = localStorage.getItem("voice_api_url");
      const savedToken = localStorage.getItem("voice_bot_token");
      const savedGuildId = localStorage.getItem("voice_guild_id");
      const savedChannelId = localStorage.getItem("voice_channel_id");

      if (savedApiUrl) setApiUrl(savedApiUrl);
      if (savedToken) setBotToken(savedToken);
      if (savedGuildId) setGuildId(savedGuildId);
      if (savedChannelId) setChannelId(savedChannelId);

      addLocalLog("Dashboard diinisialisasi. Siap mengendalikan bot.", "info");
    }
  }, []);

  // Save configs to LocalStorage on change
  const saveConfig = (key: string, value: string) => {
    localStorage.setItem(key, value);
  };

  // Add Log locally (before backend replies or for UI actions)
  const addLocalLog = (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    setLocalLogs((prev) => [{ timestamp, message, type }, ...prev].slice(0, 50));
  };

  // Poll Backend Status
  const fetchBackendStatus = async (silent = false) => {
    try {
      const res = await fetch(`${apiUrl}/api/status`);
      if (!res.ok) throw new Error("Gagal terhubung ke API backend.");
      const data: BackendState = await res.json();
      setBackendState(data);
      setErrorMessage(null);
    } catch (err: any) {
      if (!silent) {
        setErrorMessage("Tidak dapat terhubung ke server bot. Pastikan server Railway/lokal Anda aktif.");
        addLocalLog("Gagal sinkronisasi dengan API backend bot.", "error");
      }
    }
  };

  // Start polling status
  useEffect(() => {
    fetchBackendStatus(true);
    pollIntervalRef.current = setInterval(() => {
      fetchBackendStatus(true);
    }, 4000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [apiUrl]);

  // Animate Waveform based on Connection Status
  useEffect(() => {
    const status = backendState.status;
    if (status === "connected_voice") {
      const animateWave = () => {
        setWaveformBars(
          Array.from({ length: 30 }, () => Math.floor(Math.random() * 40) + 8)
        );
        animationRef.current = requestAnimationFrame(animateWave);
      };
      animationRef.current = requestAnimationFrame(animateWave);
    } else if (status === "connecting_voice" || status === "logging_in") {
      const animateWave = () => {
        setWaveformBars(
          Array.from({ length: 30 }, (_, i) => {
            const time = Date.now() * 0.005;
            return Math.floor(Math.sin(time + i * 0.3) * 12) + 15;
          })
        );
        animationRef.current = requestAnimationFrame(animateWave);
      };
      animationRef.current = requestAnimationFrame(animateWave);
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      setWaveformBars(Array(30).fill(6));
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [backendState.status]);

  // Paste token from clipboard helper
  const handlePasteToken = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setBotToken(text.trim());
        saveConfig("voice_bot_token", text.trim());
        addLocalLog("Token berhasil ditempel dari clipboard.", "success");
      } else {
        addLocalLog("Clipboard kosong.", "warning");
      }
    } catch (err) {
      addLocalLog("Gagal menempelkan token. Pastikan Anda mengizinkan akses clipboard di browser.", "error");
    }
  };

  // Login Bot (Save Token & Initialize)
  const handleLoginBot = async () => {
    setIsLoggingInBot(true);
    setErrorMessage(null);
    addLocalLog("Mengirimkan permintaan login bot...", "info");

    try {
      const res = await fetch(`${apiUrl}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: botToken || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal mengautentikasi bot.");
      }

      setBackendState(data.state);
      addLocalLog("Bot berhasil login dan siap!", "success");
    } catch (err: any) {
      setErrorMessage(err.message || "Error saat melakukan login bot.");
      addLocalLog(`Gagal login bot: ${err.message}`, "error");
    } finally {
      setIsLoggingInBot(false);
      fetchBackendStatus(true);
    }
  };

  // Connect Bot to Voice
  const handleConnect = async () => {
    if (!guildId || !channelId) {
      setErrorMessage("Guild ID dan Channel ID wajib diisi!");
      addLocalLog("Koneksi dibatalkan: Parameter tidak lengkap.", "warning");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    addLocalLog("Mengirimkan permintaan sambungan voice channel...", "info");

    try {
      const res = await fetch(`${apiUrl}/api/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: botToken || undefined,
          guildId,
          channelId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal menyambungkan bot.");
      }

      setBackendState(data.state);
      addLocalLog("Koneksi dikonfirmasi oleh Backend!", "success");
    } catch (err: any) {
      setErrorMessage(err.message || "Error saat menghubungkan ke backend.");
      addLocalLog(`Gagal menyambung: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
      fetchBackendStatus(true);
    }
  };

  // Disconnect Bot from Voice
  const handleDisconnect = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    addLocalLog("Mengirimkan permintaan pemutusan voice channel...", "info");

    try {
      const res = await fetch(`${apiUrl}/api/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal memutuskan koneksi bot.");
      }

      setBackendState(data.state);
      addLocalLog("Koneksi suara berhasil diputuskan secara bersih.", "success");
    } catch (err: any) {
      setErrorMessage(err.message || "Error saat memutuskan koneksi.");
      addLocalLog(`Gagal memutus koneksi: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
      fetchBackendStatus(true);
    }
  };

  // Clear Logs
  const handleClearLogs = async () => {
    setLocalLogs([]);
    try {
      await fetch(`${apiUrl}/api/logs/clear`, { method: "POST" });
    } catch (e) {}
    addLocalLog("Konsol log dibersihkan.", "info");
  };

  // Combine Local and Backend logs sorted by time / presence
  const allLogs = [...localLogs, ...(backendState.logs || [])];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-100 font-sans selection:bg-purple-500 selection:text-white">
      {/* Decorative Aura Lights */}
      <div className="absolute top-[-10%] left-[-10%] h-[600px] w-[600px] rounded-full bg-gradient-to-tr from-purple-600/10 to-indigo-600/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[600px] w-[600px] rounded-full bg-gradient-to-tr from-teal-500/10 to-emerald-600/15 blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-[10%] h-[400px] w-[400px] rounded-full bg-gradient-to-tr from-pink-500/5 to-purple-500/10 blur-[100px] pointer-events-none" />

      {/* Futuristic Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-900/60 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-500 via-indigo-500 to-teal-400 p-0.5 shadow-lg shadow-purple-500/10">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950 text-purple-400">
                <svg className="h-5 w-5 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              </div>
            </div>
            <div>
              <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-teal-400 bg-clip-text text-lg font-extrabold tracking-wider text-transparent uppercase">DISCORD.24/7</span>
              <span className="ml-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-400 uppercase tracking-widest">Voice Core</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
              backendState.status === "connected_voice" 
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" 
                : backendState.status === "connecting_voice" || backendState.status === "logging_in"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-400 animate-pulse"
                : "border-slate-800 bg-slate-900/50 text-slate-400"
            }`}>
              <span className={`h-2 w-2 rounded-full ${
                backendState.status === "connected_voice" 
                  ? "bg-emerald-500 shadow-lg shadow-emerald-500/50" 
                  : backendState.status === "connecting_voice" || backendState.status === "logging_in"
                  ? "bg-amber-500 shadow-lg shadow-amber-500/50"
                  : "bg-slate-600"
              }`} />
              <span className="capitalize">
                {backendState.status === "connected_voice" && "Voice Stay Active 24/7"}
                {backendState.status === "connecting_voice" && "Mempersiapkan Suara..."}
                {backendState.status === "logging_in" && "Menghubungkan Bot..."}
                {backendState.status === "ready" && "Bot Siap (Menunggu)"}
                {backendState.status === "offline" && "Backend Offline"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard Main Grid */}
      <main className="mx-auto max-w-7xl px-6 py-8 sm:px-8 flex flex-col gap-8 relative z-10">
        
        {/* Error Alert banner if any */}
        {errorMessage && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-center justify-between gap-3 animate-fade-in shadow-lg shadow-red-500/5">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <p className="font-medium">{errorMessage}</p>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white transition-colors font-bold text-xs px-2 py-1 rounded hover:bg-red-500/20">
              Tutup
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Controller Configuration */}
          <div className="lg:col-span-5 flex flex-col gap-6 w-full">
            
            {/* Card 1: Bot Settings */}
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/40 p-6 shadow-2xl backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-purple-500/5 blur-xl pointer-events-none" />
              
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                <span className="text-xl">⚙️</span> Konfigurasi Sistem
              </h2>

              <div className="flex flex-col gap-5">
                {/* API Url */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">URL API Backend Bot</label>
                  <input
                    type="url"
                    value={apiUrl}
                    onChange={(e) => {
                      setApiUrl(e.target.value);
                      saveConfig("voice_api_url", e.target.value);
                    }}
                    placeholder="Contoh: http://localhost:3001 atau https://api.railway.app"
                    className="rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                  />
                </div>

                {/* Discord Token */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Token Bot Discord</label>
                    <div className="flex gap-3">
                      <button 
                        onClick={handlePasteToken}
                        className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                        type="button"
                      >
                        📋 Tempel
                      </button>
                      <button 
                        onClick={() => setShowToken(!showToken)}
                        className="text-[10px] font-semibold text-purple-400 hover:text-purple-300 transition-colors uppercase tracking-wider cursor-pointer"
                        type="button"
                      >
                        {showToken ? "Sembunyikan" : "Tampilkan"}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type={showToken ? "text" : "password"}
                      value={botToken}
                      onChange={(e) => {
                        setBotToken(e.target.value);
                        saveConfig("voice_bot_token", e.target.value);
                      }}
                      placeholder="Masukkan token bot resmi Anda (Opsional jika diset di .env)"
                      className="flex-1 rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                    />
                    <button
                      onClick={handleLoginBot}
                      disabled={isLoggingInBot || isLoading}
                      className={`rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all duration-300 flex items-center justify-center gap-1.5 ${
                        backendState.isBotLoggedIn
                          ? "bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer"
                          : "bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 shadow-purple-500/20 cursor-pointer"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isLoggingInBot ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-white" />
                      ) : backendState.isBotLoggedIn ? (
                        "Re-Login"
                      ) : (
                        "Login"
                      )}
                    </button>
                  </div>
                </div>

                {/* Server Selection and Channel Selection */}
                {backendState.isBotLoggedIn && !useManualInput ? (
                  <div className="flex flex-col gap-4">
                    {/* Server Guild Dropdown */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Pilih Server (Guild)</label>
                        <button
                          onClick={() => setUseManualInput(true)}
                          className="text-[10px] font-semibold text-purple-400 hover:text-purple-300 transition-colors uppercase tracking-wider cursor-pointer"
                        >
                          Mode Manual (ID)
                        </button>
                      </div>
                      <select
                        value={guildId}
                        onChange={(e) => {
                          const selectedGId = e.target.value;
                          setGuildId(selectedGId);
                          saveConfig("voice_guild_id", selectedGId);
                          
                          // Auto-select first voice channel of selected guild
                          const guild = backendState.guilds?.find((g) => g.id === selectedGId);
                          if (guild && guild.channels.length > 0) {
                            setChannelId(guild.channels[0].id);
                            saveConfig("voice_channel_id", guild.channels[0].id);
                          } else {
                            setChannelId("");
                            saveConfig("voice_channel_id", "");
                          }
                        }}
                        className="rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all cursor-pointer font-sans"
                      >
                        <option value="" className="bg-slate-950 text-slate-400">-- Pilih Server Discord --</option>
                        {backendState.guilds?.map((g) => (
                          <option key={g.id} value={g.id} className="bg-slate-950 text-white">
                            {g.name} ({g.channels.length} Saluran)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Channel Dropdown */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Pilih Saluran Suara</label>
                      <select
                        value={channelId}
                        onChange={(e) => {
                          setChannelId(e.target.value);
                          saveConfig("voice_channel_id", e.target.value);
                        }}
                        disabled={!guildId}
                        className="rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all cursor-pointer font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="" className="bg-slate-950 text-slate-400">
                          {guildId ? "-- Pilih Saluran Suara --" : "-- Pilih Server Terlebih Dahulu --"}
                        </option>
                        {backendState.guilds
                          ?.find((g) => g.id === guildId)
                          ?.channels.map((c) => (
                            <option key={c.id} value={c.id} className="bg-slate-950 text-white">
                              🔊 {c.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {/* Server Guild ID & Channel ID */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Server Guild ID</label>
                          {backendState.isBotLoggedIn && (
                            <button
                              onClick={() => setUseManualInput(false)}
                              className="text-[10px] font-semibold text-purple-400 hover:text-purple-300 transition-colors uppercase tracking-wider cursor-pointer"
                            >
                              Mode Dropdown
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={guildId}
                          onChange={(e) => {
                            setGuildId(e.target.value);
                            saveConfig("voice_guild_id", e.target.value);
                          }}
                          placeholder="e.g. 10482930283"
                          className="rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Voice Channel ID</label>
                        <input
                          type="text"
                          value={channelId}
                          onChange={(e) => {
                            setChannelId(e.target.value);
                            saveConfig("voice_channel_id", e.target.value);
                          }}
                          placeholder="e.g. 10482939103"
                          className="rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                        />
                      </div>
                    </div>
                    {!backendState.isBotLoggedIn && (
                      <p className="text-[10px] text-slate-500 mt-0.5 italic">
                        *Lakukan login bot terlebih dahulu untuk memunculkan mode dropdown pilihan server otomatis.
                      </p>
                    )}
                  </div>
                )}

                {/* Invite Link Banner */}
                {backendState.inviteLink && (
                  <div className="mt-2 flex items-center justify-between p-3 rounded-2xl border border-purple-500/20 bg-purple-500/5 shadow-inner">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-extrabold text-purple-400 uppercase tracking-widest">Belum Undang Bot?</span>
                      <span className="text-[11px] text-slate-400 leading-tight">Tambahkan bot langsung ke server Anda</span>
                    </div>
                    <a
                      href={backendState.inviteLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 px-3 py-2 text-xs font-black text-white shadow-lg shadow-purple-500/20 transition-all flex items-center gap-1.5"
                    >
                      <span>Undang</span>
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Interactive Cyber-Button Controller */}
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/40 p-8 shadow-2xl backdrop-blur-md flex flex-col items-center justify-center text-center gap-6 relative overflow-hidden">
              <div className="absolute -bottom-16 -left-16 h-36 w-36 rounded-full bg-teal-500/5 blur-xl pointer-events-none" />

              <div>
                <h3 className="text-md font-bold text-white mb-1">
                  Kontrol Pusat Suara Bot
                </h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Klik tombol siber di bawah untuk memicu bot masuk/keluar dari voice channel Discord secara permanen.
                </p>
              </div>

              {/* CYBER CIRCLE BUTTON CONTAINER */}
              <div className="relative flex items-center justify-center h-48 w-48 mt-2">
                {/* Glow ring backgrounds */}
                <div className={`absolute inset-0 rounded-full blur-[20px] transition-all duration-700 ${
                  backendState.status === "connected_voice"
                    ? "bg-emerald-500/20 scale-110"
                    : backendState.status === "connecting_voice" || backendState.status === "logging_in"
                    ? "bg-amber-500/20 scale-110 animate-pulse"
                    : "bg-purple-500/10 scale-95"
                }`} />

                {/* Dynamic ring ripple loops */}
                {backendState.status === "connected_voice" && (
                  <div className="absolute inset-[-10px] rounded-full border border-emerald-500/30 animate-ping opacity-30 pointer-events-none" />
                )}

                {/* Main Interactive Circle */}
                <button
                  disabled={isLoading}
                  onClick={backendState.isConnectedToVoice ? handleDisconnect : handleConnect}
                  className={`relative flex h-40 w-40 flex-col items-center justify-center rounded-full border-[3px] shadow-2xl transition-all duration-300 transform active:scale-95 ${
                    backendState.isConnectedToVoice
                      ? "bg-slate-950 border-emerald-500 text-emerald-400 hover:shadow-emerald-500/20"
                      : "bg-slate-950 border-purple-500/80 text-purple-400 hover:border-purple-400 hover:shadow-purple-500/20"
                  } ${isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  {/* Cyber Lines styling inside circle */}
                  <div className="absolute inset-2 rounded-full border border-slate-900 pointer-events-none" />
                  
                  {isLoading ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-700 border-t-purple-400" />
                      <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Memproses...</span>
                    </div>
                  ) : backendState.isConnectedToVoice ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-2xl animate-pulse">📶</span>
                      <span className="text-[11px] font-black tracking-widest uppercase text-emerald-400">DISCONNECT</span>
                      <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mt-1">Bot Aktif 24/7</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-2xl">💤</span>
                      <span className="text-[11px] font-black tracking-widest uppercase text-purple-400">CONNECT BOT</span>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Klik Untuk Stay</span>
                    </div>
                  )}
                </button>
              </div>

              <div className="text-xs text-slate-500 font-medium">
                *Status Tersimpan: <strong className="text-slate-400">{backendState.isConnectedToVoice ? "Terhubung" : "Terputus"}</strong>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Status Monitor & Live Console */}
          <div className="lg:col-span-7 flex flex-col gap-6 w-full">
            
            {/* Status Monitor Display Card */}
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/40 p-6 shadow-2xl backdrop-blur-md relative overflow-hidden">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                <span className="text-xl">📊</span> Status Monitor Bot
              </h2>

              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-slate-950/60 border border-slate-900 shadow-inner">
                {/* Avatar Display */}
                <div className="relative">
                  {backendState.botAvatar ? (
                    <img 
                      src={backendState.botAvatar} 
                      alt="Bot Avatar" 
                      className="h-20 w-20 rounded-2xl border border-slate-800 shadow-md"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-2xl border border-slate-800 bg-slate-900 flex items-center justify-center text-3xl shadow-inner text-slate-600">
                      🤖
                    </div>
                  )}
                  {backendState.isBotLoggedIn && (
                    <span className="absolute bottom-[-3px] right-[-3px] h-5 w-5 rounded-full border-2 border-slate-950 bg-emerald-500 shadow-lg" />
                  )}
                </div>

                {/* Details list */}
                <div className="flex-1 flex flex-col gap-1 w-full text-center sm:text-left">
                  <div className="text-sm text-slate-500 font-bold tracking-wide uppercase">Identitas Bot</div>
                  <h3 className="text-lg font-extrabold text-white font-mono">
                    {backendState.botUsername || "Bot Belum Terhubung"}
                  </h3>
                  
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-2 text-xs text-slate-400">
                    <div>
                      Server ID: <span className="font-mono text-white font-bold">{backendState.guildId || "-"}</span>
                    </div>
                    <div className="hidden sm:inline text-slate-700">|</div>
                    <div>
                      Channel ID: <span className="font-mono text-white font-bold">{backendState.channelId || "-"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Waveform Card */}
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/40 p-6 shadow-2xl backdrop-blur-md flex flex-col gap-4 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    {backendState.status === "connected_voice" && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    )}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${
                      backendState.status === "connected_voice" ? "bg-emerald-500" : "bg-slate-600"
                    }`}></span>
                  </span>
                  Visualizer Sinyal Voice Gateway
                </h3>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Real-time Waveform</span>
              </div>

              {/* Waveform Bars Render */}
              <div className="h-20 bg-slate-950/80 border border-slate-900 rounded-2xl flex items-center justify-center gap-1 px-6 shadow-inner">
                {waveformBars.map((height, idx) => (
                  <div
                    key={idx}
                    className={`w-1 rounded-full transition-all duration-150 ${
                      backendState.status === "connected_voice"
                        ? "bg-gradient-to-t from-emerald-500 to-teal-400"
                        : backendState.status === "connecting_voice" || backendState.status === "logging_in"
                        ? "bg-gradient-to-t from-amber-500 to-orange-400 animate-pulse"
                        : "bg-slate-800"
                    }`}
                    style={{ height: `${height}px` }}
                  />
                ))}
              </div>
            </div>

            {/* Console Log Card */}
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/40 p-6 shadow-2xl backdrop-blur-md flex flex-col gap-4 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <h2 className="text-md font-bold text-white flex items-center gap-2">
                  <span className="text-xl">🖥️</span> Live Console Monitor
                </h2>
                <button
                  onClick={handleClearLogs}
                  className="rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 hover:border-slate-700 px-3 py-1.5 text-[10px] font-bold text-slate-400 hover:text-white transition-all shadow-inner uppercase tracking-wider"
                >
                  Clear Console
                </button>
              </div>

              {/* Scrollable Console Box */}
              <div className="h-60 bg-slate-950 border border-slate-900 rounded-2xl p-4 font-mono text-xs flex flex-col gap-2 overflow-y-auto shadow-inner text-left selection:bg-slate-800">
                {allLogs.length === 0 ? (
                  <div className="text-slate-600 italic text-center my-auto">
                    Console kosong. Hubungkan bot untuk melihat aktivitas log.
                  </div>
                ) : (
                  allLogs.map((log, index) => (
                    <div key={index} className="flex items-start gap-2.5 leading-relaxed py-0.5 border-b border-slate-900/40 last:border-b-0">
                      <span className="text-slate-500 shrink-0 font-semibold select-none">[{log.timestamp}]</span>
                      <span className={`break-words ${
                        log.type === "success" ? "text-emerald-400" :
                        log.type === "error" ? "text-red-400 font-semibold" :
                        log.type === "warning" ? "text-amber-400" :
                        "text-indigo-300"
                      }`}>
                        <span className="font-bold mr-1.5">
                          {log.type === "success" && "✔"}
                          {log.type === "error" && "✖"}
                          {log.type === "warning" && "⚠"}
                          {log.type === "info" && "ℹ"}
                        </span>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="text-[10px] text-slate-500 font-medium">
                *Konsol menggabungkan data lokal (browser) dan riwayat aktivitas 24/7 langsung dari server Railway.
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Sleek Minimal Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 mt-16 relative z-10 text-slate-500 text-xs">
        <div className="mx-auto max-w-7xl px-6 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-gradient-to-tr from-purple-500 to-indigo-500" />
            <span className="font-extrabold text-slate-400">DISCORD.24/7 Controller</span>
          </div>
          <p>© 2026 DISCORD.24/7. Dideploy secara aman di Vercel & Railway.</p>
        </div>
      </footer>
    </div>
  );
}
