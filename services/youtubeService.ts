import type { YouTubeVideo } from '../types';

const API_BASE_URL = 'https://www.googleapis.com/youtube/v3/search';

// AVISO: Para sua segurança, use variáveis de ambiente para a chave da API do YouTube.
const API_KEY = process.env.YOUTUBE_API_KEY || "";

export async function searchVideos(query: string): Promise<YouTubeVideo[]> {
    // Adicionado videoEmbeddable=true e "lyrics" na busca para melhorar a qualidade dos resultados
    const searchQuery = `${query} karaoke lyrics`;
    const url = `${API_BASE_URL}?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&videoEmbeddable=true&maxResults=10&key=${API_KEY}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Erro na API do YouTube:', errorData);
            const message = errorData?.error?.message ?? 'Falha ao buscar vídeos do YouTube.';
            // Verifica erro de cota excedida
            if (message.toLowerCase().includes('quota')) {
                 throw new Error('A cota de busca do YouTube foi excedida. Por favor, tente novamente mais tarde.');
            }
            throw new Error(message);
        }
        const data = await response.json();
        
        if (!data.items || data.items.length === 0) {
            return [];
        }

        return data.items.map((item: any) => ({
            id: item.id.videoId,
            title: item.snippet.title,
            channelTitle: item.snippet.channelTitle,
            thumbnailUrl: item.snippet.thumbnails.high.url,
        }));

    } catch (error) {
        console.error('Erro ao procurar vídeos:', error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Ocorreu um erro inesperado ao procurar por vídeos.');
    }
}