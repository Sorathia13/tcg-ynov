import { apiFetch } from './client.js';

export const deckApi = {
  list: () => apiFetch('/decks'),
  getById: (id) => apiFetch(`/decks/${id}`),
  create: (payload) => apiFetch('/decks', { method: 'POST', body: payload }),
  update: (id, payload) => apiFetch(`/decks/${id}`, { method: 'PUT', body: payload }),
  remove: (id) => apiFetch(`/decks/${id}`, { method: 'DELETE' }),
};
