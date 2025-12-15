import React from 'react';

// Christmas mode logic
let config = {};
let imageCache = {};

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
  config.christmasToasters.forEach(name => {
    allImagesToLoad.push({ name, type: 'gif', path: `xmas/${name}.gif` });
  });
  allImagesToLoad.push({ name: 'santa', type: 'gif', path: 'xmas/santa.gif' });
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

// Choose image type for Christmas mode
function chooseImageType(data, type) {
  if (Math.random() < config.santaFreq) {
    return 'santa';
  } else {
    return config.christmasToasters[Math.floor(Math.random() * config.christmasToasters.length)];
  }
}

// Snow component for Christmas mode
const Snow = () => (
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
);

// Set global config and imageCache
export function setGlobals(cfg, imgCache) {
  config = cfg;
  imageCache = imgCache;
}

export { preloadImages, chooseImageType, Snow };