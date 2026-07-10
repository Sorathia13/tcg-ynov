# TCG Ynov — Trading Card Game en ligne

Jeu de cartes multijoueur au tour par tour, inspiré des mécaniques de _Cardfight!! Vanguard_
(grade / power / critical / garde), avec un **adversaire IA piloté par un LLM local (Ollama)**.

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Installation & lancement](#installation--lancement)
- [L'IA (Ollama)](#lia-ollama)
- [Règles du jeu (TCG lite)](#règles-du-jeu-tcg-lite)
- [API REST](#api-rest)
- [Temps réel (WebSocket)](#temps-réel-websocket)
- [Scripts utiles](#scripts-utiles)
- [Pistes d'évolution](#pistes-dévolution)

---

## Fonctionnalités

| Fonctionnalité (dossier d'intention) | État |
|---|---|
| Authentification utilisateur (JWT) + gestion des rôles (`user`/`admin`) | ✅ |
| Consultation des cartes | ✅ |
| Création et gestion de decks | ✅ |
| Matchmaking | ✅ (file d'attente PvP + partie vs IA immédiate) |
| Parties en temps réel (WebSocket) | ✅ |
| Gestion des tours | ✅ |
| **IA adversaire pilotée par LLM (Ollama)** | ✅ |

## Stack technique

- **Front-End** : React 18 + Vite, React Router, Context API (gestion d'état), Socket.io-client
- **Back-End** : Node.js + Express
- **Base de données** : PostgreSQL
- **ORM** : Prisma
- **Temps réel** : Socket.io
- **IA** : Ollama (LLM local, ex. `llama3.2`) — l'adversaire est réellement piloté par le LLM
- **Auth** : JWT + bcrypt

## Architecture

```
Client React ──HTTP REST──> API Express ──> Auth / Card / Deck / Game services ──> PostgreSQL (Prisma)
     │                                                    │
     └──────────WebSocket (Socket.io)──> Game socket ──> Game engine (règles TCG lite)
                                                          └──> AI service ──> Ollama (LLM) / repli heuristique
```

L'architecture détaillée est décrite dans le dossier de projet (PDF des livrables d'activités).

```
tcg-ynov/
├── docker-compose.yml        # PostgreSQL
├── server/                   # API Express + Prisma + Socket.io + IA
│   ├── prisma/schema.prisma  # modèle de données (= MLD/MPD)
│   ├── prisma/seed.js        # données mocks (cartes, users, decks)
│   └── src/
│       ├── routes/ controllers/ services/  # couches REST
│       ├── services/game.engine.js         # règles du jeu (déterministe)
│       ├── services/ai.service.js          # IA Ollama + repli
│       └── socket/game.socket.js           # temps réel
└── client/                   # front React (Vite)
    └── src/{api,context,hooks,pages,components}
```

## Documentation

La documentation rédigée du projet — **document de cadrage**, **MCD/MLD**, **architecture technique**,
**wireframes**, **priorisation MoSCoW**, **plan et résultats de playtest** et **analyse critique** —
constitue les livrables d'activités et est fournie sous forme d'un **dossier PDF** remis avec le projet.

Dans le dépôt : ce `README.md` (installation, usage, API) et le [CHANGELOG.md](CHANGELOG.md).

## Prérequis

- **Node.js ≥ 18** (testé sur 22) et npm
- **PostgreSQL** — le plus simple : Docker (`docker compose up -d`). Sinon un Postgres local.
- **Ollama** — **requis** : l'adversaire IA est piloté par un LLM local. Voir [plus bas](#lia-ollama).
  Un repli heuristique existe uniquement comme filet de sécurité anti-crash si le LLM devient
  momentanément injoignable en pleine partie ; ce n'est pas un mode de jeu à part entière.

## Installation & lancement

### 1. Base de données

```bash
docker compose up -d          # démarre PostgreSQL sur le port 5432
```

### 2. Back-end

```bash
cd server
cp .env.example .env          # ajuste si besoin (DATABASE_URL, JWT_SECRET, OLLAMA_*)
npm install
npm run db:migrate            # crée les tables (Prisma)
npm run db:seed               # insère les données mocks (cartes, 2 users, decks)
npm run dev                   # API sur http://localhost:4000
```

Comptes de test créés par le seed :

| Email | Mot de passe | Rôle |
|---|---|---|
| `alice@tcg.dev` | `password123` | `admin` |
| `bob@tcg.dev` | `password123` | `user` |

### 3. Front-end

```bash
cd client
npm install
npm run dev                   # front sur http://localhost:5173
```

Ouvre <http://localhost:5173>, connecte-toi, construis un deck, puis lance **« Jouer contre l'IA »**.

## L'IA (Ollama)

L'adversaire IA envoie l'état de la partie à un LLM local via Ollama et lui demande sa décision
(cartes à jouer, attaques, garde) au format JSON. **Ollama est requis** pour faire tourner l'IA.
Un moteur heuristique interne sert uniquement de filet de sécurité si le LLM renvoie une réponse
invalide ou devient momentanément injoignable en cours de partie, afin de ne jamais bloquer une
partie déjà lancée.

Installer et préparer Ollama :

```bash
# 1. Installer : https://ollama.com/download
# 2. Récupérer un modèle léger
ollama pull llama3.2
# 3. Ollama expose son API sur http://localhost:11434 (par défaut)
```

Configuration côté serveur (`server/.env`) :

```
OLLAMA_URL=http://127.0.0.1:11434   # 127.0.0.1, pas "localhost" (cf. note ci-dessous)
OLLAMA_MODEL=llama3.2
```

> ⚠️ **Piège courant** : utilise bien `127.0.0.1` et non `localhost`. Le `fetch` de Node (undici)
> résout `localhost` en IPv6 (`::1`), alors qu'Ollama n'écoute qu'en IPv4 → l'IA tomberait
> silencieusement sur son repli heuristique (`fetch failed`) au lieu d'utiliser le LLM.

## Règles du jeu (TCG lite)

Version simplifiée et **déterministe** (idéale pour une démo fiable), fidèle à l'esprit Vanguard :

- Chaque joueur démarre avec **15 points de vie** et pioche **5 cartes**.
- Chaque carte a : `power` (attaque), `critical` (dégâts infligés), `grade` (palier de jeu).
- **À chaque tour** : pioche 1 carte → déploie des unités → attaque.
- **Déploiement** : on ne peut poser une unité de `grade` G que si `numéro du tour ≥ G + 1`
  (progression des grades, comme le _ride_ de Vanguard). Champ limité à 3 unités.
- **Attaque** : chaque unité attaque le joueur adverse. Le défenseur peut **garder** en
  défaussant des cartes de sa main dont la somme des `power` forme un bouclier.
  - Si `power attaquant > bouclier` → l'attaque passe : la cible perd `critical` PV.
  - Sinon → attaque bloquée.
- Le premier joueur à **0 PV** perd.

Détails et pseudo-code : voir le dossier de projet (PDF).

## API REST

Base : `http://localhost:4000/api`

| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Créer un compte |
| POST | `/auth/login` | — | Connexion, renvoie un JWT |
| GET | `/auth/me` | ✅ | Profil courant |
| GET | `/cards` | — | Liste des cartes (pagination `?page&limit`) |
| GET | `/cards/:id` | — | Détail d'une carte (+ effets) |
| POST | `/cards` | ✅ **admin** | Créer une carte (réservé au rôle `admin`) |
| GET | `/decks` | ✅ | Mes decks |
| POST | `/decks` | ✅ | Créer un deck |
| GET | `/decks/:id` | ✅ | Détail d'un deck |
| PUT | `/decks/:id` | ✅ | Modifier un deck (nom + cartes) |
| DELETE | `/decks/:id` | ✅ | Supprimer un deck |
| GET | `/games` | ✅ | Mon historique de parties |
| GET | `/games/:id` | ✅ | Détail d'une partie |

Fichiers de test HTTP prêts à l'emploi : [server/requests.http](server/requests.http).

## Temps réel (WebSocket)

Namespace Socket.io par défaut. Événements principaux :

- `game:vsAI` → démarre une partie contre l'IA
- `queue:join` / `queue:leave` → matchmaking PvP
- `game:action` → jouer une action (`deploy`, `attack`, `guard`, `endTurn`)
- `game:state` (serveur → client) → état à jour de la partie
- `game:over` → fin de partie

## Tests & CI

- **Tests unitaires** du moteur de jeu (règles déterministes) avec **Vitest** :
  `cd server && npm test` (12 tests couvrant pile ou face, progression de grade,
  déploiement/remplacement, combat, conditions de victoire, masquage de la main adverse).
- **Intégration continue** GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) :
  à chaque push / PR sur `main`, exécution des tests back-end + vérification du build front-end.

## Scripts utiles

```bash
# server/
npm run dev          # API en watch
npm run start        # API en production
npm run db:migrate   # migrations Prisma
npm run db:seed      # données mocks
npm run db:studio    # Prisma Studio (exploration BDD)
npm test             # tests du moteur de jeu (Vitest)
npm run test:watch   # tests en mode watch

# client/
npm run dev          # front en watch
npm run build        # build de prod
```

## Limites connues & analyse critique

Recul honnête sur l'état du projet :

- **Périmètre de règles volontairement réduit** : c'est un TCG « lite ». Les mécaniques avancées de
  Vanguard (rear-guards, drive/trigger checks, soul) et le combat unité-contre-unité ne sont pas
  implémentés — choix assumé pour privilégier la stabilité et la démontrabilité.
- **Effets de cartes non fonctionnels** : la table `effects` est modélisée mais sa logique n'est pas
  branchée sur le moteur (les effets sont purement descriptifs pour l'instant).
- **PvP moins éprouvé que le mode IA** : le matchmaking humain-vs-humain fonctionne mais a été moins
  testé ; pas de reconnexion en cours de partie (une déconnexion met fin à la partie côté adversaire).
- **État des parties en mémoire** : les parties en cours vivent dans le process serveur ; un
  redémarrage les perd (seul le cycle de vie est persisté en BDD). Suffisant pour une exécution locale.
- **IA dépendante d'Ollama** : nécessite Ollama lancé localement ; un repli heuristique évite le
  blocage mais l'IA est alors moins « intelligente ». La latence du LLM ajoute un léger délai par tour.
- **Rôles minimalistes** : deux rôles (`user`/`admin`) ; l'admin sert à démontrer la protection par
  rôle (création de carte). Pas d'interface d'administration dédiée côté front.

Ce qui a bien fonctionné : le **moteur pur et déterministe** (facile à tester et à faire rejouer), le
**serveur autoritaire** (robustesse anti-triche), et l'**intégration IA locale** réellement opérationnelle.

## Pistes d'évolution

Le cœur du jeu est volontairement extensible :

- **Effets de cartes** (table `effects` déjà modélisée) : triggers, buffs, soin…
- Système de **soul / trigger checks** fidèle à Vanguard
- Combat **unité contre unité** (rear-guards)
- IA plus fine (mémoire de partie, difficulté réglable, prompt few-shot)
- Classement / ELO, spectateur, rejouer une partie (les tours sont journalisés en BDD)
- Étendre la couverture de tests (services REST, intégration Socket.io)
