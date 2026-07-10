# Plan de playtest — TCG Ynov

Objectif : valider, en conditions réelles, que le jeu est **jouable, compréhensible et stable**
avant la présentation. Ce plan définit des scénarios, des objectifs **mesurables**, une grille
d'observation et les métriques collectées automatiquement.

---

## 1. Objectifs mesurables

| Objectif | Métrique | Cible |
|---|---|---|
| Stabilité | Nombre de crashs / erreurs bloquantes pendant les sessions | **0** |
| Complétude d'une partie | % de parties menées jusqu'à la fin (victoire/défaite) | **≥ 90 %** |
| Durée de partie | Durée moyenne (métrique `durationSec`) | **3 – 8 min** |
| Rythme | Nombre de tours par partie (métrique `turns`) | **6 – 16** |
| IA réellement pilotée par le LLM | `aiOllamaRate` (part de décisions venant d'Ollama) | **≥ 90 %** |
| Compréhension | % de joueurs jouant leur 1er tour sans aide | **≥ 70 %** |
| Clarté de la garde | % de joueurs comprenant le mécanisme de garde en < 2 attaques | **≥ 70 %** |

## 2. Instrumentation (déjà en place)

À chaque fin de partie, le serveur écrit une ligne exploitable dans ses logs :

```
[METRICS] {"gameId":42,"mode":"ai","turns":9,"durationSec":214,
           "winner":"Alice","lifeA":6,"lifeB":0,
           "aiDecisions":{"ollama":11,"heuristic":0},"aiOllamaRate":"100%"}
```

Champs : `mode` (ai/pvp), `turns`, `durationSec`, `winner`, `lifeA/lifeB`,
`aiDecisions` (compteur Ollama vs repli heuristique) et `aiOllamaRate`.

> Collecte : rediriger la sortie serveur vers un fichier (`npm run dev > playtest.log`) puis
> filtrer les lignes `[METRICS]` pour agréger durée/tours/taux Ollama.

## 3. Scénarios de test

### Scénario A — Première partie (nouvel utilisateur)
1. Créer un compte (register).
2. Consulter le catalogue de cartes.
3. Créer un deck valide (16–50 cartes).
4. Lancer une partie **contre l'IA**.
5. Jouer jusqu'à la fin (victoire ou défaite).

**On observe** : blocages, hésitations, incompréhensions à chaque étape.

### Scénario B — Boucle de jeu (déjà connecté)
1. Lancer une partie vs IA.
2. Déployer des unités en respectant la progression de grade.
3. Attaquer, **se défendre** (garde), remplacer une unité champ plein.
4. Terminer la partie.

**On observe** : compréhension grade/garde/remplacement, lisibilité de l'état, temps de réaction IA.

### Scénario C — Cas limites / robustesse
1. Tenter un coup illégal (déployer un grade trop élevé, attaquer au 1er tour).
2. **Abandonner** une partie en cours → retour au salon.
3. Rafraîchir / se déconnecter en pleine partie.
4. (PvP) Lancer une partie à deux joueurs via le matchmaking.

**On observe** : messages d'erreur clairs, pas de crash, état cohérent après reprise.

## 4. Grille d'observation (à remplir par testeur)

| Critère | Note (1–5) | Commentaire |
|---|---|---|
| Inscription / connexion fluide | | |
| Création de deck compréhensible | | |
| Lancement d'une partie évident | | |
| Règles de tour comprises (grade, 1er tour) | | |
| Mécanique de garde comprise | | |
| Remplacement d'unité (champ plein) compris | | |
| Réactivité / temps de réponse de l'IA | | |
| Lisibilité du plateau (PV, main, terrain, journal) | | |
| Messages d'erreur clairs | | |
| Aucun crash rencontré (O/N) | | |
| Plaisir de jeu global | | |

## 5. Protocole

- **Testeurs** : 3 à 5 personnes n'ayant pas participé au développement.
- **Format** : think-aloud (le testeur verbalise ce qu'il fait/comprend), sans aide sauf blocage.
- **Durée** : ~15 min par testeur (1–2 parties).
- **Matériel** : PostgreSQL + Ollama (`llama3.2`) lancés, back + front démarrés.
- **Recueil** : grille d'observation par testeur + export des lignes `[METRICS]`.

## 6. Dépouillement & suite

1. Agréger les métriques (durée/tours/taux Ollama moyens) et comparer aux cibles §1.
2. Lister les frictions récurrentes (grille §4) → **backlog de corrections** priorisé (MoSCoW).
3. Corriger les points bloquants avant la démo ; documenter dans le CHANGELOG.
