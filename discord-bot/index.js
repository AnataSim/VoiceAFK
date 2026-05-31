const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { 
  Client, 
  GatewayIntentBits,
  ChannelType
} = require('discord.js');
const { 
  joinVoiceChannel, 
  getVoiceConnection, 
  VoiceConnectionStatus,
  entersState
} = require('@discordjs/voice');

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Global State
let client = null;
let connectionState = {
  isBotLoggedIn: false,
  botUsername: null,
  botAvatar: null,
  isConnectedToVoice: false,
  guildId: null,
  channelId: null,
  status: 'offline', // 'offline' | 'logging_in' | 'ready' | 'connecting_voice' | 'connected_voice'
  logs: []
};

// Logger Helper
function addLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = { timestamp, message, type };
  connectionState.logs.unshift(logEntry); // Add to beginning of logs array
  // Limit to last 50 logs
  if (connectionState.logs.length > 50) {
    connectionState.logs.pop();
  }
  console.log(`[${type.toUpperCase()}] ${timestamp} - ${message}`);
}

// Initialize Bot if Token is in Environment Variables
const envToken = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
if (envToken) {
  addLog('Token ditemukan di Environment Variables. Memulai inisialisasi otomatis...', 'info');
  initializeDiscordBot(envToken).catch(err => {
    addLog(`Inisialisasi otomatis gagal: ${err.message}`, 'error');
  });
} else {
  addLog('Token tidak ditemukan di Environment Variables. Bot menunggu konfigurasi dari website dashboard.', 'warning');
}

// Function to Initialize Discord Client
function initializeDiscordBot(token) {
  return new Promise((resolve, reject) => {
    if (client) {
      addLog('Menghancurkan klien lama sebelum membuat yang baru...', 'info');
      try {
        client.destroy();
      } catch (e) {}
    }

    connectionState.status = 'logging_in';
    addLog('Menginisialisasi klien Discord baru...', 'info');

    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
      ]
    });

    client.on('ready', () => {
      connectionState.isBotLoggedIn = true;
      connectionState.botUsername = client.user.tag;
      connectionState.botAvatar = client.user.displayAvatarURL();
      connectionState.status = connectionState.isConnectedToVoice ? 'connected_voice' : 'ready';
      addLog(`Bot berhasil login sebagai: ${client.user.tag}`, 'success');
      resolve(client);
    });

    client.on('error', (err) => {
      addLog(`Klien Discord mengalami error: ${err.message}`, 'error');
    });

    client.on('disconnect', () => {
      connectionState.isBotLoggedIn = false;
      connectionState.status = 'offline';
      addLog('Bot terputus dari Discord gateway.', 'warning');
    });

    client.login(token).catch(err => {
      connectionState.status = 'offline';
      connectionState.isBotLoggedIn = false;
      addLog(`Login Discord Bot gagal: ${err.message}`, 'error');
      reject(err);
    });
  });
}

