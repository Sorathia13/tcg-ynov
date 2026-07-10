# Wireframes — écrans clés (TCG Ynov)

Maquettes basse fidélité des écrans principaux. Elles décrivent la structure et les flux ;
le rendu réel (thème sombre, composants) est implémenté dans `client/src`.

Flux global : `Login → Salon → Partie` ; `Cartes` et `Decks` accessibles via la barre de navigation.

---

## 1. Connexion / Inscription

```
┌───────────────────────────────────────────────┐
│  🃏 TCG Ynov        Cartes                Connexion │  ← navbar
├───────────────────────────────────────────────┤
│                                                 │
│            ┌───────────────────────┐            │
│            │        Connexion       │            │
│            │  Email    [__________] │            │
│            │  Mot de passe [______] │            │
│            │  [ Se connecter ]      │            │
│            │  Pas de compte ? Créer │            │
│            └───────────────────────┘            │
└───────────────────────────────────────────────┘
États : idle · loading (bouton « Connexion… ») · error (message rouge)
```

## 2. Catalogue de cartes

```
┌───────────────────────────────────────────────┐
│  🃏 TCG Ynov   Cartes  Mes decks  Jouer   👤 Alice │
├───────────────────────────────────────────────┤
│  [ Rechercher…            ]  [ Grade ▼ ]         │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐            │
│  │Carte │ │Carte │ │Carte │ │Carte │  …          │
│  │G0 ⚔6k│ │G1 ⚔8k│ │G2    │ │G3    │            │
│  └──────┘ └──────┘ └──────┘ └──────┘            │
│              [ ← Préc ]  page 1/2  [ Suiv → ]    │
└───────────────────────────────────────────────┘
États : loading · success (grille) · error · vide
```

## 3. Deck builder (création / édition)

```
┌───────────────────────────────────────────────┐
│  Nouveau deck        Nom : [____________]        │
├──────────────────────────────┬────────────────┤
│  CATALOGUE                    │  COMPOSITION     │
│  ┌────┐┌────┐┌────┐┌────┐     │  (24/50)         │
│  │+   ││+   ││+   ││+   │     │  G0 · Dragon  −2+ │
│  └────┘└────┘└────┘└────┘     │  G1 · Chevalier−3+│
│  ┌────┐┌────┐┌────┐┌────┐     │  …               │
│  │+   ││+   ││+   ││+   │     │  [ Créer le deck ]│
│  └────┘└────┘└────┘└────┘     │  (16–50, max 4)  │
└──────────────────────────────┴────────────────┘
Validation live : « Deck valide ✔ » / « Ajoutez encore N cartes »
```

## 4. Salon de jeu (lobby)

```
┌───────────────────────────────────────────────┐
│               Salon de jeu                       │
│   Deck utilisé : [ Deck de départ ▼ ]            │
│                                                 │
│      [ 🤖 Jouer contre l'IA ]                    │
│      [ 🆚 Chercher un adversaire (PvP) ]         │
│                                                 │
│   (waiting) En file d'attente (position 1)…      │
└───────────────────────────────────────────────┘
États : idle · connecting · waiting (PvP) · error
```

## 5. Plateau de bataille (écran principal du jeu)

```
┌───────────────────────────────────────────────┐
│  🤖 IA — Ollama  [██████░░] 11 PV   🂠 5 · deck 20 │  ← zone adverse
│  [ unité ] [ unité ] [ unité ]                   │
├───────────────────────────────────────────────┤
│  ▶ À vous de jouer (tour 3)                      │  ← centre : statut
│  🪙 Pile — vous avez commencé                    │
│  Palier : Grade 2 — grades 0 à 2 déployables      │
│  ⚠ On vous attaque — défendez-vous ! (si garde)  │
│  ┌─ journal ──────────────────────────────────┐  │
│  │ Alice déploie Dragon de Flammes (10000).    │  │
│  └────────────────────────────────────────────┘  │
│  [ 🏳 Abandonner ]                                │
├───────────────────────────────────────────────┤
│  [ unité ⚔ ] [ unité ⚔ ] [ + libre ]             │  ← votre terrain
│  👤 Alice  [████████] 15 PV   🂠 6 · deck 18       │
│  Votre main (6) :                                 │
│  [carte ➕][carte ➕][carte …][carte][carte]      │
│                          [ Terminer le tour → ]  │
└───────────────────────────────────────────────┘
Interactions :
- Clic carte main → déployer (ou « ♻ Remplacer » si terrain plein)
- Clic unité terrain → attaquer
- En défense → sélection de cartes (bouclier) → [ Garder ] / [ Encaisser ]
États : coin-flip (overlay animé) → playing → (mustGuard) → finished
```

## 6. Fin de partie

```
┌───────────────────────────────────────────────┐
│                 🏆 Victoire !                     │
│           (ou 💀 Défaite)                         │
│           [ ◀ Retour au salon ]                  │
└───────────────────────────────────────────────┘
```
