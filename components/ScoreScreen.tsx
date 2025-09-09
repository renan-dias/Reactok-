
import React from 'react';
import { StarIcon } from './icons';

interface ScoreScreenProps {
  score: number;
  onPlayAgain: () => void;
}

const ScoreScreen: React.FC<ScoreScreenProps> = ({ score, onPlayAgain }) => {
    const stars = Math.max(1, Math.min(5, Math.floor(score / 3000) + 1));
    const messages = [
        "Precisa praticar mais!",
        "Nada mal para começar!",
        "Você está ficando bom nisso!",
        "Apresentação incrível!",
        "Você é uma Estrela do Karaokê!"
    ];
    const message = messages[stars - 1];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gradient-to-b from-purple-900/50 to-transparent">
        <h2 className="text-2xl text-purple-300 mb-2">Apresentação Completa!</h2>
        <p className="text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-cyan-400">
            {message}
        </p>

        <div className="my-10 flex space-x-2">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-star-pop" style={{animationDelay: `${i * 150}ms`}}>
                    <StarIcon
                        className={`w-20 h-20 transition-colors duration-500 ${i < stars ? 'text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.7)]' : 'text-gray-700'}`}
                    />
                </div>
            ))}
        </div>
        
        <div className="mb-10">
            <p className="text-lg text-gray-400">Pontuação Final</p>
            <p className="text-7xl font-bold text-white">{score}</p>
        </div>

        <button
            onClick={onPlayAgain}
            className="text-xl font-bold py-3 px-8 rounded-lg bg-pink-600 hover:bg-pink-700 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-pink-500/30"
        >
            Jogar Novamente
        </button>
        <style>{`
            @keyframes star-pop {
                0% { transform: scale(0); opacity: 0; }
                60% { transform: scale(1.2); opacity: 1; }
                100% { transform: scale(1); }
            }
            .animate-star-pop {
                animation: star-pop 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
                transform: scale(0);
                opacity: 0;
            }
        `}</style>
    </div>
  );
};

export default ScoreScreen;