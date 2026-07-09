// Composant carte réutilisable (catalogue, deck builder, plateau).
const GRADE_LABEL = ['0', '1', '2', '3'];

export default function Card({ card, onClick, selected, disabled, compact, footer }) {
  return (
    <div
      className={`card grade-${card.grade} ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${compact ? 'compact' : ''} ${onClick ? 'clickable' : ''} ${card.tapped ? 'tapped' : ''}`}
      onClick={disabled ? undefined : onClick}
      title={card.description || card.name}
    >
      <div className="card-head">
        <span className="card-name">{card.name}</span>
        <span className="card-grade">G{GRADE_LABEL[card.grade] ?? card.grade}</span>
      </div>
      {card.type && !compact && <div className="card-type">{card.type}</div>}
      <div className="card-stats">
        <span className="stat power" title="Puissance">⚔ {card.power}</span>
        <span className="stat crit" title="Critique (dégâts)">✦ {card.critical}</span>
      </div>
      {!compact && card.description && <p className="card-desc">{card.description}</p>}
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}
