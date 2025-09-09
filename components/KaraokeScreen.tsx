import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { SongDetails, LyricLine } from '../types';
import { StarIcon, PlayIcon, PauseIcon, SettingsIcon, LoadingIcon, PlusIcon, MinusIcon } from './icons';
import { usePitchDetection } from '../hooks/usePitchDetection';
import SettingsModal from './SettingsModal';
import Tomato from './Tomato';

interface KaraokeScreenProps {
  songDetails: SongDetails;
  lyrics: LyricLine[];
  onSongEnd: (score: number) => void;
  onVideoError: (errorMessage: string) => void;
  duration: number;
}

const getYouTubeVideoId = (url: string): string | null => {
  let videoId: string | null = null;
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'youtu.be') {
      videoId = urlObj.pathname.slice(1);
    } else if (urlObj.hostname.includes('youtube.com')) {
      videoId = urlObj.searchParams.get('v');
    }
  } catch (e) {
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    videoId = match ? match[1] : null;
  }
  return videoId;
};

const KaraokeScreen: React.FC<KaraokeScreenProps> = ({ songDetails, lyrics, onSongEnd, onVideoError, duration }) => {
  const [player, setPlayer] = useState<YT.Player | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [score, setScore] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedMicId, setSelectedMicId] = useState<string | null>(null);
  const [tomatoes, setTomatoes] = useState<{ id: number }[]>([]);
  const [lyricsOffset, setLyricsOffset] = useState(0);
  
  const { userPitch, micVolume, isMicReady, error: micError } = usePitchDetection({ deviceId: selectedMicId });
  
  const videoId = useMemo(() => getYouTubeVideoId(songDetails.youtubeUrl), [songDetails.youtubeUrl]);
  const scoreRef = useRef(score);
  scoreRef.current = score;
  const noSingingCounter = useRef(0);
  const songDuration = useMemo(() => lyrics.length > 0 ? Math.max(...lyrics.map(l => l.endTime)) + 2 : duration, [lyrics, duration]);


  useEffect(() => {
    if (!videoId) {
        onVideoError("A URL do vídeo do YouTube é inválida.");
        return;
    };

    const onPlayerReady = (event: YT.PlayerEvent) => {
      setIsPlayerReady(true);
      // Video will now wait for the user to press play.
    };
    
    const onPlayerStateChange = (event: YT.OnStateChangeEvent) => {
        if (event.data === YT.PlayerState.PLAYING) {
            setIsPlaying(true);
        } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
            setIsPlaying(false);
        }
    };
    
    const onPlayerError = (event: YT.OnErrorEvent) => {
        console.error("YouTube Player Error:", event.data);
        // Error codes: 2 (invalid parameter), 5 (HTML5 player error), 100 (video not found), 
        // 101 & 150 (embedding disabled by owner).
        onVideoError("Este vídeo não pôde ser carregado. Por favor, tente outro.");
    };

    const newPlayer = new YT.Player('youtube-player', {
      videoId: videoId,
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        iv_load_policy: 3,
      },
      events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange,
        'onError': onPlayerError
      }
    });
    setPlayer(newPlayer);

    return () => {
      newPlayer.destroy();
    };
  }, [videoId, onVideoError]);
  
  // Game loop
  useEffect(() => {
    if (!isPlaying) return;

    let animationFrameId: number;

    const gameTick = () => {
      const newTime = player?.getCurrentTime() ?? 0;
      setCurrentTime(newTime);
      
      if (newTime >= songDuration) {
        onSongEnd(scoreRef.current);
        return;
      }

      // Simulate target pitch as a sine wave for visual appeal
      const targetPitch = 50 + Math.sin(newTime * 1.5) * 30;

      // Scoring and Tomato logic
      if (isMicReady) {
        if (micVolume > 0.05) { // Threshold for singing
          noSingingCounter.current = 0; // Reset counter when singing
          const pitchDifference = Math.abs(userPitch - targetPitch);
          if (pitchDifference < 10) { // Good pitch
              setScore(s => s + 5);
          } else if (pitchDifference < 20) { // Ok pitch
              setScore(s => s + 2);
          }
        } else {
            noSingingCounter.current++;
        }

        // After ~2 seconds of no singing, throw a tomato
        if (noSingingCounter.current > 120) {
            setTomatoes(prev => [...prev, { id: Date.now() + Math.random() }]);
            noSingingCounter.current = 0; // Reset after throwing
        }
      }

      animationFrameId = requestAnimationFrame(gameTick);
    };

    animationFrameId = requestAnimationFrame(gameTick);

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, player, songDuration, onSongEnd, isMicReady, micVolume, userPitch]);

  const handleTogglePlay = () => {
    if (!player || !isPlayerReady) return;

    const playerState = player.getPlayerState();
    if (playerState === YT.PlayerState.PLAYING) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
  };
  
  const handleAdjustSync = (amount: number) => {
    setLyricsOffset(prev => prev + amount);
  };

  const removeTomato = useCallback((id: number) => {
      setTomatoes(prev => prev.filter(t => t.id !== id));
  }, []);

  // Note: use `-lyricsOffset` so that decreasing the offset (e.g. -0.5)
  // causes a delay in when the lyrics change (startTime - (-0.5) => later).
  const activeLineIndex = lyrics.findIndex(line => currentTime >= (line.startTime - lyricsOffset) && currentTime < (line.endTime - lyricsOffset));
  const activeLine = activeLineIndex !== -1 ? lyrics[activeLineIndex] : null;
  const futureLine = activeLineIndex < lyrics.length - 1 ? lyrics[activeLineIndex + 1] : null;
  const targetPitch = 50 + Math.sin(currentTime * 1.5) * 30;
  const progressPercentage = (currentTime / songDuration) * 100;
  const stars = Math.floor(score / 3000);
  
  if (!videoId) {
    // This case is handled by the useEffect, but as a fallback:
    return <div className="flex items-center justify-center h-full text-red-400">URL do YouTube inválida.</div>;
  }

  return (
    <div className="relative w-full h-full flex flex-col bg-black">
      <div className="absolute inset-0 z-0">
        <div id="youtube-player" className={`w-full h-full transition-opacity duration-500 ${isPlaying ? 'opacity-100' : 'opacity-40'}`}></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>
      </div>
      
      {tomatoes.map(tomato => (
          <Tomato key={tomato.id} id={tomato.id} onEnd={removeTomato} />
      ))}
      
      <div className="relative z-10 p-6 flex-grow flex flex-col justify-end">
        {!isPlayerReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <LoadingIcon /> <span className="ml-2">Carregando Vídeo...</span>
            </div>
        )}

        <div className="absolute top-4 right-4 flex items-center gap-4 bg-black/50 p-2 px-4 rounded-full">
            <div className="flex">
                {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} className={`w-8 h-8 transition-colors ${i < stars ? 'text-yellow-400' : 'text-gray-600'}`} />
                ))}
            </div>
            <span className="text-3xl font-bold text-cyan-300 w-28 text-right">{score}</span>
        </div>

        <div className="absolute bottom-4 left-4 flex items-center gap-2">
            <button 
                onClick={handleTogglePlay} 
                disabled={!isPlayerReady}
                className="p-3 bg-black/50 rounded-full hover:bg-pink-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={isPlaying ? "Pausar" : "Tocar"}>
                <span className="sr-only">{isPlaying ? "Pausar" : "Tocar"}</span>
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button onClick={() => setShowSettings(true)} className="p-3 bg-black/50 rounded-full hover:bg-purple-500/50 transition-colors" aria-label="Configurações"><span className="sr-only">Configurações</span><SettingsIcon /></button>
        
            <div className="h-6 w-px bg-gray-600 mx-2"></div>
            
            <div className="flex items-center gap-1 bg-black/50 rounded-full p-1">
                 <button onClick={() => handleAdjustSync(-0.5)} disabled={!isPlayerReady} className="p-2 rounded-full hover:bg-purple-500/50 transition-colors disabled:opacity-50" aria-label="Acelerar letra"><MinusIcon /></button>
                 <span className="text-xs w-12 text-center text-purple-200 tabular-nums" aria-live="polite">{lyricsOffset.toFixed(1)}s</span>
                 <button onClick={() => handleAdjustSync(0.5)} disabled={!isPlayerReady} className="p-2 rounded-full hover:bg-purple-500/50 transition-colors disabled:opacity-50" aria-label="Atrasar letra"><PlusIcon /></button>
            </div>
        </div>

        {(!isMicReady || micError) && 
            <div className="absolute top-4 left-4 bg-yellow-500/80 text-black p-2 px-4 rounded-full text-sm font-semibold animate-pulse">
                {micError ? "Erro no Microfone!" : "Conectando ao microfone..."}
            </div>
        }
        
        <div className="w-full h-24 bg-black/30 rounded-lg mb-4 p-2 flex items-center relative overflow-hidden">
            <div 
                className="absolute top-0 left-0 h-full bg-purple-500/30 transition-all duration-100"
                style={{ width: `${isMicReady && micVolume > 0.05 ? Math.min(100, Math.max(0, 100 - Math.abs(userPitch - targetPitch) * 2)) : 0}%` }}
            ></div>
            <div className="absolute w-2 h-10 bg-cyan-300 rounded-full shadow-[0_0_10px_theme(colors.cyan.300)] transition-all duration-100 ease-linear" style={{ top: `${100 - targetPitch - 10}%`}}></div>
            <div className="absolute w-4 h-4 rounded-full bg-pink-500 shadow-[0_0_10px_theme(colors.pink.500)] transition-all duration-100 ease-out" style={{ left: `50%`, top: `${100 - userPitch - 4}%`, opacity: isMicReady && micVolume > 0.01 ? 1 : 0 }}></div>
        </div>
        
        <div className="text-center">
            <p className="text-4xl font-bold transition-all duration-300 text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-cyan-300 h-12">
                {activeLine?.text || '...'}
            </p>
            <p className="text-2xl text-gray-500 mt-2 h-8">
                {futureLine?.text || ''}
            </p>
        </div>
      </div>
      
      <div className="relative z-10 w-full h-2 bg-gray-700">
        <div className="h-full bg-gradient-to-r from-pink-500 to-purple-500" style={{width: `${progressPercentage}%`}}></div>
      </div>
      
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)}
        onDeviceSelect={setSelectedMicId}
        currentDeviceId={selectedMicId}
      />
    </div>
  );
};

export default KaraokeScreen;