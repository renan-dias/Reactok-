import React, { useEffect, useState } from 'react';

interface TomatoProps {
    id: number;
    onEnd: (id: number) => void;
}

const Tomato: React.FC<TomatoProps> = ({ id, onEnd }) => {
    const [style, setStyle] = useState({});
    const [isSplat, setIsSplat] = useState(false);

    useEffect(() => {
        const startX = Math.random() < 0.5 ? -20 : 120; // Start off-screen left or right
        const startY = Math.random() * 80 + 10;
        const endX = Math.random() * 60 + 20;
        const endY = Math.random() * 60 + 20;

        setStyle({
            '--start-x': `${startX}vw`,
            '--start-y': `${startY}vh`,
            '--end-x': `${endX}vw`,
            '--end-y': `${endY}vh`,
            animation: 'fly 1s cubic-bezier(0.5, 0, 1, 0.5) forwards'
        });

        const splatTimer = setTimeout(() => {
            setIsSplat(true);
        }, 950);
        
        const removeTimer = setTimeout(() => {
            onEnd(id);
        }, 2000); // Remove after splat fades

        return () => {
            clearTimeout(splatTimer);
            clearTimeout(removeTimer);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    return (
        <>
            <style>{`
                @keyframes fly {
                    from { transform: translate(var(--start-x), var(--start-y)) scale(0.5) rotate(0deg); }
                    to { transform: translate(var(--end-x), var(--end-y)) scale(1) rotate(720deg); }
                }
                @keyframes splat-fade {
                    from { opacity: 1; transform: scale(1); }
                    to { opacity: 0; transform: scale(1.2); }
                }
            `}</style>
            <div
                style={style}
                className="fixed top-0 left-0 z-50 text-5xl pointer-events-none"
                onAnimationEnd={() => {
                     // Set final position after flying animation
                    setStyle({
                         transform: `translate(var(--end-x), var(--end-y))`,
                         animation: isSplat ? 'splat-fade 1s forwards' : ''
                    })
                }}
            >
                {isSplat ? '💥' : '🍅'}
            </div>
        </>
    )
}

export default Tomato;