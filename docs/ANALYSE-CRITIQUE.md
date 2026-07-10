# Analyse critique — TCG Ynov (activité 10)

Retour critique sur le projet fil rouge en fin de module : points forts/faibles, dette à
refactoriser, apports du module, risques et feuille de route post-module. Une partie du plan
d'action a déjà été **mise en œuvre pendant le module** (preuves de consolidation, §5).

---

## 1. Points forts / points faibles

### Points forts

- **Moteur de jeu pur et déterministe** (`game.engine.js`) : aucune dépendance au transport
  (ni Express ni Socket.io), donc simple à raisonner, à tester et à faire rejouer (RNG seedé).
- **Serveur autoritaire** : le client n'envoie que des _intentions_, validées côté serveur →
  robustesse et prévention de la triche (défi identifié dans le document d'intention).
- **IA locale réellement opérationnelle** (Ollama) : décisions produites par un vrai LLM, validées
  contre les coups légaux, avec repli de sécurité — pas un mock.
- **Architecture en couches claire** (routes → controllers → services → Prisma) et **documentée**.
- **Flux temps réel fonctionnel** de bout en bout avec gestion d'états explicite côté front.

### Points faibles

- **Effets de cartes non implémentés** : la table `effects` existe mais sa logique n'est pas branchée.
- **PvP moins éprouvé** que le mode IA ; **pas de reconnexion** en cours de partie.
- **État des parties en mémoire** : perdu au redémarrage du serveur (seul le cycle de vie est persisté).
- **Couverture de tests limitée** au moteur (les services REST / le temps réel ne sont pas testés
  automatiquement — hors périmètre du module, mais dette réelle).
- **Front : composant `Board` volumineux** (plateau + interactions concentrés dans un seul fichier).
- **UX de la garde** peu intuitive au premier contact (à confirmer en playtest réel).

## 2. Parties à refactoriser

| Zone | Problème | Refactor proposé |
|---|---|---|
| `middleware/errorHandler.js` | Les erreurs 500 exposaient le message interne (ex. erreur Prisma) au client | ✅ **Fait** : message générique pour les 5xx, détail loggé côté serveur uniquement (§5) |
| `services/game.manager.js` | Fichier qui cumule état, persistance et pilotage IA | Extraire la persistance et le pilotage IA dans des modules dédiés |
| `services/ai.service.js` | Prompts codés en dur dans les fonctions | Externaliser les prompts ; envisager un cache / une file pour la latence LLM |
| `components/Board.jsx` | Composant monolithique | Découper en sous-composants (Zone, Hand, Field, Controls, CoinFlip) |

## 3. Apports du module pour le projet

Le projet a été le terrain d'application direct des concepts vus en séance :

- **Modélisation relationnelle** (MCD/MLD/MPD) → transposée fidèlement en schéma **Prisma**.
- **API REST avec Node/Express** → routes RESTful, verbes et codes HTTP corrects, gestion d'erreurs.
- **Sécurisation JWT** → auth, hachage bcrypt, vérification de token, **gestion des rôles**.
- **Interface réactive** (React) et **gestion d'état** → Context, hooks, états loading/success/error.
- **Coordination front/back** → séparation nette couche API / logique / UI, flux HTTP + WebSocket.
- **ORM** (Prisma) → migrations versionnées, cohérence modèle ↔ base.
- **IA locale (Ollama)** → intégration d'un LLM exécuté en local.
- **Optimisation / analyse** → instrumentation (métriques), campagne de simulation, ce rapport.

## 4. Feuille de route post-module

### Risques

| Risque | Type | Gravité | Mitigation |
|---|---|---|---|
| Dépendance à Ollama (latence / indisponibilité) | Technique | Moyenne | Repli heuristique en place ; documenter le prérequis |
| État en mémoire perdu au redémarrage | Technique | Faible | Acceptable en local ; persister l'état si besoin futur |
| PvP concurrentiel peu testé | Technique | Moyenne | Passe de tests manuels + gérer la reconnexion |
| Équilibrage du jeu | Fonctionnel | Faible | Validé par simulation (49 % 1er joueur) ; à confirmer en playtest humain |
| Compréhension UX (garde) | Fonctionnel | Moyenne | Mini-tutoriel / tooltip au premier blocage |

### Plan d'action priorisé

| Priorité | Action | Effort | Statut |
|---|---|---|---|
| **P1 (critique rendu)** | Dépôt public + README/docs à jour | — | ✅ / à vérifier côté GitHub |
| **P1 (sécurité)** | Assainir les messages d'erreur 5xx | ½ j | ✅ **fait** (§5) |
| **P2** | Découper `Board.jsx` en sous-composants | 1 j | à faire |
| **P2** | Séparer persistance / IA hors de `game.manager.js` | 1 j | à faire |
| **P2** | Implémenter les effets de cartes (table `effects`) | 2 j | backlog |
| **P3** | Reconnexion en cours de partie + persistance d'état | 2 j | backlog |
| **P3** | Classement / ELO, spectateur | 3 j | backlog |

## 5. Consolidations déjà réalisées (preuves)

Corrections et améliorations menées pendant le module, traçables dans l'historique Git :

- **Sécurité** : assainissement des messages d'erreur 5xx (message générique client + log serveur).
- **Sécurité** : gestion des rôles `user`/`admin` (JWT + middleware `requireRole` + route protégée).
- **Fiabilité IA** : correction de la connexion Ollama (IPv4) qui faisait tomber l'IA sur son repli.
- **Robustesse** : verrou par partie sérialisant action humaine + tour IA asynchrone (anti-concurrence).
- **Équilibrage** : puissances standardisées par grade ; règles de premier tour + pile ou face,
  validées par 500 parties simulées (49 % de victoires pour le premier joueur).
- **Qualité** : tests Vitest du moteur + CI (hors périmètre module mais gage de rigueur).

> **Git propre pour analyse extérieure** : commits conventionnels (`feat`/`fix`/`docs`/`test`),
> historique linéaire sur `main`, tag `v0.1.0`, `.gitignore`/`.gitattributes`, aucun secret versionné.
