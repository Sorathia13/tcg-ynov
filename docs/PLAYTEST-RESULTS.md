# Résultats de playtest — TCG Ynov

Ce document rassemble les résultats du playtest. Il comporte deux parties :
1. **Playtest technique automatisé** — données **réelles**, reproductibles.
2. **Playtest humain** — grille et retours ; la section ci-dessous est un **exemple illustratif
   (données fictives)** à **remplacer par les observations réelles** lors du playtest de la séance 10.

---

## 1. Playtest technique automatisé (données réelles)

Campagne Monte-Carlo au niveau du moteur de jeu : 500 parties complètes jouées par une politique
déterministe des deux côtés, pour mesurer stabilité, durée et équilibrage.

**Reproductible** : `cd server && npm run simulate` (ou `npm run simulate 1000`).

### Résultats (500 parties)

| Métrique | Résultat | Cible (PLAYTEST.md) | Verdict |
|---|---|---|---|
| Parties terminées sans exception | **500 / 500 (100 %)** | ≥ 90 % | ✅ |
| Exceptions moteur | **0** | 0 | ✅ |
| Tours par partie (moyenne) | **9,8** | 6–16 | ✅ |
| Tours (médiane / min / max) | 10 / 7 / 12 | — | ✅ rythme régulier |
| **Victoires du joueur qui commence** | **49 %** | ~50 % (équilibré) | ✅ |
| Marge de vie moyenne en fin de partie | 2,6 PV | — | parties décisives mais serrées |

> _Tours = nombre de demi-tours alternés (un tour de A puis un tour de B = 2)._

### Interprétation

- **Stabilité** : 0 exception sur 500 parties → le moteur est robuste (aucun état illégal atteint).
- **Rythme** : ~10 demi-tours (≈ 5 tours par joueur) → parties courtes, adaptées à une démo/playtest.
- **Équilibrage de l'initiative** : **49 %** de victoires pour le premier joueur → les règles de
  compensation (pas d'attaque au 1er tour pour celui qui commence + pioche bonus pour le second)
  neutralisent quasi parfaitement l'avantage d'initiative. Objectif d'équilibrage atteint.

### Intégration IA (validée end-to-end, à part)

L'IA n'est pas sollicitée dans la campagne ci-dessus (politique fixe, pour le volume/la vitesse).
Son intégration a été validée séparément par un test end-to-end réel (client → serveur → Ollama) :
partie complète jouée par le LLM `llama3.2`, **0 recours au repli heuristique** (`aiOllamaRate` = 100 %),
0 crash. La métrique `[METRICS]` loggée en fin de partie live confirme durée et taux Ollama.

---

## 2. Playtest humain — ⚠️ EXEMPLE ILLUSTRATIF (données fictives)

> **Cette section est un modèle à remplacer par les observations réelles au playtest S10.**
> Les personas et notes ci-dessous sont fictifs et servent uniquement à illustrer le format attendu.

### Profil des testeurs (exemple)

| Testeur | Profil | Familier des TCG ? |
|---|---|---|
| T1 | Étudiant, joueur occasionnel | Non |
| T2 | Joueur de Hearthstone | Oui |
| T3 | Non-joueur | Non |

### Grille d'observation remplie (exemple)

| Critère (1–5) | T1 | T2 | T3 | Moyenne |
|---|---|---|---|---|
| Inscription / connexion fluide | 5 | 5 | 4 | 4,7 |
| Création de deck compréhensible | 4 | 5 | 3 | 4,0 |
| Lancement d'une partie évident | 5 | 5 | 4 | 4,7 |
| Règles de tour comprises (grade, 1er tour) | 3 | 4 | 3 | 3,3 |
| Mécanique de garde comprise | 3 | 4 | 2 | 3,0 |
| Remplacement d'unité (champ plein) compris | 3 | 4 | 3 | 3,3 |
| Réactivité de l'IA | 4 | 4 | 4 | 4,0 |
| Lisibilité du plateau | 4 | 5 | 4 | 4,3 |
| Messages d'erreur clairs | 4 | 4 | 4 | 4,0 |
| Aucun crash (O/N) | O | O | O | 100 % |
| Plaisir de jeu global | 4 | 5 | 3 | 4,0 |

### Verbatims (exemple)

- T3 : « Je n'ai pas compris tout de suite qu'il fallait défausser des cartes pour se défendre. »
- T1 : « La progression de grade n'est pas évidente au premier tour, j'ai cliqué une carte grisée. »
- T2 : « Fluide et rapide, la garde est maligne. L'IA joue bien. »

### Frictions récurrentes → backlog (exemple)

| Friction | Sévérité | Action proposée (MoSCoW) |
|---|---|---|
| Mécanique de garde peu intuitive au 1er contact | Moyenne | [SHOULD] tooltip / mini-tutoriel au 1er blocage |
| Grade jouable pas assez visible | Faible | [SHOULD] renforcer l'indicateur de palier (déjà présent) |
| Remplacement d'unité à découvrir | Faible | [COULD] court hint la 1re fois que le champ est plein |

> À remplacer par les vraies données : durées/tours issus des logs `[METRICS]`, notes réelles des
> testeurs, et frictions effectivement observées.
