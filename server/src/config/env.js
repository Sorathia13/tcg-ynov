// Chargement centralisé de la configuration d'environnement.
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 4000,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '2h',
  },
  ollama: {
    // 127.0.0.1 et non "localhost" : le fetch de Node (undici) résout localhost en IPv6 (::1)
    // alors qu'Ollama n'écoute qu'en IPv4 (127.0.0.1) → "fetch failed" sinon.
    url: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.2',
    timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS) || 20000,
  },
};
