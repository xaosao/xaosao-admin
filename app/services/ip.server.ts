export async function getLocationDetails(
  ip: string,
  accessKey: string
): Promise<any> {
  const url = `https://apiip.net/api/check?ip=${ip}&accessKey=${accessKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`API Error: ${data.error}`);
    }

    return data;
  } catch (error) {
    console.error("ERROR_FETCH_LOCATION_DETAILS:", error);
    throw error;
  }
}
