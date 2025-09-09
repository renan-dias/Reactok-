import { GoogleGenAI, Type } from "@google/genai";

// Assume process.env.API_KEY is available
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    throw new Error("API_KEY is not set in environment variables.");
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
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                // Setting a higher temperature to encourage more creative/accurate timing guesses
                temperature: 0.2, 
            }
        });

        if (!response.text) {
            throw new Error("Recebida uma resposta vazia da IA.");
        }
        
        return response.text.trim();
    } catch (error) {
        console.error("Error fetching lyrics from Gemini API:", error);
        throw new Error("Não foi possível obter as letras. O serviço de IA pode estar indisponível.");
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