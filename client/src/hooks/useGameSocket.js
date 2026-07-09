// Hook de gestion de la connexion temps réel + de l'état d'une partie.
// Expose des états explicites (loading / waiting / playing / finished / error)
// conformément à l'attendu de gestion d'états (activité 6).
import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../api/client.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

export function useGameSocket() {
  const socketRef = useRef(null);
  const [phase, setPhase] = useState('idle'); // idle | connecting | waiting | playing | finished | error
  const [view, setView] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null); // messages transitoires (file d'attente, etc.)
  const [result, setResult] = useState(null);

  // Établit la connexion (une seule fois).
  const ensureSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;
    const socket = io(SOCKET_URL, {
      auth: { token: getToken() },
      autoConnect: true,
    });

    socket.on('connect_error', (e) => {
      setError(e.message || 'Connexion temps réel impossible');
      setPhase('error');
    });
    socket.on('game:started', ({ gameId }) => {
      setGameId(gameId);
      setResult(null);
      setPhase('playing');
      setInfo(null);
    });
    socket.on('game:state', (v) => {
      setView(v);
      if (v.status === 'finished') setPhase('finished');
      else setPhase('playing');
    });
    socket.on('game:over', (r) => {
      setResult(r);
      setPhase('finished');
    });
    socket.on('queue:waiting', ({ position }) => {
      setPhase('waiting');
      setInfo(`En file d'attente (position ${position})…`);
    });
    socket.on('queue:left', () => {
      setPhase('idle');
      setInfo(null);
    });
    socket.on('game:opponentLeft', () => {
      setInfo('Votre adversaire a quitté la partie.');
    });
    socket.on('game:error', ({ message }) => {
      setError(message);
      // Une erreur "récupérable" (coup illégal) ne casse pas la partie.
      setTimeout(() => setError(null), 4000);
    });

    socketRef.current = socket;
    return socket;
  }, []);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const startVsAI = useCallback((deckId) => {
    setError(null);
    setPhase('connecting');
    ensureSocket().emit('game:vsAI', { deckId });
  }, [ensureSocket]);

  const joinQueue = useCallback((deckId) => {
    setError(null);
    setPhase('connecting');
    ensureSocket().emit('queue:join', { deckId });
  }, [ensureSocket]);

  const leaveQueue = useCallback(() => {
    socketRef.current?.emit('queue:leave');
  }, []);

  const sendAction = useCallback((action) => {
    if (!socketRef.current || gameId == null) return;
    socketRef.current.emit('game:action', { gameId, action });
  }, [gameId]);

  // Raccourcis d'action de jeu.
  const actions = {
    deploy: (iids) => sendAction({ type: 'deploy', iids }),
    attack: (attackerIid) => sendAction({ type: 'attack', attackerIid }),
    guard: (guardIids) => sendAction({ type: 'guard', guardIids }),
    endTurn: () => sendAction({ type: 'endTurn' }),
  };

  const reset = useCallback(() => {
    setPhase('idle');
    setView(null);
    setGameId(null);
    setResult(null);
    setError(null);
    setInfo(null);
  }, []);

  return { phase, view, gameId, error, info, result, startVsAI, joinQueue, leaveQueue, actions, reset };
}
