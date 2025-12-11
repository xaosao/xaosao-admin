import { useParams } from "@remix-run/react";

export default function DashboardCatchAll() {
  const params = useParams();
  const section = params["*"] || "page";

  // Convert URL segment to readable title
  const title = section
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500 mt-1">This section is coming soon</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Under Development</h2>
        <div className="space-y-4">
          <p className="text-gray-600">
            This {title.toLowerCase()} section is currently under development.
            In a full implementation, you would find comprehensive management tools here.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <div className="h-5 w-5 text-blue-400">ℹ️</div>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  UI Demo Mode
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    This is a UI demonstration. All the beautiful components and layouts are preserved
                    and ready to be connected to real functionality.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-500">
            <p><strong>Path:</strong> /dashboard/{section}</p>
            <p><strong>Status:</strong> UI Complete, Backend Pending</p>
          </div>
        </div>
      </div>
    </div>
  );
}