import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import './App.css';

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
// List of images to preload, along with their types (extension)
const imagesToLoad = [
  { name: 'toast1', type: 'png' },
  { name: 'toast2', type: 'png' },
  { name: 'toast3', type: 'png' },
  { name: 'toast4', type: 'png' },
  { name: 'toaster1', type: 'png' },
  { name: 'toaster2', type: 'png' },
  { name: 'toaster3', type: 'png' },
  { name: 'toaster4', type: 'png' },
  { name: 'police', type: 'gif' }, // Special cop image
  { name: 'missing-toast', type: 'gif' }, // Image for missing toast
  { name: 'missing-toaster', type: 'gif' }, // Image for missing toaster
  { name: 'butter-bottom', type: 'png' }, // Bottom butter slice image
  { name: 'butter', type: 'png' },        // Top butter slice image
  { name: 'wingL', type: 'gif' },      // Left wing for toasters
  { name: 'wingR', type: 'gif' },      // Right wing for toasters
];

// Preload images to prevent flickering, with a callback once all images are loaded
function preloadImages(onLoadCallback) {
  let loadedCount = 0;
  const allImagesToLoad = [...imagesToLoad];
  if (config.christmasMode) {
    config.christmasToasters.forEach(name => {
      allImagesToLoad.push({ name, type: 'gif', path: `xmas/${name}.gif` });
    });
    allImagesToLoad.push({ name: 'santa', type: 'gif', path: 'xmas/santa.gif' });
  }
  allImagesToLoad.forEach(({ name, type, path }) => {
    const img = new Image();
    img.src = `${process.env.PUBLIC_URL}/${path || `${name}.${type}`}`; // Set the source for the image
    img.onload = () => {
      loadedCount++;
      if (loadedCount === allImagesToLoad.length) {
        onLoadCallback(); // All images loaded, trigger the callback
      }
    };
    img.onerror = () => {
      console.error(`Failed to load image: ${name}.${type}`); // Log if an image fails to load
    };
    imageCache[name] = img; // Cache the image
  });
}

// Function to play a random police sound (if in cops mode)
function playRandomPoliceSound() {
  const randomSoundIndex = Math.floor(Math.random() * config.totalPoliceSounds) + 1; // Random sound selection
  const sound = new Audio(`${process.env.PUBLIC_URL}/police-${randomSoundIndex}.wav`);
  sound.play().catch(error => console.log("Audio play failed:", error)); // Play the sound and handle any errors
}

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

