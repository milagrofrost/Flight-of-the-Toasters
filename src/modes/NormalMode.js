// Normal mode logic
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
  imagesToLoad.forEach(({ name, type }) => {
    const img = new Image();
    img.src = `${process.env.PUBLIC_URL}/${name}.${type}`; // Set the source for the image
    img.onload = () => {
      loadedCount++;
      if (loadedCount === imagesToLoad.length) {
        onLoadCallback(); // All images loaded, trigger the callback
      }
    };
    img.onerror = () => {
      console.error(`Failed to load image: ${name}.${type}`); // Log if an image fails to load
    };
    imageCache[name] = img; // Cache the image
  });
}

// Choose image type for normal mode
function chooseImageType(data, type) {
  if (data.cpuUsage === '4040404') {
    return type === 'toast' ? 'missing-toast' : 'missing-toaster'; // Special case for missing data
  }

  const usageRatio = type === 'toast' ? data.cpuUsage / config.maxCpuToast : data.cpuUsage;
  if (usageRatio < 0.25) return `${type}1`;
  if (usageRatio < 0.5) return `${type}2`;
  if (usageRatio < 0.75) return `${type}3`;
  return `${type}4`; // Determine which image to use based on usage ratio
}

// Set global config and imageCache
export function setGlobals(cfg, imgCache) {
  config = cfg;
  imageCache = imgCache;
}

export { preloadImages, chooseImageType };