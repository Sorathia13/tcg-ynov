# Architecture technique — TCG Ynov

## 1. Vue d'ensemble

Application **client-serveur** classique, enrichie d'une couche temps réel pour les parties et
d'une **IA adversaire pilotée par un LLM local (Ollama)**.

```
┌────────────┐    HTTP REST (JWT)    ┌──────────────────────────────────────────┐
│            │ ───────────────────► │                API Express                │
│   Client   │                       │  routes → controllers → services → Prisma │──► PostgreSQL
│   React    │ ◄─────────────────── │                                            │
│  (Vite)    │       JSON            └──────────────────────────────────────────┘
│            │
│            │    WebSocket (Socket.io)   ┌──────────────────────────────────────┐
│            │ ◄────────────────────────► │  Game socket → GameManager           │
└────────────┘                            │      └► GameEngine (règles)           │
                                          │      └► AIService ──► Ollama (LLM)     │
                                          └──────────────────────────────────────┘
```

- **HTTP** pour les opérations « froides » (auth, cartes, decks, historique).
- **WebSocket** pour les interactions « chaudes » (déroulé d'une partie, synchronisation des tours).

Ce découpage suit le dossier d'intention (activité 1) et le MCD/MLD (activité 2).

## 2. Découpage en couches (back-end)

On applique une séparation stricte des responsabilités (attendu « Architecture & dette technique »
de la grille) :

```
src/
├── index.js              # point d'entrée : monte HTTP + Socket.io
├── app.js                # configuration Express (middlewares, routes, erreurs)
├── config/prisma.js      # client Prisma singleton
├── middleware/
│   ├── auth.js           # vérification du JWT (Bearer token)
│   └── errorHandler.js   # gestion centralisée des erreurs (404 / 500)
├── routes/               # définition des endpoints REST
├── controllers/          # validation d'entrée + réponse HTTP
├── services/             # logique métier (réutilisable, testable)
│   ├── auth.service.js
│   ├── deck.service.js
│   ├── game.engine.js    # RÈGLES du jeu — fonctions pures, déterministes
│   ├── game.manager.js   # état des parties en cours (en mémoire)
│   ├── ai.service.js     # décisions de l'IA via Ollama (+ repli)
│   └── matchmaking.js    # file d'attente PvP
└── socket/game.socket.js # passerelle temps réel <-> GameManager
```

**Règle de dépendance** : `routes → controllers → services → prisma`. Un controller ne parle jamais
directement à Prisma sans passer par un service (hors CRUD trivial), et le `game.engine` ne connaît
ni Express ni Socket.io — ce sont des **fonctions pures** sur un objet d'état, donc unit-testables.

## 3. Modèle de données (MLD → Prisma)

Le schéma Prisma (`prisma/schema.prisma`) transpose fidèlement le MLD de l'activité 2 :

| Table MLD | Modèle Prisma | Rôle |
|---|---|---|
| `users` | `User` | comptes joueurs (email unique, mot de passe hashé) |
| `cards` | `Card` | catalogue de cartes (name, type, grade, power, critical, description) |
| `effects` | `Effect` | effets rattachés à une carte (extension future) |
| `decks` | `Deck` | decks d'un joueur |
| `deck_cards` | `DeckCard` | table d'association deck ↔ carte (+ quantité) |
| `games` | `Game` | parties (date, statut) |
| `participations` | `Participation` | participation d'un joueur à une partie (role, life_points) |
| `turns` | `Turn` | tours joués (journalisés pour rejouabilité) |

> Différence assumée avec le MPD : le MPD était écrit en syntaxe MySQL (`AUTO_INCREMENT`). On cible
> **PostgreSQL** comme annoncé dans le dossier d'intention ; Prisma génère les `SERIAL`/séquences
> équivalents. La structure logique (clés, relations, cardinalités) est identique.

## 4. Authentification (activité 5)

1. `POST /api/auth/register` : hash bcrypt du mot de passe, création de l'utilisateur.
2. `POST /api/auth/login` : vérification, émission d'un **JWT** signé (`JWT_SECRET`, expiration `JWT_EXPIRES_IN`).
3. Le front stocke le token (localStorage) et l'envoie en `Authorization: Bearer <token>`.
4. Le middleware `auth.js` protège les routes sensibles (decks, games) et injecte `req.user`.
5. Expiration gérée côté front (déconnexion automatique sur 401).

Le WebSocket est authentifié à la connexion via le même JWT (handshake `auth.token`).

## 5. Boucle de jeu (TCG lite)

### État d'une partie (`GameState`)

```js
{
  id, status: 'playing' | 'finished',
  turn: 1,                 // numéro de tour global
  activePlayer: 'A' | 'B',
  players: {
    A: { userId, name, isAI, life: 15, deck: [Card], hand: [Card], field: [Card] },
    B: { ... }
  },
  log: [ { turn, type, message } ],  // journal des actions
  winner: null | 'A' | 'B'
}
```

### Déroulé d'un tour

```
DÉBUT DE TOUR (joueur actif)
 1. Piocher 1 carte (si deck vide → pas de pioche)
 2. Phase de déploiement :
      pour chaque unité posée : grade(unité) <= numéro_de_tour ET champ non plein (max 3)
 3. Phase d'attaque :
      pour chaque unité du champ :
        - l'attaquant déclare une attaque sur le joueur adverse
        - le défenseur choisit de GARDER : défausse des cartes,
          bouclier = somme des power des cartes défaussées
        - si power(attaquant) > bouclier  → cible perd critical(attaquant) PV
          sinon                            → attaque bloquée
        - si vie(cible) <= 0 → fin de partie
 4. Fin de tour → l'autre joueur devient actif, turn++
```

Toutes ces transitions vivent dans `game.engine.js` sous forme de **fonctions pures**
(`draw`, `deploy`, `resolveAttack`, `endTurn`…) qui prennent un `state` et renvoient un nouvel état.
`game.manager.js` orchestre ces fonctions, stocke les parties en cours (Map en mémoire) et persiste
les tours en BDD.

## 6. IA adversaire (Ollama)

`ai.service.js` expose deux décisions :

- `decideTurn(state, side)` → quelles unités déployer + quelles attaques déclarer.
- `decideGuard(state, side, attack)` → garder ou non, et avec quelles cartes.

Séquence :

```
état de partie ──► sérialisation compacte JSON ──► prompt système + requête ──► Ollama (/api/chat)
                                                                                     │
                              ┌──────────────────────────────────────────────────────┘
                              ▼
                   réponse JSON du LLM ──► validation stricte (cartes possédées ? action légale ?)
                              │
                   valide ───►  appliquée telle quelle
                   invalide ─►  repli heuristique (filet de sécurité, ne bloque jamais la partie)
```

Le prompt impose un **format de sortie JSON strict** et ne fournit au LLM que des **identifiants
de cartes** présents dans sa main / son champ, ce qui borne l'espace des actions et facilite la
validation. La configuration (`OLLAMA_URL`, `OLLAMA_MODEL`) est dans `.env`.

## 7. Temps réel (Socket.io)

- Chaque partie est une **room** Socket.io (`game:<id>`).
- Le serveur est **autoritaire** : le client n'envoie que des _intentions_ (`game:action`), le
  serveur valide via le `game.engine`, met à jour l'état puis diffuse `game:state` à la room.
  Cela prévient la triche (défi « Sécurité » du dossier d'intention).
- Contre l'IA : après l'action du joueur, le serveur fait jouer l'IA côté serveur et rediffuse.
- Matchmaking PvP : `queue:join` place le joueur dans une file ; à deux joueurs, une partie est
  créée et les deux sockets rejoignent la room.

## 8. Gestion d'état côté front (activité 6)

- **AuthContext** : session utilisateur (token, user), persistée en localStorage.
- **API layer** (`src/api/`) : un client `fetch` centralisé (injection du token, gestion 401)
  + un module par ressource → séparation service / appel réseau (attendu activité 6).
- **useSocket** : hook qui gère la connexion Socket.io et l'état de la partie
  (`loading` / `playing` / `error` / `finished`).
- Chaque écran gère explicitement les états **loading / success / error**.

## 9. Conventions de code

- JavaScript (ESM) côté serveur et client.
- Nommage : `camelCase` (variables/fonctions), `PascalCase` (composants React, modèles Prisma).
- Un module = une responsabilité. Services sans dépendance au transport (HTTP/WS).
- Erreurs remontées via `next(err)` → `errorHandler` (jamais de `res` dans un service).
- Commits conventionnels recommandés (`feat:`, `fix:`, `docs:`…), branches par fonctionnalité.
