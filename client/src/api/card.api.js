import { apiFetch } from './client.js';

export const cardApi = {
  list: ({ page = 1, limit = 50, search = '', grade = '' } = {}) => {
    const params = new URLSearchParams({ page, limit });
    if (search) params.set('search', search);
    if (grade !== '') params.set('grade', grade);
    return apiFetch(`/cards?${params.toString()}`, { auth: false });
  },
  getById: (id) => apiFetch(`/cards/${id}`, { auth: false }),
};
