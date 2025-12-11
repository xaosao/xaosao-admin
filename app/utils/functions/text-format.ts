import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility function to merge class names using clsx and tailwind-merge
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Truncate a string
export function truncateText(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}

// Mask the middle of a string
export function maskMiddle(
  str: string,
  visibleStart: number = 10,
  visibleEnd: number = 5
): string {
  // If string is too short to mask, return it as is
  if (str.length <= visibleStart + visibleEnd) return str;

  const start = str.slice(0, visibleStart);
  const end = str.slice(-visibleEnd);
  const masked = "*".repeat(str.length - visibleStart - visibleEnd);

  return `${start}${masked}${end}`;
}

export const getStatusColor = (status: string) => {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "inactive":
      return "bg-gray-100 text-gray-800";
    case "ban":
      return "bg-red-100 text-red-800";
    case "deleted":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export function capitalizeFirstLetter(text: string): string {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function extractFilenameFromCDNSafe(url: string): string {
  if (!url || typeof url !== "string") {
    return "";
  }
  try {
    const urlParts = url.split("/");
    const filename = urlParts[urlParts.length - 1] || "";
    return filename.split("?")[0];
  } catch (error) {
    console.error("Error extracting filename from URL:", error);
    return "";
  }
}
