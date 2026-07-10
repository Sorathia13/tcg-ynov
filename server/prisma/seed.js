// Données mocks (activité 3, point 2 : "2 ou 3 enregistrements minimum par table").
// Insère : un catalogue de cartes, quelques effets, 2 utilisateurs et un deck de départ chacun.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Catalogue de cartes — esprit Vanguard (grade / power / critical).
// Puissance standardisée par grade : G0=6000, G1=8000, G2=10000, G3=13000.
// Le "critical" (dégâts) reste l'élément différenciateur entre cartes d'un même grade.
const CARDS = [
  // Grade 0 — petites unités, jouables dès le tour 1
  { name: 'Apprenti Dragon', type: 'Dragon', grade: 0, power: 6000, critical: 1, description: 'Un jeune dragon plein de fougue.' },
  { name: 'Éclaireur Elfe', type: 'Elfe', grade: 0, power: 6000, critical: 1, description: 'Rapide et discret.' },
  { name: 'Gobelin Bouclier', type: 'Gobelin', grade: 0, power: 6000, critical: 1, description: 'Robuste, utile aussi en garde.' },
  { name: 'Fée Lumineuse', type: 'Fée', grade: 0, power: 6000, critical: 1, description: 'Émet une douce lumière.' },
  // Grade 1
  { name: 'Chevalier d\'Argent', type: 'Humain', grade: 1, power: 8000, critical: 1, description: 'Un défenseur loyal.' },
  { name: 'Sorcière du Vent', type: 'Sorcier', grade: 1, power: 8000, critical: 1, description: 'Manipule les courants d\'air.' },
  { name: 'Golem de Pierre', type: 'Golem', grade: 1, power: 8000, critical: 1, description: 'Lent mais robuste.' },
  { name: 'Archer Sylvestre', type: 'Elfe', grade: 1, power: 8000, critical: 1, description: 'Tir précis à longue portée.' },
  // Grade 2
  { name: 'Dragon de Flammes', type: 'Dragon', grade: 2, power: 10000, critical: 1, description: 'Crache un souffle ardent.' },
  { name: 'Général Berserk', type: 'Humain', grade: 2, power: 10000, critical: 2, description: 'Frappe deux fois plus fort.' },
  { name: 'Léviathan des Mers', type: 'Bête', grade: 2, power: 10000, critical: 1, description: 'Surgit des abysses.' },
  { name: 'Mage Suprême', type: 'Sorcier', grade: 2, power: 10000, critical: 1, description: 'Maîtrise les arcanes.' },
  // Grade 3 — finisseurs
  { name: 'Dragon Empereur', type: 'Dragon', grade: 3, power: 13000, critical: 2, description: 'Le souverain des dragons.' },
  { name: 'Titan Colossal', type: 'Golem', grade: 3, power: 13000, critical: 1, description: 'Une force de la nature.' },
  { name: 'Ange de l\'Apocalypse', type: 'Ange', grade: 3, power: 13000, critical: 2, description: 'Jugement dernier.' },
  { name: 'Roi Démon', type: 'Démon', grade: 3, power: 13000, critical: 3, description: 'Frappe dévastatrice.' },
];

// Quelques effets (table effects) — flavor / extension future.
const EFFECTS = [
  { cardName: 'Général Berserk', description: 'Critique augmenté : inflige 2 dégâts au lieu de 1.' },
  { cardName: 'Roi Démon', description: 'Critique 3 : une attaque qui passe peut finir la partie.' },
  { cardName: 'Gobelin Bouclier', description: 'Excellente carte de garde (à défausser en défense).' },
];

async function main() {
  console.log('🌱 Seed en cours...');

  // Nettoyage (ordre : dépendances d'abord)
  await prisma.turn.deleteMany();
  await prisma.participation.deleteMany();
  await prisma.game.deleteMany();
  await prisma.deckCard.deleteMany();
  await prisma.deck.deleteMany();
  await prisma.effect.deleteMany();
  await prisma.card.deleteMany();
  await prisma.user.deleteMany();

  // Cartes
  const cards = {};
  for (const c of CARDS) {
    const card = await prisma.card.create({ data: c });
    cards[c.name] = card;
  }
  console.log(`  ✓ ${CARDS.length} cartes`);

  // Effets
  for (const e of EFFECTS) {
    await prisma.effect.create({
      data: { description: e.description, cardId: cards[e.cardName].id },
    });
  }
  console.log(`  ✓ ${EFFECTS.length} effets`);

  // Utilisateurs
  const passwordHash = await bcrypt.hash('password123', 10);
  const alice = await prisma.user.create({
    data: { pseudo: 'Alice', email: 'alice@tcg.dev', password: passwordHash },
  });
  const bob = await prisma.user.create({
    data: { pseudo: 'Bob', email: 'bob@tcg.dev', password: passwordHash },
  });
  console.log('  ✓ 2 utilisateurs (alice@tcg.dev / bob@tcg.dev — password123)');

  // Deck de départ : un bon échantillon sur tous les grades.
  const starter = [
    ['Apprenti Dragon', 4], ['Gobelin Bouclier', 4], ['Éclaireur Elfe', 2],
    ['Chevalier d\'Argent', 3], ['Golem de Pierre', 2], ['Sorcière du Vent', 2],
    ['Dragon de Flammes', 3], ['Général Berserk', 2], ['Léviathan des Mers', 2],
    ['Dragon Empereur', 2], ['Titan Colossal', 1], ['Roi Démon', 1],
  ];

  for (const [user, deckName] of [[alice, 'Deck de départ d\'Alice'], [bob, 'Deck de départ de Bob']]) {
    const deck = await prisma.deck.create({ data: { name: deckName, userId: user.id } });
    for (const [cardName, qty] of starter) {
      await prisma.deckCard.create({
        data: { deckId: deck.id, cardId: cards[cardName].id, quantity: qty },
      });
    }
  }
  console.log('  ✓ 2 decks de départ');

  console.log('✅ Seed terminé.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
