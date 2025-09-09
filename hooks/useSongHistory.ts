
import { useState, useEffect, useCallback } from 'react';
import type { SongDetails } from '../types';

const HISTORY_KEY = 'karaoke_history';
const MAX_HISTORY_SIZE = 5;

export const useSongHistory = () => {
    const [history, setHistory] = useState<SongDetails[]>([]);

    useEffect(() => {
        try {
            const storedHistory = localStorage.getItem(HISTORY_KEY);
            if (storedHistory) {
                setHistory(JSON.parse(storedHistory));
            }
        } catch (error) {
            console.error("Failed to load song history from localStorage", error);
            setHistory([]);
        }
    }, []);

    const addSongToHistory = useCallback((song: SongDetails) => {
        setHistory(prevHistory => {
            // Remove existing entry if it's the same song (based on URL to avoid duplicates)
            const filteredHistory = prevHistory.filter(item => item.youtubeUrl !== song.youtubeUrl);
            
            // Add the new song to the beginning of the list
            const newHistory = [song, ...filteredHistory];

            // Ensure the history doesn't grow too large
            const cappedHistory = newHistory.slice(0, MAX_HISTORY_SIZE);

            // Save the updated history to localStorage
            try {
                localStorage.setItem(HISTORY_KEY, JSON.stringify(cappedHistory));
            } catch (error) {
                console.error("Failed to save song history to localStorage", error);
            }

            return cappedHistory;
        });
    }, []);

    return { history, addSongToHistory };
};
