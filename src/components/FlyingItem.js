import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Global variables (will be set from App.js)
let config = {};
let imageCache = {};

// Function to play a random police sound (if in cops mode)
function playRandomPoliceSound() {
  const randomSoundIndex = Math.floor(Math.random() * config.totalPoliceSounds) + 1; // Random sound selection
  const sound = new Audio(`${process.env.PUBLIC_URL}/police-${randomSoundIndex}.wav`);
  sound.play().catch(error => console.log("Audio play failed:", error)); // Play the sound and handle any errors
}

// Set global config and imageCache
export function setGlobals(cfg, imgCache) {
  config = cfg;
  imageCache = imgCache;
}

// React component for each flying toast or toaster, rendered based on the data and settings
const FlyingItem = React.memo(({ data, type, size, initialDuration, delay, isMuted, isPaused, chooseImageType }) => {
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
  const imgType = useMemo(() => chooseImageType(data, type), [data, type, chooseImageType]);

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

export default FlyingItem;
