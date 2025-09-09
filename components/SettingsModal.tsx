import React, { useState, useEffect, useRef } from 'react';

interface MicVisualizerProps {
    stream: MediaStream | null;
}

const MicVisualizer: React.FC<MicVisualizerProps> = ({ stream }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!stream || !canvasRef.current) return;

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext('2d');
        if(!canvasCtx) return;

        let animationFrameId: number;

        const draw = () => {
            animationFrameId = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            canvasCtx.fillStyle = 'rgb(22 22 30)';
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2;
                
                const gradient = canvasCtx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
                gradient.addColorStop(0, '#f472b6'); // pink-400
                gradient.addColorStop(1, '#a855f7'); // purple-500

                canvasCtx.fillStyle = gradient;
                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }
        };

        draw();

        return () => {
            cancelAnimationFrame(animationFrameId);
            source.disconnect();
            audioContext.close();
        };
    }, [stream]);

    return <canvas ref={canvasRef} width="300" height="100" className="rounded-lg bg-gray-900"></canvas>;
};


interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeviceSelect: (deviceId: string) => void;
  currentDeviceId: string | null;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onDeviceSelect, currentDeviceId }) => {
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [testStream, setTestStream] = useState<MediaStream | null>(null);

    useEffect(() => {
        if (isOpen) {
            navigator.mediaDevices.enumerateDevices()
                .then(allDevices => {
                    const audioDevices = allDevices.filter(device => device.kind === 'audioinput');
                    setDevices(audioDevices);
                });
        }
    }, [isOpen]);

    const handleDeviceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const deviceId = e.target.value;
        onDeviceSelect(deviceId);
        
        // Start a test stream to visualize
        if (testStream) {
            testStream.getTracks().forEach(track => track.stop());
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
            setTestStream(stream);
        } catch (error) {
            console.error("Failed to get test stream", error);
        }
    };
    
    useEffect(() => {
        // Cleanup test stream on close
        return () => {
             if (testStream) {
                testStream.getTracks().forEach(track => track.stop());
            }
        }
    }, [testStream]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-gray-800 border border-purple-700 rounded-2xl shadow-lg p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-white mb-4">Configurações</h2>
                
                <div className="mb-6">
                    <label htmlFor="mic-select" className="block text-sm font-medium text-purple-300 mb-2">Microfone</label>
                    <select 
                        id="mic-select"
                        value={currentDeviceId || ''}
                        onChange={handleDeviceChange}
                        className="w-full p-3 bg-gray-900 border-2 border-purple-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none"
                    >
                        {devices.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>
                                {device.label || `Microfone ${devices.indexOf(device) + 1}`}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="mb-6">
                    <p className="block text-sm font-medium text-purple-300 mb-2">Teste do Microfone</p>
                    <MicVisualizer stream={testStream} />
                </div>

                <button 
                    onClick={onClose}
                    className="w-full text-lg font-bold py-3 px-8 rounded-lg bg-pink-600 hover:bg-pink-700 transition-all duration-300 transform hover:scale-105"
                >
                    Fechar
                </button>
            </div>
        </div>
    );
};

export default SettingsModal;