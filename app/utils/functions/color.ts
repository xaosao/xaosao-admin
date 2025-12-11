export const getAvailableStatusColor = (status: string) => {
  switch (status) {
    case "online":
      return "bg-green-500";
    case "busy":
      return "bg-yellow-500";
    case "away":
      return "bg-orange-500";
    case "offline":
      return "bg-gray-400";
    default:
      return "bg-gray-400";
  }
};
