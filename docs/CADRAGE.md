# Document de cadrage — TCG Ynov

_Projet fil rouge — M2 Dev fullstack, Coordination dev Front & Back (Ynov Connect)._
_Ce document reprend et précise le document d'intention (activité 1) en l'alignant sur le
périmètre réellement livré, et spécifie la fonctionnalité d'IA (activité 4)._

---

## 1. Objectif du projet

Développer un **jeu de cartes en ligne** (Trading Card Game) fullstack Web, mettant en œuvre une
communication front/back en HTTP **et** en temps réel. Le joueur crée des decks, consulte les cartes
et affronte un **adversaire piloté par une IA**, dans des parties stratégiques au tour par tour.

Le jeu s'inspire des mécaniques de _Cardfight!! Vanguard_ dans une version **« lite »** : un cœur de
règles déterministe (grade / puissance / critique / garde), volontairement simplifié pour garantir la
stabilité et la démontrabilité, tout en laissant une marge d'évolution claire.

## 2. Périmètre fonctionnel

### Livré (périmètre de cette version — v0.1.0)

- **Authentification** : inscription, connexion (JWT), profil, **gestion des rôles** (`user` / `admin`).
- **Consultation des cartes** : catalogue paginé, recherche, filtre par grade.
- **Gestion de decks** : création, édition, suppression, avec règles de construction (16–50 cartes, max 4 exemplaires).
- **Matchmaking** : file d'attente PvP + partie contre l'IA immédiate.
- **Parties en temps réel** (WebSocket) : serveur autoritaire, synchronisation des actions.
- **Gestion des tours** : pioche, déploiement, attaque, garde, pile ou face, règles de premier tour.
- **IA adversaire** pilotée par un LLM local (voir §5).

### Hors périmètre (assumé, évolutions futures)

- Règles complètes de Vanguard (rear-guards, drive/trigger checks, soul).
- Combat unité contre unité (les attaques visent le joueur).
- Effets de cartes (table `effects` modélisée mais logique non implémentée).
- Déploiement en production (exécution locale, conforme au cadrage du module).

## 3. Architecture

Architecture **client-serveur** :

```
Client React ──HTTP REST (JWT)──> API Express ──> services ──> PostgreSQL (Prisma)
     │                                              │
     └──────WebSocket (Socket.io)──> game socket ──> moteur de règles (pur, testé)
                                                    └──> service IA ──> Ollama (LLM local)
```

- **HTTP** pour les opérations « froides » (auth, cartes, decks, historique).
- **WebSocket** pour le déroulé « chaud » d'une partie (synchro des tours).

Détails complets : [ARCHITECTURE.md](ARCHITECTURE.md).

## 4. Stack technique & justification

| Couche | Choix | Justification |
|---|---|---|
| Front-End | **React 18 + Vite** | Interface dynamique, composants réutilisables, HMR rapide |
| Back-End | **Node.js + Express** | Adapté aux API REST et au temps réel, écosystème riche |
| Base de données | **PostgreSQL** | Relations complexes (joueurs/decks/cartes/parties) |
| ORM | **Prisma** | Accès aux données typé, migrations versionnées |
| Temps réel | **Socket.io** | Gestion simplifiée des rooms et de la reconnexion |
| Authentification | **JWT + bcrypt** | Standard, sans état côté serveur |
| **IA** | **Ollama (LLM local)** | IA réelle, 100 % locale, sans clé API ni coût, fiable en démo |

## 5. Fonctionnalité IA (spécification)

**Objectif** : l'adversaire n'est pas scripté — ses décisions sont produites par un **grand modèle de
langage exécuté localement via Ollama** (modèle `llama3.2`).

**Fonctionnement** :
1. À chaque décision (jouer son tour / se défendre), l'état de la partie est sérialisé en JSON
   compact, ne contenant que les **coups légaux** (identifiants de cartes en main / sur le terrain).
2. Ce contexte est envoyé à Ollama (`/api/chat`, sortie **JSON forcée**) avec une consigne de rôle.
3. La réponse du LLM est **validée** contre les actions réellement autorisées par le moteur.
4. En cas de réponse invalide ou d'indisponibilité momentanée du modèle en pleine partie, un
   **repli heuristique** interne prend le relais pour ne jamais bloquer une partie en cours.

**Caractère réel (non-mock)** : l'IA appelle effectivement le LLM à chaque tour. Une campagne de test
end-to-end confirme un taux de décisions issues d'Ollama de **100 %** (0 recours au repli) sur une
partie complète. L'intégration est configurable via `OLLAMA_URL` / `OLLAMA_MODEL`.

## 6. Défis techniques anticipés & réponses apportées

| Défi (document d'intention) | Réponse apportée |
|---|---|
| Synchronisation temps réel entre joueurs | Serveur **autoritaire** + diffusion par room ; verrou par partie sérialisant les mutations |
| Gestion des règles du jeu | Moteur **pur et déterministe**, isolé du transport, couvert par des tests |
| Maintien de l'état des parties | État en mémoire côté serveur + persistance du cycle de vie (games/participations/turns) |
| Sécurité (auth, triche) | JWT + bcrypt, rôles, et **le client n'envoie que des intentions** (validées serveur) |
| Performance | Vues personnalisées (main adverse masquée), pagination des cartes |

## 7. Critères de réussite

- Une partie complète jouable **de bout en bout** contre l'IA, sans crash.
- Auth et routes sensibles sécurisées (JWT + rôles).
- IA réellement pilotée par le LLM, démontrable.
- Code structuré, documenté, exécutable en local en quelques commandes (cf. [README](../README.md)).
