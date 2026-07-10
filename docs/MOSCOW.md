# Priorisation MoSCoW & état des lieux — TCG Ynov

_Dernière mise à jour : itération courante, avant le playtest (séance 10)._

Ce document sert d'inventaire des fonctionnalités, de priorisation argumentée (méthode MoSCoW)
et de plan réaliste jusqu'au playtest. Il alimente le board GitHub Projects (cf. dernière section).

---

## 1. État des lieux (inventaire)

Légende : ✅ livré & vérifié · 🟡 partiel · ⛔ non commencé

### Fonctionnalités du dossier d'intention

| Fonctionnalité | État | Note |
|---|---|---|
| Authentification (JWT + bcrypt) | ✅ | register/login/me, middleware, expiration → déconnexion auto |
| Consultation des cartes | ✅ | catalogue paginé, recherche, filtre par grade |
| Création & gestion de decks | ✅ | CRUD complet, règles (16–50 cartes, max 4 exemplaires) |
| Matchmaking | ✅ | file d'attente PvP + partie vs IA immédiate |
| Parties en temps réel (WebSocket) | ✅ | serveur autoritaire, synchro par room |
| Gestion des tours | ✅ | pioche/déploiement/attaque, pile ou face, règles de 1er tour |
| IA adversaire (LLM Ollama) | ✅ | décisions de tour et de garde via `llama3.2`, filet heuristique |

### Qualité / process

| Élément | État | Note |
|---|---|---|
| BDD PostgreSQL + Prisma (migration + seed) | ✅ | migration versionnée, données mocks |
| Documentation (README + archi) | ✅ | installation, API, WebSocket, règles |
| Gestion d'état front (Context, hooks, loading/error) | ✅ | conforme activité 6 |
| Tests automatisés + CI | ✅ | 12 tests Vitest sur le moteur, CI GitHub Actions |
| Repo (commits conventionnels, conventions de branches) | 🟡 | repo OK ; board + issues/PR à formaliser |
| Effets de cartes (table `effects`) | 🟡 | modélisés en BDD, logique non implémentée (choix assumé) |
| PvP humain vs humain | 🟡 | implémenté, moins éprouvé que le mode IA |
| Reconnexion en cours de partie | ⛔ | déconnexion = fin de partie côté adversaire |
| Support de démo / playtest | 🟡 | en cours (docs PLAYTEST.md / DEMO.md) |

---

## 2. Priorisation MoSCoW (itération avant playtest S10)

### 🔴 MUST — indispensable pour un playtest crédible (tous livrés)

| # | Élément | Justification | Dépendances |
|---|---|---|---|
| M1 | Boucle de jeu complète (tours, attaque, garde, victoire) | Cœur du produit ; sans elle, rien à tester | BDD, moteur |
| M2 | Partie jouable vs IA de bout en bout | Garantit une démo/playtest possible **seul**, sans 2e joueur | M1, Ollama |
| M3 | Auth + gestion de decks | Prérequis pour lancer une partie avec un deck | BDD |
| M4 | Stabilité (zéro crash) + tests du moteur | Critère de playtest « zéro crash » ; le moteur est la zone à risque | M1 |
| M5 | UI utilisable (flux clairs, feedbacks, états) | Sans elle le playtest est inexploitable | M1 |

> **Statut : 100 % des MUST livrés et vérifiés.**

### 🟠 SHOULD — important, à faire si le temps le permet avant S10

| # | Élément | Justification | Dépendances |
|---|---|---|---|
| S1 | Instrumentation (logs/compteurs) pour le playtest | Mesurer durée de partie, tours, taux d'erreur | M1 |
| S2 | Robustesse PvP (tests manuels, gestion des cas limites) | Le mode PvP est moins éprouvé que l'IA | M1 |
| S3 | Écran de fin plus riche (récap partie) | Améliore l'expérience de playtest | M5 |
| S4 | Gestion de la reconnexion / abandon adverse propre | Évite les parties « fantômes » | temps réel |

### 🟡 COULD — bonus si tout le reste est bouclé

| # | Élément | Justification |
|---|---|---|
| C1 | Effets de cartes (triggers/soin) via table `effects` | Profondeur de jeu ; déjà modélisé en BDD |
| C2 | Génération de cartes par LLM (Ollama) | Vitrine IA supplémentaire |
| C3 | Classement / ELO, historique détaillé rejouable | Rétention ; les tours sont déjà journalisés |
| C4 | Sons / animations supplémentaires | Finition |

### ⚪ WON'T — hors périmètre de cette itération (assumé)

| # | Élément | Pourquoi pas maintenant |
|---|---|---|
| W1 | Règles Vanguard complètes (rear-guards, drive/trigger checks, soul) | Complexité élevée, risque pour la stabilité ; le TCG *lite* est un choix délibéré |
| W2 | Combat unité contre unité | Dépend de W1 ; prévu comme évolution |
| W3 | Application mobile native | Le web responsive suffit au périmètre |
| W4 | Multijoueur > 2 joueurs | Non prévu par le concept |

---

## 3. Dépendances clés

```
BDD (Prisma) ──> Auth ──┐
                        ├──> Decks ──┐
Moteur de jeu ──────────┘            ├──> Partie temps réel ──> IA (Ollama)
                                     │
                     Instrumentation (S1) ──> Playtest (S10)
```

- Le **moteur** ne dépend de rien (fonctions pures) → testable et stable en premier. ✅
- L'**IA** dépend d'Ollama (dépendance externe) → filet heuristique pour ne jamais bloquer. ✅
- Le **playtest** dépend de l'instrumentation (S1) pour produire des métriques exploitables.

---

## 4. Plan réaliste avant le playtest (S10)

| Priorité | Tâche | Estimation | Statut |
|---|---|---|---|
| 1 | Finaliser tests + CI | ½ j | ✅ fait |
| 2 | Instrumentation playtest (S1) : logs durée/tours + compteurs | ½ j | ✅ fait |
| 3 | Plan de playtest + grille d'observation (docs/PLAYTEST.md) | ½ j | ✅ fait |
| 4 | Passe de robustesse PvP (S2) + écran de fin (S3) | 1 j | à faire |

**Hypothèse** : les MUST étant tous livrés, l'itération avant S10 se concentre sur la
**préparation du playtest** (mesure, robustesse), pas sur de nouvelles
fonctionnalités de jeu — cohérent avec l'objectif « projet stable et démontrable ».

> Le suivi opérationnel de ces tâches est tenu sur le board **GitHub Projects** du dépôt.
