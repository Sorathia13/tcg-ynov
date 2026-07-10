# Changelog

Toutes les évolutions notables du projet sont consignées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) ;
versionnage [SemVer](https://semver.org/lang/fr/).

## [0.1.0] — 2026-07-10

Première version fonctionnelle (projet fil rouge M2 INFO — Coordination Front & Back).

### Ajouté
- **Authentification** JWT (register / login / profil), hachage bcrypt, middleware de protection,
  déconnexion automatique à l'expiration du token.
- **Cartes** : catalogue paginé avec recherche et filtre par grade (API REST publique).
- **Decks** : CRUD complet avec règles de construction (16–50 cartes, max 4 exemplaires).
- **Parties temps réel** (Socket.io) avec serveur autoritaire ; **matchmaking** (file PvP + vs IA).
- **Moteur de jeu TCG lite** déterministe : tours, pioche, déploiement, attaque, garde, victoire.
- **IA adversaire pilotée par un LLM local (Ollama)** avec repli heuristique de sécurité.
- **Pile ou face** automatique et animé pour désigner le premier joueur.
- Règles de premier tour : le joueur qui commence n'attaque pas à son 1er tour ; le second
  pioche une carte bonus à son 1er tour.
- **Remplacement d'unité** : placer une unité par-dessus une autre quand le champ est plein.
- **Abandon de partie** avec retour propre au salon (enregistré comme défaite).
- Indicateur du **palier de grade** jouable par tour ; compteur de deck du joueur.
- **BDD PostgreSQL + Prisma** (migration initiale + seed de données mocks), `docker-compose`.
- **Tests** Vitest du moteur (12 tests) + **CI GitHub Actions** (tests back + build front).
- **Documentation** : README, architecture, priorisation MoSCoW, plan de playtest.
- **Instrumentation** : log `[METRICS]` par partie (durée, tours, vainqueur, taux Ollama).

### Corrigé
- Connexion Ollama basculée sur `127.0.0.1` (au lieu de `localhost`) : le `fetch` de Node
  résolvait `localhost` en IPv6 et l'IA tombait silencieusement sur son repli heuristique.
- Concurrence : verrou par partie sérialisant les actions humaines et le tour asynchrone de l'IA
  (évite les collisions d'état pendant que l'IA « réfléchit »).
- UI : lisibilité des boutons-liens au survol (texte devenu invisible).

### Équilibrage
- Puissance standardisée par grade : G0 6000, G1 8000, G2 10000, G3 13000
  (le « critical » reste l'élément différenciateur entre cartes).

[0.1.0]: https://github.com/Sorathia13/tcg-ynov/releases/tag/v0.1.0
