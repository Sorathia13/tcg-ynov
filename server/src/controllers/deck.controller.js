// Controller decks (routes protégées par JWT).
import * as deckService from '../services/deck.service.js';

export async function list(req, res, next) {
  try {
    res.json(await deckService.listByUser(req.user.id));
  } catch (err) { next(err); }
}

export async function getById(req, res, next) {
  try {
    res.json(await deckService.getOwned(req.user.id, Number(req.params.id)));
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const deck = await deckService.create(req.user.id, req.body);
    res.status(201).json(deck);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    res.json(await deckService.update(req.user.id, Number(req.params.id), req.body));
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    await deckService.remove(req.user.id, Number(req.params.id));
    res.status(204).end();
  } catch (err) { next(err); }
}
