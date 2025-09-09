import { useState, useEffect, useRef } from 'react';

interface PitchDetectionOptions {
    deviceId: string | null;
}

// Simple autocorrelation algorithm to find the fundamental frequency
const findFundamentalFreq = (buffer: Float32Array, sampleRate: number): number => {
    const threshold = 0.1;
    let bestCorrelation = 0;
    let bestOffset = -1;

    for (let offset = 80; offset < buffer.length / 2; offset++) {
        let correlation = 0;
        for (let i = 0; i < buffer.length / 2; i++) {
            correlation += buffer[i] * buffer[i + offset];
        }
        correlation /= buffer.length / 2;
        if (correlation > bestCorrelation) {
            bestCorrelation = correlation;
            bestOffset = offset;
        }
    }

    if (bestCorrelation > threshold) {
        return sampleRate / bestOffset;
    }
    return 0; // No clear pitch
};

export const usePitchDetection = ({ deviceId }: PitchDetectionOptions) => {
    const [userPitch, setUserPitch] = useState(0);
    const [micVolume, setMicVolume] = useState(0);
    const [isMicReady, setIsMicReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationFrameId = useRef<number>(0);

    useEffect(() => {
        const setupMic = async () => {
            try {
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                }
                
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        deviceId: deviceId ? { exact: deviceId } : undefined,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                });

                streamRef.current = stream;

                if (!audioContextRef.current) {
                    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                }
                const audioContext = audioContextRef.current;
                
                if (!analyserRef.current) {
                    analyserRef.current = audioContext.createAnalyser();
                    analyserRef.current.fftSize = 2048;
                }
                const analyser = analyserRef.current;
                
                sourceNodeRef.current = audioContext.createMediaStreamSource(stream);
                sourceNodeRef.current.connect(analyser);

                setIsMicReady(true);
                setError(null);

                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Float32Array(bufferLength);
                const volumeArray = new Uint8Array(bufferLength);

                const processAudio = () => {
                    analyser.getFloatTimeDomainData(dataArray);
                    analyser.getByteFrequencyData(volumeArray);

                    // Calculate volume
                    let sum = 0;
                    for (const amplitude of volumeArray) {
                        sum += amplitude * amplitude;
                    }
                    const rms = Math.sqrt(sum / volumeArray.length) / 128.0; // Normalize to 0-1
                    setMicVolume(rms);

                    // Calculate pitch
                    const fundamentalFreq = findFundamentalFreq(dataArray, audioContext.sampleRate);
                    // Map frequency to a 0-100 scale (very simplified for this game)
                    // Let's say 100Hz = 0, 500Hz = 100
                    const pitchValue = Math.max(0, Math.min(100, (fundamentalFreq - 100) / 4));
                    
                    setUserPitch(rms > 0.01 ? pitchValue : 50); // if quiet, center the pitch

                    animationFrameId.current = requestAnimationFrame(processAudio);
                };

                processAudio();

            } catch (err) {
                console.error("Error accessing microphone:", err);
                setError("Acesso ao microfone negado.");
                setIsMicReady(false);
            }
        };

        setupMic();

        return () => {
            cancelAnimationFrame(animationFrameId.current);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (sourceNodeRef.current) {
                sourceNodeRef.current.disconnect();
            }
        };
    }, [deviceId]);

    return { userPitch, micVolume, isMicReady, error };
};