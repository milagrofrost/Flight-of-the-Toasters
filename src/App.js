import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import FlyingItem, { setGlobals as setFlyingItemGlobals } from './components/FlyingItem';
import * as NormalMode from './modes/NormalMode';
import * as ChristmasMode from './modes/ChristmasMode';
// Default configuration settings. These will be overridden if config.json is present
let config = {
  showLabels: true,          // Show labels for items (pod/node names and namespaces)
  showStatus: true,          // Show status information (CPU and memory usage)
  remoteDataUrl: 'https://flyingk8s.milagrofrost.com/flyingk8s.json', // URL to fetch data from
  updateInterval: 60000,     // Interval for updating data (milliseconds)
  staggerInterval: 500,      // Delay between each item entering the screen (milliseconds)
  durationMin: 15000,        // Minimum animation duration (milliseconds)
  durationMax: 20000,        // Maximum animation duration (milliseconds)
  minSizeToaster: 200,       // Minimum size of toaster images (pixels)
  maxSizeToaster: 600,       // Maximum size of toaster images (pixels)
  minSizeToast: 100,         // Minimum size of toast images (pixels)
  maxSizeToast: 400,         // Maximum size of toast images (pixels)
  maxMemoryToast: 1000,      // Maximum memory for toasts, used for scaling size
  maxCpuToast: 100,          // Maximum CPU usage for toast, used to determine image
  zoomiesFreq: 10,           // Frequency of zoomies (1 in 'zoomiesFreq' chance)
  copsFreq: 5,               // Frequency of cops among zoomies (1 in 'copsFreq' zoomies will be a cop)
  copsAndRobbers: true,      // Enable cops and robbers mode if set to true
  butterChance: 5,           // Chance of a toast getting butter (1 in 'butterChance' chance)
  butterMaxSlices: 10,       // Maximum number of butter slices for non-cop zoomies
  copSoundChance: 5,         // Chance of a cop triggering a sound (1 in 'copSoundChance' chance)
  totalPoliceSounds: 14,     // Number of police sounds available (police-1.wav to police-14.wav)
  excludeNamespaces: ['argocd'], // Namespaces to exclude from display
  christmasMode: false,      // Enable Christmas mode
  christmasToasters: [],     // List of Christmas toaster images
  santaFreq: 0.1,            // Frequency of Santa appearing
};

