import React, { useState, FormEvent } from 'react';
import type { SongDetails, YouTubeVideo } from '../types';
import { LoadingIcon, MicIcon, PlaylistIcon, SearchIcon } from './icons';
import { searchVideos } from '../services/youtubeService';
import { extractSongDetailsFromTitle } from '../services/geminiService';

interface HomeScreenProps {
  onStart: (details: SongDetails) => void;
  loading: boolean; // This is for the parent (App) loading state
  error: string | null;
  history: SongDetails[];
}

/**
 * Checks if a YouTube video can be embedded by creating a temporary, hidden player.
 * Resolves if the video is ready to play, rejects if there's an error (e.g., embedding disabled).
 * @param videoId The YouTube video ID to check.
 * @returns A promise that resolves on success and rejects on failure.
 */
function checkVideoEmbeddable(videoId: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const tempPlayerId = `temp-yt-player-${videoId}`;
        const tempContainer = document.createElement('div');
        tempContainer.id = tempPlayerId;
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px'; // Hide it off-screen
        tempContainer.style.width = '1px';
        tempContainer.style.height = '1px';
        document.body.appendChild(tempContainer);

        let player: YT.Player | null = null;
        let timeoutId: number | null = null;

        const cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            try {
                player?.destroy();
                if (document.body.contains(tempContainer)) {
                    document.body.removeChild(tempContainer);
                }
            } catch (e) {
                console.error("Error during cleanup:", e);
            }
        };

        const onError = (event: YT.OnErrorEvent) => {
            console.warn(`Video pre-check failed for ${videoId} with error code:`, event.data);
            cleanup();
            reject(new Error('VIDEO_UNPLAYABLE'));
        };

        const onReady = () => {
            cleanup();
            resolve();
        };
        
        timeoutId = window.setTimeout(() => {
             console.warn(`Video pre-check timed out for ${videoId}.`);
             cleanup();
             reject(new Error('VIDEO_CHECK_TIMEOUT'));
        }, 8000); // 8-second timeout

        player = new YT.Player(tempPlayerId, {
            videoId,
            playerVars: { controls: 0 },
            events: {
                'onReady': onReady,
                'onError': onError,
            },
        });
    });
}


