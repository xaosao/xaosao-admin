export async function uploadFileToBunnyServer(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string = "application/octet-stream"
): Promise<string> {
  const STORAGE_ZONE_NAME = process.env.BUNNY_STORAGE_ZONE || "";
  const ACCESS_KEY = process.env.BUNNY_API_KEY || "";
  const BASE_HOSTNAME =
    process.env.BUNNY_BASE_HOSTNAME || "storage.bunnycdn.com";

  const timestamp = Date.now();
  const uniqueFileName = `${timestamp}-${fileName}`;
  const endpoint = `https://${BASE_HOSTNAME}/${STORAGE_ZONE_NAME}/${uniqueFileName}`;

  try {
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: {
        AccessKey: ACCESS_KEY,
        "Content-Type": contentType,
        "Content-Length": fileBuffer.length.toString(),
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Upload failed with status ${response.status}: ${errorText}`
      );
    }

    const cdnHostname =
      process.env.BUNNY_CDN_HOST || `https://${STORAGE_ZONE_NAME}.b-cdn.net`;
    return `${cdnHostname}/${uniqueFileName}`;
  } catch (error) {
    console.error("Upload error:", error);
    throw error;
  }
}

/**
 * Build folder name for a user's BunnyCDN folder.
 * Folder path: {prefix}-{userId}-{safeName}/
 */
export function getUserFolderName(
  userType: "model" | "customer",
  userId: string,
  firstName: string,
  whatsapp?: number
): string {
  const prefix = userType === "model" ? "m" : "c";
  const latinOnly = firstName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
  const safeName = latinOnly || (whatsapp ? String(whatsapp).slice(0, -3) : "user");
  return `${prefix}-${userId}-${safeName}`;
}

/**
 * Recursively delete a folder and all its contents from BunnyCDN.
 */
export async function deleteFolderFromBunny(folderPath: string): Promise<boolean> {
  if (!folderPath) return false;

  const STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || "";
  const ACCESS_KEY = process.env.BUNNY_API_KEY || "";
  const BASE_HOSTNAME = process.env.BUNNY_BASE_HOSTNAME || "storage.bunnycdn.com";
  const path = folderPath.endsWith("/") ? folderPath : `${folderPath}/`;

  console.log(`[BunnyCDN DELETE FOLDER] Zone: ${STORAGE_ZONE} | Path: ${path}`);

  try {
    // 1. List contents
    const listEndpoint = `https://${BASE_HOSTNAME}/${STORAGE_ZONE}/${path}`;
    const listRes = await fetch(listEndpoint, {
      method: "GET",
      headers: { AccessKey: ACCESS_KEY, Accept: "application/json" },
    });

    const items = listRes.ok ? await listRes.json() : [];
    console.log(`[BunnyCDN DELETE FOLDER] Found ${items.length} items in ${path}`);

    // 2. Delete each item (files and subfolders recursively)
    for (const item of items) {
      const itemPath = `${item.Path}${item.ObjectName}`.replace(`/${STORAGE_ZONE}/`, "");
      if (item.IsDirectory) {
        await deleteFolderFromBunny(itemPath);
      } else {
        const fileEndpoint = `https://${BASE_HOSTNAME}/${STORAGE_ZONE}/${itemPath}`;
        const res = await fetch(fileEndpoint, {
          method: "DELETE",
          headers: { AccessKey: ACCESS_KEY },
        });
        console.log(`[BunnyCDN DELETE FILE] ${itemPath}: ${res.ok ? "deleted" : `failed (${res.status})`}`);
      }
    }

    // 3. Delete the now-empty folder
    const folderEndpoint = `https://${BASE_HOSTNAME}/${STORAGE_ZONE}/${path}`;
    const folderRes = await fetch(folderEndpoint, {
      method: "DELETE",
      headers: { AccessKey: ACCESS_KEY },
    });
    console.log(`[BunnyCDN DELETE FOLDER] ${path}: ${folderRes.ok ? "deleted" : `failed (${folderRes.status})`}`);

    return folderRes.ok;
  } catch (error) {
    console.error(`[BunnyCDN DELETE FOLDER] ERROR: ${path}`, error);
    return false;
  }
}

export async function deleteFileFromBunny(filePath: string): Promise<boolean> {
  if (!filePath) return false;

  const STORAGE_ZONE_NAME = process.env.BUNNY_STORAGE_ZONE || "";
  const ACCESS_KEY = process.env.BUNNY_API_KEY || "";
  const BASE_HOSTNAME =
    process.env.BUNNY_BASE_HOSTNAME || "storage.bunnycdn.com";

  const endpoint = `https://${BASE_HOSTNAME}/${STORAGE_ZONE_NAME}/${filePath}`;

  console.log(`[BunnyCDN DELETE] Deleting file: ${filePath} | Endpoint: ${endpoint} | Time: ${new Date().toISOString()}`);

  try {
    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: {
        AccessKey: ACCESS_KEY,
      },
    });

    if (response.ok) {
      console.log(`[BunnyCDN DELETE] SUCCESS: ${filePath}`);
    } else {
      console.error(`[BunnyCDN DELETE] FAILED: ${filePath} | Status: ${response.status}`);
    }

    return response.ok;
  } catch (error) {
    console.error(`[BunnyCDN DELETE] ERROR: ${filePath}`, error);
    return false;
  }
}
