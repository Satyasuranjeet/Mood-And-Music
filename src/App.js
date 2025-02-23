import React, { useState, useRef, useEffect } from 'react';
import { Camera, StopCircle, Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Repeat, Shuffle } from 'lucide-react';

const formatTime = (time) => {
  if (time === null || isNaN(time)) return '0:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const MoodMusicPlayer = () => {
  const [currentSong, setCurrentSong] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [mood, setMood] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isStreamStarted, setIsStreamStarted] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const progressRef = useRef(null);

  // Get high quality download URL
  const getHighQualityUrl = (song) => {
    if (song.downloadUrl) {
      const highQualityDownload = song.downloadUrl.find(
        download => download.quality === '320kbps'
      );
      return highQualityDownload ? highQualityDownload.url : null;
    }
    return null;
  };

  const processSongData = (song) => {
    return {
      ...song,
      mp3_url: getHighQualityUrl(song)
    };
  };

  const moodToGenre = {
    happy: ['pop', 'dance', 'upbeat'],
    sad: ['ballad', 'acoustic', 'melancholic'],
    angry: ['rock', 'metal', 'intense'],
    neutral: ['indie', 'alternative', 'ambient'],
    surprised: ['electronic', 'experimental', 'energetic'],
    fearful: ['ambient', 'classical', 'calm'],
    disgusted: ['punk', 'grunge', 'heavy']
  };

  const moodMessages = {
    happy: "You're looking happy! Here are some upbeat tunes to keep the good vibes going! 🎵",
    sad: "Feeling blue? These soulful melodies might help lift your spirits 🎵",
    angry: "Let's channel that energy with some powerful tracks! 🎸",
    neutral: "Here's a balanced mix of tunes for your relaxed mood 🎵",
    surprised: "Wow! Here's some exciting music to match your mood! ✨",
    fearful: "Here are some calming tunes to help you feel more at ease 🎵",
    disgusted: "Let's turn that mood around with some energetic tracks! 🎵"
  };

  // Audio Control Functions
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleProgressClick = (e) => {
    if (progressRef.current && audioRef.current) {
      const rect = progressRef.current.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / progressRef.current.offsetWidth;
      audioRef.current.currentTime = pos * audioRef.current.duration;
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const playNextSong = () => {
    if (searchResults.length > 0) {
      const currentIndex = searchResults.findIndex(song => song.id === currentSong.id);
      const nextIndex = isShuffle 
        ? Math.floor(Math.random() * searchResults.length)
        : (currentIndex + 1) % searchResults.length;
      handleSongSelect(searchResults[nextIndex]);
    }
  };

  const playPreviousSong = () => {
    if (searchResults.length > 0) {
      const currentIndex = searchResults.findIndex(song => song.id === currentSong.id);
      const prevIndex = currentIndex === 0 ? searchResults.length - 1 : currentIndex - 1;
      handleSongSelect(searchResults[prevIndex]);
    }
  };

  // Camera Functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreamStarted(true);
        setMessage('Camera started! Click capture when ready.');
      }
    } catch (error) {
      console.error('Error accessing webcam:', error);
      setMessage('Failed to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsStreamStarted(false);
    }
  };

  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsLoading(true);
    setMessage('Analyzing your mood...');

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append('image', blob, 'capture.jpg');

      try {
        const response = await fetch('http://192.168.1.13:5000/detect_emotion', {
          method: 'POST',
          body: formData
        });
        const data = await response.json();
        setMood(data.mood);
        setMessage(moodMessages[data.emotion] || "Here's some music for you! 🎵");
        handleSearch(moodToGenre[data.emotion]?.[0] || 'pop');
        stopCamera();
      } catch (error) {
        console.error('Error detecting mood:', error);
        setMessage('Failed to detect mood. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }, 'image/jpeg');
  };

  const handleSearch = async (query) => {
    try {
      const response = await fetch(`https://saavn.dev/api/search/songs?query=${query}`);
      const data = await response.json();
      if (data.data && data.data.results) {
        const processedSongs = data.data.results
          .map(processSongData)
          .filter(song => song.mp3_url);
        setSearchResults(processedSongs);
      }
    } catch (error) {
      console.error('Error searching songs:', error);
      setMessage('Failed to fetch songs. Please try again.');
    }
  };

  const handleSongSelect = (song) => {
    const processedSong = processSongData(song);
    if (processedSong.mp3_url) {
      setCurrentSong(processedSong);
      setIsPlaying(true);
    } else {
      setMessage('High quality version not available for this song.');
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Handle song end
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onended = () => {
        if (isRepeat) {
          audioRef.current.currentTime = 0;
          audioRef.current.play();
        } else {
          playNextSong();
        }
      };
    }
  }, [isRepeat, currentSong]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 pb-40">
      {/* Camera Section */}
      <div className="bg-gray-800 rounded-lg shadow-lg mb-6 p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-full max-w-md mx-auto">
            <video 
              ref={videoRef}
              autoPlay 
              playsInline
              className={`w-full rounded-lg ${isStreamStarted ? 'block' : 'hidden'}`}
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="flex gap-4">
            {!isStreamStarted ? (
              <button 
                onClick={startCamera}
                className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition duration-200"
                disabled={isLoading}
              >
                <Camera className="mr-2" />
                Start Camera
              </button>
            ) : (
              <>
                <button 
                  onClick={captureImage}
                  className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition duration-200"
                  disabled={isLoading}
                >
                  <Camera className="mr-2" />
                  Capture
                </button>
                <button 
                  onClick={stopCamera}
                  className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition duration-200"
                  disabled={isLoading}
                >
                  <StopCircle className="mr-2" />
                  Stop Camera
                </button>
              </>
            )}
          </div>

          {message && (
            <div className="text-lg text-center p-4 rounded-lg bg-gray-700">
              {message}
            </div>
          )}
        </div>
      </div>

      {/* Songs Section */}
      <div className="bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4">
          {mood ? `Songs for your ${mood} mood` : 'Songs will appear here'}
        </h2>
        <div className="space-y-2">
          {searchResults.map((song) => (
            <div
              key={song.id}
              onClick={() => handleSongSelect(song)}
              className={`flex items-center gap-2 p-2 hover:bg-gray-700 rounded-lg cursor-pointer transition duration-200 
                ${currentSong?.id === song.id ? 'bg-gray-700' : ''}`}
            >
              <img 
                src={song.image?.[0]?.url || "/api/placeholder/40/40"} 
                alt={song.name}
                className="w-10 h-10 rounded-lg"
              />
              <div>
                <p className="font-medium">{song.name}</p>
                <p className="text-sm text-gray-400">
                  {song.artists?.primary?.[0]?.name}
                  <span className="ml-2 text-green-400">320kbps</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Player Section */}
      {currentSong && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800 p-4 shadow-lg">
          <div className="max-w-7xl mx-auto">
            {/* Progress Bar */}
            <div 
              ref={progressRef}
              className="h-1 w-full bg-gray-600 rounded-full mb-4 cursor-pointer"
              onClick={handleProgressClick}
            >
              <div 
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
            </div>

            <div className="flex items-center gap-4">
              <img 
                src={currentSong.image?.[0]?.url || "/api/placeholder/100/100"} 
                alt={currentSong.name}
                className="w-16 h-16 rounded-lg"
              />
              
              <div className="flex-1">
                <h3 className="text-xl font-bold">{currentSong.name}</h3>
                <p className="text-gray-400">
                  {currentSong.artists?.primary?.[0]?.name}
                  <span className="ml-2 text-green-400">320kbps</span>
                </p>
              </div>

              {/* Time Display */}
              <div className="text-sm text-gray-400">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsShuffle(!isShuffle)}
                  className={`p-2 rounded-full ${isShuffle ? 'text-blue-500' : 'text-gray-400'} hover:bg-gray-700`}
                >
                  <Shuffle size={20} />
                </button>
                
                <button 
                  onClick={playPreviousSong}
                  className="p-2 rounded-full text-gray-400 hover:bg-gray-700"
                >
                  <SkipBack size={24} />
                </button>
                  <button
                  onClick={togglePlay}
                  className="p-3 bg-blue-600 hover:bg-blue-700 rounded-full"
                >
                  {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                </button>

                <button 
                  onClick={playNextSong}
                  className="p-2 rounded-full text-gray-400 hover:bg-gray-700"
                >
                  <SkipForward size={24} />
                </button>

                <button 
                  onClick={() => setIsRepeat(!isRepeat)}
                  className={`p-2 rounded-full ${isRepeat ? 'text-blue-500' : 'text-gray-400'} hover:bg-gray-700`}
                >
                  <Repeat size={20} />
                </button>

                {/* Volume Control */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleMute}
                    className="p-2 rounded-full text-gray-400 hover:bg-gray-700"
                  >
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-24 accent-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Hidden Audio Element */}
          <audio
            ref={audioRef}
            src={currentSong.mp3_url}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={playNextSong}
          />
        </div>
      )}
    </div>
  );
};

export default MoodMusicPlayer;