// React component for each flying toast or toaster, rendered based on the data and settings
const FlyingItem = React.memo(({ data, type, size, initialDuration, delay, isMuted, isPaused }) => {
  const [position, setPosition] = useState(null); // Current position on the screen
  const [readyToAnimate, setReadyToAnimate] = useState(false); // Animation readiness state
  const [butterAdjusted, setButterAdjusted] = useState(false); // Whether butter adjustment has been applied
  const requestRef = useRef(null); // Animation frame request reference
  const startTimeRef = useRef(null); // Timestamp of animation start
  const [duration, setDuration] = useState(initialDuration); // Duration of the animation
  const [isZoomie, setIsZoomie] = useState(false); // Whether the item is a zoomie
  const [isCop, setIsCop] = useState(false); // Whether the item is a cop (if zoomie)
  const [hasButter, setHasButter] = useState(false); // Whether toast has butter
  const [butterSlices, setButterSlices] = useState(0); // Number of butter slices
  const [wingSyncUuid, setWingSyncUuid] = useState(uuidv4()); // UUID for syncing wing animation

  // Use useCallback to memoize the generateRandomPath function
  const generateRandomPath = useCallback(() => {
    const startFromTop = Math.random() < 0.5; // Randomly decide if starting from top or left
    let startX, startY, endX, endY;

    if (startFromTop) {
      // Start from the top
      startY = -size * 2;
      startX = Math.random() * window.innerWidth - size;
      endX = window.innerWidth + Math.random() * window.innerWidth / 2;
      endY = window.innerHeight - Math.random() * size / 2;
    } else {
      // Start from the left
      startX = -size * 2;
      startY = Math.random() * window.innerHeight - size;
      endX = window.innerWidth - Math.random() * size / 2;
      endY = window.innerHeight + Math.random() * window.innerHeight / 2;
    }

    return { startX, startY, endX, endY }; // Return the calculated start and end positions
  }, [size]); // Memoize with size as a dependency

  // Animation logic
  useEffect(() => {
    let { startX, startY, endX, endY } = generateRandomPath(); // Get a random path for the item
    let audioPlayed = false; // Track whether audio has been played for the cop

    const moveItem = (timestamp) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp; // Set the start time if not already set
      }

      const progress = (timestamp - startTimeRef.current) / duration; // Calculate progress based on time
      const currentX = startX + (endX - startX) * progress;
      const currentY = startY + (endY - startY) * progress;

      setPosition({ x: currentX, y: currentY }); // Update position

      // Play cop sound during the middle of the animation
      if (isCop && !audioPlayed && progress > 0.2 && progress < 0.8) {
        audioPlayed = true;
        if (currentX >= 0 && currentX <= window.innerWidth && currentY >= 0 && currentY <= window.innerHeight) {
          if (!isMuted) {
            playRandomPoliceSound(); // Play sound if not muted
          }
        }
      }

      if (progress < 1) {
        // Continue animation if not complete
        if (!isPaused) {
          requestRef.current = requestAnimationFrame(moveItem); // Request the next animation frame
        }
      } else {
        // Reset for the next animation cycle
        startTimeRef.current = null;
        audioPlayed = false;
        const newPath = generateRandomPath(); // Get a new path
        startX = newPath.startX;
        startY = newPath.startY;
        endX = newPath.endX;
        endY = newPath.endY;

        setWingSyncUuid(uuidv4()); // Update UUID for wings to ensure sync

        const zoomieChance = Math.random() < 1 / config.zoomiesFreq; // Determine if the item should be a zoomie
        setIsZoomie(zoomieChance);
        setDuration(zoomieChance
          ? (Math.random() * (config.durationMax - config.durationMin) + config.durationMin) / 3
          : Math.random() * (config.durationMax - config.durationMin) + config.durationMin
        );

        if (zoomieChance && config.copsAndRobbers && Math.random() < 1 / config.copsFreq) {
          setIsCop(true); // Mark as a cop if it meets conditions
          setButterSlices(0); // No butter for cops
        } else {
          setIsCop(false);
          const butterChance = config.butterChance > 0 && Math.random() < 1 / config.butterChance; // Determine if the item gets butter
          if (butterChance && type === 'toast') {
            setHasButter(true);
            if (zoomieChance) {
              const maxSlices = Math.floor(Math.random() * config.butterMaxSlices) + 1; // Random number of butter slices
              setButterSlices(maxSlices);
            } else {
              setButterSlices(0);
            }
          } else {
            setHasButter(false);
            setButterSlices(0);
          }
        }

        if (!isPaused) {
          requestRef.current = requestAnimationFrame(moveItem); // Continue the animation
        }
      }
    };

    const delayTimeout = setTimeout(() => {
      setReadyToAnimate(true); // Mark the item ready for animation
      requestRef.current = requestAnimationFrame(moveItem); // Start animation
    }, delay);

    return () => {
      cancelAnimationFrame(requestRef.current); // Clean up animation frame requests
      clearTimeout(delayTimeout); // Clean up the delay timeout
    };
  }, [size, duration, delay, isMuted, isPaused, generateRandomPath, isCop, type]); // Include the missing dependencies here

  // Adjust the butter alignment after 0.5 seconds if butter is present
  useEffect(() => {
    if (hasButter && !butterAdjusted) {
      const butterAdjustmentTimeout = setTimeout(() => {
        setButterAdjusted(true); // Mark the butter as adjusted
      }, 500);

      return () => clearTimeout(butterAdjustmentTimeout); // Clean up timeout
    }
  }, [hasButter, butterAdjusted]);

  // Determine the image type based on CPU usage and type (toast or toaster)
  const imgType = useMemo(() => {
    if (config.christmasMode) {
      if (Math.random() < config.santaFreq) {
        return 'santa';
      } else {
        return config.christmasToasters[Math.floor(Math.random() * config.christmasToasters.length)];
      }
    }
    if (data.cpuUsage === '4040404') {
      return type === 'toast' ? 'missing-toast' : 'missing-toaster'; // Special case for missing data
    }

    const usageRatio = type === 'toast' ? data.cpuUsage / config.maxCpuToast : data.cpuUsage;
    if (usageRatio < 0.25) return `${type}1`;
    if (usageRatio < 0.5) return `${type}2`;
    if (usageRatio < 0.75) return `${type}3`;
    return `${type}4`; // Determine which image to use based on usage ratio
  }, [data.cpuUsage, type]); // Memoize with dependencies

  if (!readyToAnimate || position === null) {
    return null; // Do not render if not ready or position is not set
  }

  const wingSyncUrl = `${process.env.PUBLIC_URL}/wingSIDE.gif?${wingSyncUuid}`; // Synchronized wing animation URL

  return (
    <div
      className="item"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`, // Set position for animation
        zIndex: Math.floor(config.maxSizeToaster - size), // Use size to determine z-index
      }}
    >
      {isCop && (
        <img
          src={imageCache['police'].src}
          alt="Cop"
          style={{
            width: `${size * 0.85}px`,
            position: 'absolute',
            top: `-${size * 0.2}px`,
            zIndex: Math.floor(config.maxSizeToaster - size) - 1, // Render cop image below the main item
          }}
        />
      )}

      {type === 'toaster' && (
        <>
          <img
            src={wingSyncUrl.replace('wingSIDE', 'wingL')}
            alt="Left Wing"
            style={{
              width: `${size}px`,
              position: 'absolute',
              left: `-${size * 0.4}px`,
              top: `${size * 0.1}px`,
              zIndex: Math.floor(config.maxSizeToaster - size) + 1, // Render left wing above toaster
            }}
          />
          <img
            src={wingSyncUrl.replace('wingSIDE', 'wingR')}
            alt="Right Wing"
            style={{
              width: `${size * 0.8}px`,
              position: 'absolute',
              right: `-${size * 0.4}px`,
              top: `${size * -0.4}px`,
              zIndex: -10, // Render right wing below toaster
            }}
          />
        </>
      )}

      {hasButter && (
        <img
          src={imageCache['butter-bottom'].src}
          alt="Butter Bottom"
          style={{
            width: `${size * 0.6}px`,
            position: 'absolute',
            bottom: `50%`, // Position butter bottom halfway up
          }}
        />
      )}

      <img 
        src={imageCache[imgType].src} 
        alt={imgType} 
        style={{ width: `${imgType === 'santa' ? size * 1.2 : size}px` }} // Render the main image
      />

      {hasButter && Array(butterSlices).fill(null).map((_, i) => (
        <img
          key={i}
          src={imageCache['butter'].src}
          alt="Butter Slice"
          style={{
            width: `${size * 0.6}px`,
            position: 'absolute',
            bottom: `${size * 0.65 + (i * (size * 0.05))}px`, // Stack butter slices
          }}
        />
      ))}

      {config.showLabels && (
        <div className="label">
          {data.name}<br />({data.namespace || `${data.cpuUsage} / ${data.memoryUsage}`})
          {isZoomie && <div className="zoomieLabel">ZOOOMING</div>}
        </div>
      )}
    </div>
  );
});

function App() {
  const [dataQueue, setDataQueue] = useState({ pods: [], nodes: [] }); // State for holding pod and node data
  const [lastUpdated, setLastUpdated] = useState(null); // Track when data was last updated
  const [imagesLoaded, setImagesLoaded] = useState(false); // Check if images are preloaded
  const [isMuted, setIsMuted] = useState(true); // Audio is initially muted
  const [isPaused, setIsPaused] = useState(false); // Animation is initially not paused

  const unmuteAudio = () => {
    setIsMuted(false); // Unmute audio
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
      preloadImages(() => setImagesLoaded(true)); // Preload images and mark as loaded

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

      {config.christmasMode && (
        <div className="snow">
          {Array.from({ length: 50 }, (_, i) => (
            <div
              key={i}
              className="snowflake"
              style={{
                left: `${Math.random() * 100}%`,
                animationDuration: `${Math.random() * 10 + 10}s`,
                animationDelay: `${Math.random() * 10}s`,
              }}
            >
              ❄
            </div>
          ))}
        </div>
      )}

      {dataQueue.pods.map((pod, index) => {
        const initialDuration = Math.random() * (config.durationMax - config.durationMin) + config.durationMin; // Randomize animation duration
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
          />
        );
      })}

      {dataQueue.nodes.map((node, index) => {
        const initialDuration = Math.random() * (config.durationMax - config.durationMin) + config.durationMin; // Randomize animation duration
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
