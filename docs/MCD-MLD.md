# Modèle de données — MCD / MLD / MPD (activité 2)

Ce document présente le modèle de données du projet. Il est **fidèlement transposé** dans le schéma
Prisma ([server/prisma/schema.prisma](../server/prisma/schema.prisma)), qui fait foi pour l'implémentation.

---

## 1. MCD (Modèle Conceptuel de Données)

Entités et associations :

- **Player** _(id, pseudo, email, mot_de_passe, date_creation)_
  - `possède` **Deck** (1,1 côté Deck → 1,n côté Player)
  - `participe` à **Partie** via **Participation** _(role, points_vie)_ (n,n)
- **Deck** _(id, nom, date_creation)_
  - contient **Carte** via **Deck_Carte** _(quantité)_ (n,n)
- **Carte** _(id, nom, type, grade, puissance, critique, description)_
  - `possède` **Effet** (1,n)
- **Partie** _(id, date_partie, statut)_
  - `contient` **Tour** (1,n)
- **Tour** _(id, numero)_
- **Effet** _(id, description)_

```
        Player (id, pseudo, email, mot_de_passe, date_creation)
        │ 1,1 possède                 │ 1,n participe (role, points_vie)
        ▼                             ▼
       Deck ──< Deck_Carte >── Carte      Participation ──> Partie (id, date, statut)
     (nom,date)  (quantité)  (nom,type,       (role,             │ 1,1 contient
                              grade,           points_vie)        ▼
                              puissance,                         Tour (id, numero)
                              critique,
                              description)
                                 │ 1,n possède
                                 ▼
                              Effet (id, description)
```

## 2. MLD (Modèle Logique de Données)

```
users (
  id PK, pseudo, email, password, created_at, role
)
cards (
  id PK, name, type, grade, power, critical, description
)
effects (
  id PK, description, card_id FK -> cards.id
)
decks (
  id PK, name, created_at, user_id FK -> users.id
)
deck_cards (
  deck_id FK -> decks.id, card_id FK -> cards.id, quantity,
  PK (deck_id, card_id)
)
games (
  id PK, game_date, status
)
participations (
  user_id FK -> users.id, game_id FK -> games.id, role, life_points,
  PK (user_id, game_id)
)
turns (
  id PK, turn_number, game_id FK -> games.id, user_id FK -> users.id
)
```

> Évolution vs MLD initial : ajout de la colonne `users.role` (`user` / `admin`) pour la
> gestion des rôles (sécurisation, activité 5).

## 3. MPD (Modèle Physique — cible PostgreSQL)

> Le dossier d'intention cible **PostgreSQL** ; le MPD initial était rédigé en syntaxe MySQL
> (`AUTO_INCREMENT`). Prisma génère l'équivalent PostgreSQL (`SERIAL`/séquences). La structure
> logique (clés, relations, cardinalités) est identique. Ci-dessous la version PostgreSQL.

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  pseudo VARCHAR(50) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cards (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50),
  grade INT,
  power INT,
  critical INT,
  description TEXT
);

CREATE TABLE effects (
  id SERIAL PRIMARY KEY,
  description TEXT,
  card_id INT REFERENCES cards(id) ON DELETE CASCADE
);

CREATE TABLE decks (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id INT REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE deck_cards (
  deck_id INT REFERENCES decks(id) ON DELETE CASCADE,
  card_id INT REFERENCES cards(id) ON DELETE CASCADE,
  quantity INT DEFAULT 1,
  PRIMARY KEY (deck_id, card_id)
);

CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  game_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50)
);

CREATE TABLE participations (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  game_id INT REFERENCES games(id) ON DELETE CASCADE,
  role VARCHAR(20),
  life_points INT,
  PRIMARY KEY (user_id, game_id)
);

CREATE TABLE turns (
  id SERIAL PRIMARY KEY,
  turn_number INT,
  game_id INT REFERENCES games(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE SET NULL
);
```

## 4. Correspondance avec l'ORM (Prisma)

| Table | Modèle Prisma | Notes |
|---|---|---|
| users | `User` | `role` ajouté ; relations decks / participations / turns |
| cards | `Card` | relations effects / deckCards |
| effects | `Effect` | FK `cardId` (cascade) |
| decks | `Deck` | FK `userId` |
| deck_cards | `DeckCard` | clé composite `(deckId, cardId)` |
| games | `Game` | relations participations / turns |
| participations | `Participation` | clé composite `(userId, gameId)` |
| turns | `Turn` | FK `gameId`, `userId` nullable |

La cohérence MLD ↔ ORM est garantie par la migration Prisma versionnée
([server/prisma/migrations/](../server/prisma/migrations/)).
