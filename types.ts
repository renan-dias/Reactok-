
export enum AppState {
  HOME = 'HOME',
  LOADING_LYRICS = 'LOADING_LYRICS',
  KARAOKE = 'KARAOKE',
  SCORE = 'SCORE',
}

export interface SongDetails {
  artist: string;
  title: string;
  youtubeUrl: string;
}

export interface LyricLine {
  text: string;
  startTime: number;
  endTime: number;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
}

// Type declarations for the YouTube Iframe Player API (YT).
// The YouTube player API is loaded from an external script, so its types are not
// available to TypeScript by default. Placing them here makes them accessible
// across the application.
declare global {
  namespace YT {
    export class Player {
      constructor(id: string, options: any);
      getCurrentTime(): number;
      playVideo(): void;
      pauseVideo(): void;
      destroy(): void;
      // FIX: Add getPlayerState to the Player type definition.
      getPlayerState(): PlayerState;
    }
    
    export enum PlayerState {
      UNSTARTED = -1,
      ENDED = 0,
      PLAYING = 1,
      PAUSED = 2,
      BUFFERING = 3,
      CUED = 5,
    }
  
    export interface PlayerEvent {
      target: Player;
      data: any;
    }
    
    export interface OnErrorEvent extends PlayerEvent {
      data: number; // Error code
    }
  
    export interface OnStateChangeEvent extends PlayerEvent {
      data: PlayerState;
    }
  }
}
