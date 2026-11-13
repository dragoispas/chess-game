import './CreditsScreen.css'
import './PlayMenu.css'

type CreditsScreenProps = {
  onBack?: () => void
}

export function CreditsScreen({ onBack }: CreditsScreenProps) {
  return (
    <main className="credits-screen">
      <header className="game-header">
        <h1>Credits</h1>
      </header>

      <section className="credits-section" aria-labelledby="credits-own">
        <h2 id="credits-own">This game</h2>
        <p>
          Original code and design © 2026 <strong>Dragos Ispas</strong>.
        </p>
      </section>

      <section className="credits-section" aria-labelledby="credits-art">
        <h2 id="credits-art">Piece artwork</h2>
        <p>
          Chess piece graphics are derived from <strong>Cburnett</strong>{' '}
          SVGs on{' '}
          <a
            href="https://commons.wikimedia.org/wiki/Template:SVG_chess_pieces"
            target="_blank"
            rel="noreferrer"
          >
            Wikimedia Commons
          </a>
          .
        </p>
      </section>

      <section className="credits-section" aria-labelledby="credits-engine">
        <h2 id="credits-engine">Fairy-Stockfish</h2>
        <p>
          Computer opponent uses{' '}
          <a
            href="https://github.com/fairy-stockfish/Fairy-Stockfish"
            target="_blank"
            rel="noreferrer"
          >
            Fairy-Stockfish
          </a>
          .
        </p>
      </section>

      {onBack ? (
        <button type="button" className="reset" onClick={onBack}>
          Back
        </button>
      ) : null}
    </main>
  )
}
