import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Home from './pages/Home.jsx';
import Cards from './pages/Cards.jsx';
import Decks from './pages/Decks.jsx';
import DeckBuilder from './pages/DeckBuilder.jsx';
import Play from './pages/Play.jsx';

export default function App() {
  return (
    <>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/cards" element={<Cards />} />
          <Route path="/decks" element={<ProtectedRoute><Decks /></ProtectedRoute>} />
          <Route path="/decks/new" element={<ProtectedRoute><DeckBuilder /></ProtectedRoute>} />
          <Route path="/decks/:id/edit" element={<ProtectedRoute><DeckBuilder /></ProtectedRoute>} />
          <Route path="/play" element={<ProtectedRoute><Play /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
