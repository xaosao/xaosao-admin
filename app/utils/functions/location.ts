// Open Google Maps using lat&long
export function openInGoogleMaps(latitude: number, longitude: number) {
  if (!latitude || !longitude) {
    console.error("Invalid latitude or longitude");
    return;
  }

  const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
  window.open(url, "_blank");
}

// Get location using Geolocation API
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        resolve({ latitude, longitude });
      },
      (error) => {
        reject(new Error("Geolocation error: " + error.message));
      }
    );
  });
}

export async function getCurrentIP() {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error("Error fetching IP:", error);
    throw new Error("Failed to get IP address");
  }
}