const HomeScreen: React.FC<HomeScreenProps> = ({ onStart, loading, error, history }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  const [processingVideoId, setProcessingVideoId] = useState<string | null>(null);
  const [processingMessage, setProcessingMessage] = useState<string>('');
  const [unplayableVideoIds, setUnplayableVideoIds] = useState<Set<string>>(new Set());

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setUnplayableVideoIds(new Set()); // Reset unplayable videos on new search
    setSearchResults([]);
    try {
      const results = await searchVideos(query);
      if (results.length === 0) {
        setSearchError('Nenhum vídeo de karaokê encontrado para sua busca.');
      }
      setSearchResults(results);
    } catch (err) {
      let friendlyMessage = 'Ocorreu um erro desconhecido ao procurar por vídeos.';
      if (err instanceof Error) {
          const lowerCaseError = err.message.toLowerCase();
          if (lowerCaseError.includes('api key not valid') || lowerCaseError.includes('permission denied') || lowerCaseError.includes('disabled')) {
              friendlyMessage = "A busca no YouTube está indisponível. A chave de API pode ser inválida ou não ter permissões para a YouTube Data API.";
          } else if (lowerCaseError.includes('quota')) {
              friendlyMessage = 'A cota de busca do YouTube foi excedida. Por favor, tente novamente mais tarde.';
          } else {
              friendlyMessage = err.message;
          }
      }
      setSearchError(friendlyMessage);
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleVideoSelect = async (video: YouTubeVideo) => {
    setProcessingVideoId(video.id);
    setSearchError(null);
    try {
        setProcessingMessage('Verificando vídeo...');
        await checkVideoEmbeddable(video.id);

        setProcessingMessage('Analisando título...');
        const { artist, title } = await extractSongDetailsFromTitle(video.title);
        const youtubeUrl = `https://www.youtube.com/watch?v=${video.id}`;
        
        onStart({ artist, title, youtubeUrl });
    } catch (err) {
        if (err instanceof Error) {
            if (err.message.includes('VIDEO_UNPLAYABLE')) {
                setSearchError(`Este vídeo não pode ser reproduzido. Por favor, escolha outro.`);
                setUnplayableVideoIds(prev => new Set(prev).add(video.id));
            } else if (err.message.includes('VIDEO_CHECK_TIMEOUT')) {
                setSearchError(`A verificação do vídeo demorou muito. Verifique sua conexão e tente outro.`);
                setUnplayableVideoIds(prev => new Set(prev).add(video.id));
            } else {
                setSearchError(`Falha ao preparar a música: ${err.message}`);
            }
        } else {
            setSearchError('Ocorreu um erro desconhecido ao preparar a música.');
        }
        setProcessingVideoId(null);
        setProcessingMessage('');
    }
  };
  
  const handleHistoryClick = (song: SongDetails) => {
      onStart(song);
  };

  return (
    <div className="flex flex-col items-center h-full p-8 bg-gradient-to-b from-purple-900/30 to-transparent overflow-y-auto">
        <div className="text-center mb-8 flex-shrink-0">
            <h1 className="text-6xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 animate-gradient-x">
                Karaoke Star
            </h1>
            <p className="text-purple-300 mt-2 text-lg">Encontre qualquer música no YouTube e comece a cantar.</p>
        </div>

        <div className="w-full max-w-2xl flex-shrink-0">
            <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
                 <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Procure por uma música ou artista..."
                    className="w-full p-3 bg-gray-800/50 border-2 border-purple-700 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-all duration-200"
                    aria-label="Procurar por uma música"
                />
                <button
                    type="submit"
                    disabled={isSearching || loading}
                    className="flex-shrink-0 flex items-center justify-center text-lg font-bold p-3 px-6 rounded-lg bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-pink-500/30"
                >
                    {isSearching ? <LoadingIcon /> : <SearchIcon />}
                </button>
            </form>

            {(error || searchError) && (
                 <p className="text-red-400 text-center bg-red-900/50 p-3 rounded-lg my-4">
                     {error || searchError}
                 </p>
            )}
            
             {loading && (
                <div className="text-center p-4 text-purple-300 flex items-center justify-center">
                    <LoadingIcon />
                    Buscando letras, por favor aguarde...
                </div>
            )}
        </div>
        
        <div className="w-full max-w-2xl flex-grow overflow-y-auto mt-4 pr-2">
            {isSearching && !searchResults.length && (
                 <div className="text-center p-10 text-purple-300">Procurando por vídeos...</div>
            )}

            {searchResults.length > 0 && (
                 <div className="space-y-3">
                     {searchResults.map(video => {
                        const isUnplayable = unplayableVideoIds.has(video.id);
                        const isProcessingThis = processingVideoId === video.id;
                        
                        return (
                            <button
                                key={video.id}
                                onClick={() => handleVideoSelect(video)}
                                disabled={loading || isSearching || !!processingVideoId || isUnplayable}
                                className={`w-full text-left p-3 rounded-lg bg-gray-800/50 border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-pink-500 flex items-center gap-4 disabled:hover:bg-gray-800/50 ${isUnplayable ? 'opacity-50 cursor-not-allowed border-red-800/50' : 'hover:bg-purple-800/50 border-transparent hover:border-purple-600 disabled:opacity-50'}`}
                                aria-label={`Selecionar ${video.title}${isUnplayable ? ' (Indisponível)' : ''}`}
                            >
                                <img src={video.thumbnailUrl} alt="" className="w-32 h-18 object-cover rounded-md" />
                                <div className="flex-grow overflow-hidden">
                                    <p className="font-bold text-white truncate">{video.title}</p>
                                    <p className="text-sm text-purple-300 truncate">{video.channelTitle}</p>
                                    {isUnplayable && <p className="text-xs text-red-400 font-semibold">Indisponível para Karaokê</p>}
                                </div>
                                {isProcessingThis && (
                                    <div className="flex items-center text-sm text-purple-300">
                                        <LoadingIcon />
                                        <span className="ml-2">{processingMessage}</span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                 </div>
            )}
        
            {history && history.length > 0 && searchResults.length === 0 && !isSearching && (
                <div className="w-full mt-6">
                    <h2 className="text-xl font-semibold text-purple-300 mb-4 flex items-center">
                        <PlaylistIcon />
                        Tocadas Recentemente
                    </h2>
                    <div className="space-y-3">
                        {history.map((song) => (
                            <button
                                key={song.youtubeUrl}
                                onClick={() => handleHistoryClick(song)}
                                disabled={loading || isSearching || !!processingVideoId}
                                className="w-full text-left p-3 rounded-lg bg-gray-800/50 hover:bg-purple-800/50 border border-transparent hover:border-purple-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-pink-500 disabled:opacity-50"
                                aria-label={`Tocar ${song.title} por ${song.artist}`}
                            >
                                <p className="font-bold text-white truncate">{song.title}</p>
                                <p className="text-sm text-purple-300 truncate">{song.artist}</p>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};


export default HomeScreen;