// Function to load configuration from a specified config.json file based on the query parameter
async function loadConfig() {
  try {
    // Get the config file name from the query parameter, default to "config.json"
    const urlParams = new URLSearchParams(window.location.search);
    const configFile = urlParams.get('configFile') || 'default';

    // Fetch the specified configuration file
    const response = await fetch(`${process.env.PUBLIC_URL}/configs/${configFile}.json`);
    if (!response.ok) throw new Error(`Failed to load ${configFile}.json`);
    const jsonConfig = await response.json();

    // Override the default config with values from the specified config.json
    config = { ...config, ...jsonConfig };
    console.log(`Loaded config from ${configFile}`);
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

// Cache for preloading images to prevent flickering during animations
const imageCache = {};

// Function to fetch data from the remote URL, with a fallback to local data if it fails
async function fetchData() {
  if (!config.remoteDataUrl) {
    // Directly use local data if no remote URL
    try {
      const localResponse = await fetch(`${process.env.PUBLIC_URL}/local-fallback.json`);
      if (!localResponse.ok) throw new Error('Local file response was not ok');
      const localData = await localResponse.json();
      return { data: localData, source: 'local' };
    } catch (localError) {
      console.error('Error fetching local data:', localError);
      return { data: { pods: [], nodes: [], timestamp: null }, source: 'none' };
    }
  }
  try {
    const response = await fetch(config.remoteDataUrl); // Try fetching from the remote URL
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    return { data, source: 'remote' }; // Return the fetched data along with the source information
  } catch (error) {
    console.error('Error fetching remote data:', error); // Log error if remote fetch fails

    // Fallback to local data
    try {
      const localResponse = await fetch(`${process.env.PUBLIC_URL}/local-fallback.json`);
      if (!localResponse.ok) throw new Error('Local file response was not ok');
      const localData = await localResponse.json();
      return { data: localData, source: 'local' }; // Return local data if the fallback succeeds
    } catch (localError) {
      console.error('Error fetching local data:', localError); // Log if local fetch fails as well
      // Return empty default data if both fetches fail
      return { data: { pods: [], nodes: [], timestamp: null }, source: 'none' };
    }
  }
}

function App() {
  const [dataQueue, setDataQueue] = useState({ pods: [], nodes: [] }); // State for holding pod and node data
  const [lastUpdated, setLastUpdated] = useState(null); // Track when data was last updated
  const [imagesLoaded, setImagesLoaded] = useState(false); // Check if images are preloaded
  const [isMuted, setIsMuted] = useState(true); // Audio is initially muted
  const [isPaused, setIsPaused] = useState(false); // Animation is initially not paused
  const audioRef = useRef(null); // Ref for background music

  const unmuteAudio = () => {
    setIsMuted(false); // Unmute audio
    if (config.christmasMode && audioRef.current) {
      audioRef.current.play().catch(error => console.log("Audio play failed:", error)); // Play Christmas music
    }
  };

  // Handle 'p' key to toggle pause state
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'p' || event.key === 'P') {
        setIsPaused((prev) => !prev); // Toggle pause state
      }
      if (event.key === 'm' || event.key === 'M') {
        setIsMuted((prev) => !prev); // Toggle mute state
      }
    };

    window.addEventListener('keydown', handleKeyPress); // Add event listener for key press

    return () => {
      window.removeEventListener('keydown', handleKeyPress); // Clean up event listener
    };
  }, []);

  // Load configuration, preload images, and start fetching data
  useEffect(() => {
    const initApp = async () => {
      await loadConfig(); // Load the configuration settings
      const mode = config.christmasMode ? ChristmasMode : NormalMode;
      setFlyingItemGlobals(config, imageCache);
      mode.setGlobals(config, imageCache);
      mode.preloadImages(() => setImagesLoaded(true)); // Preload images and mark as loaded

      // Fetch data and update state
      const fetchDataAndUpdate = async () => {
        const { data, source } = await fetchData(); // Fetch data from remote or local source
        if (data.timestamp !== lastUpdated) {
          setDataQueue({
            pods: data.pods.filter(pod => !config.excludeNamespaces.includes(pod.namespace)), // Filter out excluded namespaces
            nodes: data.nodes,
          });
          setLastUpdated(`${data.timestamp} (${source})`); // Update the timestamp with source info
        }
      };

      fetchDataAndUpdate(); // Initial data fetch
      const interval = setInterval(fetchDataAndUpdate, config.updateInterval); // Set interval for updating data

      return () => clearInterval(interval); // Clean up interval on unmount
    };

    initApp(); // Initialize the app on component mount
  }, [lastUpdated]);

  if (!imagesLoaded || !lastUpdated) {
    return <div>Loading...</div>; // Show loading message if images or data are not ready
  }

  return (
    <div className="App" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/background.png)`, backgroundPosition: 'center', backgroundRepeat: 'repeat' }}>
      {isMuted && (
        <button onClick={unmuteAudio} className="unmute-button">
          Unmute 
        </button>
      )}

      {config.christmasMode && <audio ref={audioRef} src={`${process.env.PUBLIC_URL}/xmas/white-christmas.mp3`} loop />}

      {config.christmasMode && <ChristmasMode.Snow />}

      {dataQueue.pods.map((pod, index) => {
        const initialDuration = Math.random() * (config.durationMax - config.durationMin) + config.durationMin; // Randomize animation duration
        const mode = config.christmasMode ? ChristmasMode : NormalMode;
        return (
          <FlyingItem
            key={index}
            data={pod}
            type="toast"
            size={Math.min((pod.memoryUsage / config.maxMemoryToast) * (config.maxSizeToast - config.minSizeToast) + config.minSizeToast, config.maxSizeToast)} // Scale size based on memory usage
            initialDuration={initialDuration}
            delay={index * config.staggerInterval} // Stagger animations
            isMuted={isMuted}
            isPaused={isPaused}
            chooseImageType={mode.chooseImageType}
          />
        );
      })}

      {dataQueue.nodes.map((node, index) => {
        const initialDuration = Math.random() * (config.durationMax - config.durationMin) + config.durationMin; // Randomize animation duration
        const mode = config.christmasMode ? ChristmasMode : NormalMode;
        return (
          <FlyingItem
            key={index + 1000}
            data={node}
            type="toaster"
            size={Math.min(node.memoryUsage * (config.maxSizeToaster - config.minSizeToaster) + config.minSizeToaster, config.maxSizeToaster)} // Scale size based on memory usage
            initialDuration={initialDuration}
            delay={index * config.staggerInterval * 5} // Larger delay for nodes
            isMuted={isMuted}
            isPaused={isPaused}
            chooseImageType={mode.chooseImageType}
          />
        );
      })}

      {config.showStatus && (
        <div className="dateUpdated">
          Last Updated: {lastUpdated} 
        </div>
      )}
    </div>
  );
}

export default App;
