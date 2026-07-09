import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Home() {
  const { user } = useAuth();
  return (
    <section className="hero">
      <h1>🃏 TCG Ynov</h1>
      <p className="lead">
        Un jeu de cartes à collectionner au tour par tour, inspiré de <em>Cardfight!! Vanguard</em>,
        avec un adversaire piloté par une IA (LLM local via Ollama).
      </p>
      <div className="hero-actions">
        {user ? (
          <>
            <Link to="/play" className="btn big">▶ Jouer contre l'IA</Link>
            <Link to="/decks" className="btn big ghost">Gérer mes decks</Link>
          </>
        ) : (
          <>
            <Link to="/login" className="btn big">Se connecter</Link>
            <Link to="/cards" className="btn big ghost">Voir les cartes</Link>
          </>
        )}
      </div>
      <div className="rules-card">
        <h3>Règles express</h3>
        <ul>
          <li>Chaque joueur démarre à <strong>15 PV</strong> et pioche 5 cartes.</li>
          <li>Chaque tour : pioche → déploie des unités → attaque.</li>
          <li>On ne pose une unité de grade G qu'à partir du tour G+1.</li>
          <li>En défense, on <strong>garde</strong> en défaussant des cartes (bouclier = somme des puissances).</li>
          <li>Premier joueur à 0 PV : défaite.</li>
        </ul>
      </div>
    </section>
  );
}