// Endpoints
app.get('/api/status', (req, res) => {
  let guilds = [];
  let inviteLink = null;

  if (client && connectionState.isBotLoggedIn) {
    inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=3145728&scope=bot`;
    try {
      guilds = client.guilds.cache.map(g => {
        const voiceChannels = g.channels.cache
          .filter(c => c.type === ChannelType.GuildVoice)
          .map(c => ({
            id: c.id,
            name: c.name
          }));
        return {
          id: g.id,
          name: g.name,
          icon: g.iconURL(),
          channels: voiceChannels
        };
      });
    } catch (err) {
      console.error('Error fetching guilds:', err);
    }
  }

  res.json({
    ...connectionState,
    guilds,
    inviteLink
  });
});

app.post('/api/login', async (req, res) => {
  const { botToken } = req.body;
  const activeToken = botToken || envToken;

  if (!activeToken) {
    return res.status(400).json({
      success: false,
      message: 'Token Bot belum dikonfigurasi. Harap masukkan token di website atau set DISCORD_TOKEN di backend.'
    });
  }

  try {
    addLog('Menerima perintah login bot dari dashboard...', 'info');
    await initializeDiscordBot(activeToken);
    res.json({
      success: true,
      message: 'Bot berhasil login.',
      state: connectionState
    });
  } catch (error) {
    addLog(`Gagal login bot: ${error.message}`, 'error');
    res.status(500).json({
      success: false,
      message: `Error login: ${error.message}`
    });
  }
});

app.post('/api/connect', async (req, res) => {
  const { botToken, guildId, channelId } = req.body;

  if (!guildId || !channelId) {
    return res.status(400).json({ 
      success: false, 
      message: 'guildId dan channelId wajib diisi.' 
    });
  }

  try {
    // 1. Authenticate Bot if token is provided or if not logged in
    const activeToken = botToken || envToken;
    if (!activeToken) {
      return res.status(400).json({ 
        success: false, 
        message: 'Token Bot belum dikonfigurasi. Harap masukkan token di website atau set DISCORD_TOKEN di backend.' 
      });
    }

    if (!client || !connectionState.isBotLoggedIn || (botToken && botToken !== envToken && client.token !== botToken)) {
      addLog('Melakukan autentikasi bot untuk koneksi suara...', 'info');
      await initializeDiscordBot(activeToken);
    }

    // 2. Connect to Voice Channel
    connectionState.status = 'connecting_voice';
    addLog(`Menghubungkan ke Voice Channel: Server ${guildId}, Channel ${channelId}...`, 'info');

    const voiceConnection = joinVoiceChannel({
      channelId: channelId,
      guildId: guildId,
      adapterCreator: client.guilds.cache.get(guildId).voiceAdapterCreator,
      selfDeaf: true, // Deaf by default to save bandwidth
      selfMute: false
    });

    // Handle Connection States
    voiceConnection.on(VoiceConnectionStatus.Ready, () => {
      connectionState.isConnectedToVoice = true;
      connectionState.guildId = guildId;
      connectionState.channelId = channelId;
      connectionState.status = 'connected_voice';
      addLog(`Bot berhasil masuk ke voice channel ${channelId} dan stay 24/7!`, 'success');
    });

    voiceConnection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        // Attempt reconnect if accidentally disconnected
        addLog('Koneksi terputus secara tidak terduga, mencoba menyambung kembali...', 'warning');
        await Promise.race([
          entersState(voiceConnection, VoiceConnectionStatus.Signalling, 5000),
          entersState(voiceConnection, VoiceConnectionStatus.Connecting, 5000),
        ]);
        // Reconnected!
      } catch (error) {
        // Real disconnect
        connectionState.isConnectedToVoice = false;
        connectionState.guildId = null;
        connectionState.channelId = null;
        connectionState.status = 'ready';
        addLog('Bot terputus sepenuhnya dari voice channel.', 'warning');
        try {
          voiceConnection.destroy();
        } catch (e) {}
      }
    });

    // Wait until connection is Ready (timeout 15s)
    await entersState(voiceConnection, VoiceConnectionStatus.Ready, 15000);

    res.json({
      success: true,
      message: 'Berhasil tersambung ke voice channel.',
      state: connectionState
    });

  } catch (error) {
    connectionState.status = client && connectionState.isBotLoggedIn ? 'ready' : 'offline';
    addLog(`Gagal menyambung ke voice channel: ${error.message}`, 'error');
    res.status(500).json({ 
      success: false, 
      message: `Error koneksi: ${error.message}` 
    });
  }
});

app.post('/api/disconnect', (req, res) => {
  if (!connectionState.isConnectedToVoice || !connectionState.guildId) {
    return res.json({ 
      success: true, 
      message: 'Bot memang sedang tidak tersambung ke voice channel mana pun.',
      state: connectionState
    });
  }

  try {
    addLog(`Mencoba memutuskan koneksi dari Voice Channel di server ${connectionState.guildId}...`, 'info');
    const connection = getVoiceConnection(connectionState.guildId);
    if (connection) {
      connection.destroy();
    }
    
    connectionState.isConnectedToVoice = false;
    connectionState.guildId = null;
    connectionState.channelId = null;
    connectionState.status = 'ready';
    
    addLog('Koneksi suara berhasil diputuskan secara bersih.', 'success');
    
    res.json({
      success: true,
      message: 'Berhasil memutuskan koneksi dari voice channel.',
      state: connectionState
    });
  } catch (error) {
    addLog(`Gagal memutuskan koneksi suara: ${error.message}`, 'error');
    res.status(500).json({ 
      success: false, 
      message: `Error diskoneksi: ${error.message}` 
    });
  }
});

// Clear console log endpoint (frontend capability)
app.post('/api/logs/clear', (req, res) => {
  connectionState.logs = [];
  addLog('Log konsol dibersihkan oleh web client.', 'info');
  res.json({ success: true });
});

// Start Express Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n==================================================`);
  console.log(`🤖 Discord 24/7 Voice Bot Server berjalan!`);
  console.log(`📡 URL API: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
