import React, { useState, useCallback } from 'react';
import { AppState, SongDetails, LyricLine } from './types';
import HomeScreen from './components/HomeScreen';
import KaraokeScreen from './components/KaraokeScreen';
import ScoreScreen from './components/ScoreScreen';
import { fetchLyrics } from './services/geminiService';
import { useSongHistory } from './hooks/useSongHistory';

const SONG_DURATION_S = 180; // Assume all songs are 3 minutes for simulation

const parseLRC = (lrcText: string): LyricLine[] => {
    const timedLyrics: LyricLine[] = [];
    const lines = lrcText.split('\n').filter(line => line.match(/^\[\d{2}:\d{2}\.\d{2,3}\]/));

    if (lines.length === 0) return [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
        if (!match) continue;

        const [, min, sec, ms, text] = match;
        const startTime = parseInt(min, 10) * 60 + parseInt(sec, 10) + parseInt(ms.padEnd(3, '0'), 10) / 1000;
        
        let endTime = SONG_DURATION_S;
        if (i + 1 < lines.length) {
            const nextLine = lines[i+1];
            const nextMatch = nextLine.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\]/);
            if (nextMatch) {
                const [, nextMin, nextSec, nextMs] = nextMatch;
                endTime = parseInt(nextMin, 10) * 60 + parseInt(nextSec, 10) + parseInt(nextMs.padEnd(3, '0'), 10) / 1000;
            }
        }

        timedLyrics.push({
            text: text.trim(),
            startTime,
            endTime,
        });
    }
    
    // Set the end time of the last line to be a few seconds after its start
    if (timedLyrics.length > 0) {
        const lastLine = timedLyrics[timedLyrics.length - 1];
        if (lastLine.endTime === SONG_DURATION_S) {
            lastLine.endTime = lastLine.startTime + 5; // Assume last line shows for 5s
        }
    }

    return timedLyrics;
}


export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.HOME);
  const [songDetails, setSongDetails] = useState<SongDetails | null>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [finalScore, setFinalScore] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { history, addSongToHistory } = useSongHistory();

  const handleStartKaraoke = useCallback(async (details: SongDetails) => {
    setAppState(AppState.LOADING_LYRICS);
    setError(null);
    try {
      const lyricsLRC = await fetchLyrics(details.artist, details.title);
      const timedLyrics = parseLRC(lyricsLRC);

      if (timedLyrics.length === 0) {
          throw new Error("A IA não conseguiu gerar letras sincronizadas. A resposta pode estar em um formato inesperado.");
      }
      
      addSongToHistory(details);
      setLyrics(timedLyrics);
      setSongDetails(details);
      setAppState(AppState.KARAOKE);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Ocorreu um erro desconhecido.';
      setError(`Falha ao iniciar o karaokê. ${errorMessage}`);
      setAppState(AppState.HOME);
    }
  }, [addSongToHistory]);

  const handleSongEnd = useCallback((score: number) => {
    setFinalScore(score);
    setAppState(AppState.SCORE);
  }, []);
  
  const handlePlayAgain = useCallback(() => {
      setSongDetails(null);
      setLyrics([]);
      setFinalScore(0);
      setError(null);
      setAppState(AppState.HOME);
  }, []);

  const handleVideoError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setAppState(AppState.HOME);
  }, []);


  const renderContent = () => {
    switch (appState) {
      case AppState.KARAOKE:
        if (songDetails && lyrics.length > 0) {
          return <KaraokeScreen songDetails={songDetails} lyrics={lyrics} onSongEnd={handleSongEnd} onVideoError={handleVideoError} duration={SONG_DURATION_S} />;
        }
        // Fallback to home if state is inconsistent
        handlePlayAgain();
        return null;
      case AppState.SCORE:
        return <ScoreScreen score={finalScore} onPlayAgain={handlePlayAgain} />;
      case AppState.LOADING_LYRICS:
      case AppState.HOME:
      default:
        return <HomeScreen onStart={handleStartKaraoke} loading={appState === AppState.LOADING_LYRICS} error={error} history={history} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white font-sans flex items-center justify-center p-4">
      <div className="w-full max-w-5xl h-[90vh] max-h-[800px] bg-black bg-opacity-40 rounded-2xl shadow-2xl shadow-purple-500/20 backdrop-blur-xl border border-purple-500/20 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
}