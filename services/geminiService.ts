import { GoogleGenAI, Type } from "@google/genai";

// Assume process.env.GEMINI_API_KEY is available
const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;
if (!API_KEY) {
    throw new Error("GEMINI_API_KEY não está definida nas variáveis de ambiente.");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

export async function fetchLyrics(artist: string, title: string): Promise<string> {
    const prompt = `
        Provide the synchronized lyrics for the song "${title}" by "${artist}" in LRC format.
        Each line must start with a timestamp like [mm:ss.xx].
        Do not include any other text, titles, or explanations in your response.
        Just return the raw LRC-formatted lyrics.

        Example:
        [00:10.54]When I walk on by, girls be looking like damn he fly
        [00:13.20]I pimp to the beat, walking on the street in my new La-Freak, yeah
    `;

    try {
        // Safety timeout: Gemini calls may hang in browser environments or be blocked.
        const timeoutMs = 12000; // 12 seconds

        const callPromise = ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                // Setting a higher temperature to encourage more creative/accurate timing guesses
                temperature: 0.2,
            }
        });

        const timeoutPromise = new Promise((_, reject) => {
            const id = setTimeout(() => {
                clearTimeout(id);
                reject(new Error('Gemini API timeout'));
            }, timeoutMs);
        });

        const response: any = await Promise.race([callPromise, timeoutPromise]);

        if (!response || !response.text) {
            console.warn('Gemini returned invalid response, trying fallback:', response);
            // Try fallback when Gemini returns nothing useful
            return await fetchLyricsFromFallback(artist, title);
        }

        return response.text.trim();
    } catch (error) {
        console.error('Error fetching lyrics from Gemini API:', error);
        // If Gemini times out or fails, attempt fallback to a free lyrics API
        try {
            console.info('Attempting fallback lyrics provider (lyrics.ovh)...');
            return await fetchLyricsFromFallback(artist, title);
        } catch (fallbackError) {
            console.error('Fallback lyrics provider also failed:', fallbackError);
            if (error instanceof Error && error.message.includes('timeout')) {
                throw new Error('A requisição à API de letras expirou e o fallback falhou. Verifique sua chave/API ou tente novamente mais tarde.');
            }
            throw new Error('Não foi possível obter as letras. O serviço de IA e o fallback de letras estão indisponíveis.');
        }
    }
}

// --- Fallback implementation ---
async function fetchLyricsFromFallback(artist: string, title: string): Promise<string> {
    const apiUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    try {
        const res = await fetch(apiUrl, { method: 'GET' });
        if (!res.ok) {
            const txt = await res.text();
            console.warn('lyrics.ovh returned error:', res.status, txt);
            throw new Error('Fallback lyrics provider returned an error');
        }
        const data = await res.json();
        const raw = data?.lyrics;
        if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
            throw new Error('Fallback returned empty lyrics');
        }

        // Convert raw lyrics (plain lines) into a naive LRC with estimated timings.
        const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) throw new Error('No usable lyrics lines from fallback');

        // Estimate duration-per-line (approx). We'll use 3.5s per line as a heuristic.
        const perLine = 3.5;
        const toTimestamp = (seconds: number) => {
            const mm = Math.floor(seconds / 60);
            const ss = Math.floor(seconds % 60);
            const cs = Math.floor((seconds - Math.floor(seconds)) * 100);
            const pad = (n: number, digits = 2) => n.toString().padStart(digits, '0');
            return `[${pad(mm)}:${pad(ss)}.${pad(cs)}]`;
        };

        let current = 0;
        const lrcLines = lines.map(line => {
            const ts = toTimestamp(current);
            current += perLine;
            return `${ts}${line}`;
        });

        return lrcLines.join('\n');
    } catch (err) {
        console.error('Error in fallback lyrics provider:', err);
        throw err;
    }
}

export async function extractSongDetailsFromTitle(videoTitle: string): Promise<{ artist: string; title: string }> {
    const prompt = `
        Analyze the following YouTube video title and extract the main artist and the song title. Your response must be in JSON format.

        Video Title: "${videoTitle}"

        Instructions for extraction:
        1.  Identify the primary performing artist.
        2.  Identify the song's title.
        3.  Exclude any extra information like "(Official Video)", "(Lyrics)", "(KARAOKE)", "HD", "4K", etc.
        4.  If the artist is a collaboration (e.g., "Artist A ft. Artist B"), list the primary artist.
        5.  You must always return a JSON object with non-empty strings for both "artist" and "title". Make your best guess based on the text provided. Do not leave any field blank.

        Example 1:
        Video Title: "Shakira - Waka Waka (This Time for Africa) (Official Video)"
        Expected Output: {"artist": "Shakira", "title": "Waka Waka (This Time for Africa)"}

        Example 2:
        Video Title: "Karaoke 🎤 Somebody That I Used To Know - Gotye"
        Expected Output: {"artist": "Gotye", "title": "Somebody That I Used To Know"}
        
        Example 3:
        Video Title: "Queen - Bohemian Rhapsody (Official Video Remastered)"
        Expected Output: {"artist": "Queen", "title": "Bohemian Rhapsody"}

        Example 4:
        Video Title: "lewis capaldi - someone you loved (lyrics) KARAOKE"
        Expected Output: {"artist": "Lewis Capaldi", "title": "Someone You Loved"}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        artist: {
                            type: Type.STRING,
                            description: "The name of the performing artist. Should not be an empty string."
                        },
                        title: {
                            type: Type.STRING,
                            description: "The title of the song. Should not be an empty string."
                        }
                    },
                    required: ["artist", "title"]
                }
            }
        });

        if (!response.text) {
            throw new Error("Recebida uma resposta vazia da IA para extração de detalhes da música.");
        }

        const details = JSON.parse(response.text);
        if (!details.artist || !details.title) {
            throw new Error("Não foi possível determinar o artista e o título a partir do vídeo.");
        }
        return details;

    } catch (error) {
        console.error("Error extracting song details from Gemini API:", error);
        throw new Error("Não foi possível extrair os detalhes da música. O serviço de IA pode estar indisponível ou o título é ambíguo.");
    }
}