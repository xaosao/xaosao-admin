import { useState, useRef } from "react";
import { LoaderCircle, Bell, Send } from "lucide-react";
import {
  Form,
  json,
  redirect,
  useActionData,
  useNavigate,
  useNavigation,
} from "@remix-run/react";
import type { ActionFunctionArgs } from "@remix-run/node";

// Components
import Modal from "~/components/ui/modal";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ForbiddenCard } from "~/components/ui/forbidden-card";

// Backend
import { useAuthStore } from "~/store/permissionStore";
import {
  createBroadcastNotification,
  sendBroadcast,
} from "~/services/broadcast.server";
import {
  requireUserPermission,
  requireUserSession,
} from "~/services/auth.server";

export default function CreateNotification() {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const actionData = useActionData<{ error?: string; fieldErrors?: Record<string, string> }>();
  const isSubmitting =
    navigation.state !== "idle" && navigation.formMethod === "POST";

  const [scheduleType, setScheduleType] = useState("immediate");
  const [recurrence, setRecurrence] = useState("once");
  const [targetUserType, setTargetUserType] = useState("all");

  // Template variables
  const titleRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const templateVars = [
    { label: "First Name", value: "{{firstname}}" },
    { label: "Last Name", value: "{{lastname}}" },
    { label: "Full Name", value: "{{fullname}}" },
  ];

  function insertVariable(field: "title" | "message", variable: string) {
    const el = field === "title" ? titleRef.current : messageRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const newValue = el.value.slice(0, start) + variable + el.value.slice(end);
    // Update the input value and trigger React change
    const nativeSetter = Object.getOwnPropertyDescriptor(
      field === "title" ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype,
      "value"
    )?.set;
    nativeSetter?.call(el, newValue);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    // Restore cursor position after the inserted variable
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + variable.length, start + variable.length);
    });
  }

  function closeHandler() {
    navigate("/dashboard/notifications");
  }

  const canCreate = hasPermission("notification", "create");
  if (!canCreate) {
    return (
      <div className="h-full flex items-center justify-center">
        <ForbiddenCard
          title="Unallowed for your role"
          subtitle="This area requires additional permissions."
        />
      </div>
    );
  }

  return (
    <Modal onClose={closeHandler} className="w-4/5 max-w-3xl">
      <h4 className="text-md font-bold text-primary mb-4">
        Create Broadcast Notification
      </h4>
      <Form method="post" className="space-y-6">
        {/* Section 1: Content */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Notification Content
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="title" className="text-xs text-gray-500">
                Title *
              </label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400 mr-1">Insert:</span>
                {templateVars.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => insertVariable("title", v.value)}
                    className="px-1.5 py-0.5 text-[10px] rounded bg-pink-50 text-pink-600 hover:bg-pink-100 border border-pink-200 font-mono"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <Input
              ref={titleRef}
              required
              id="title"
              name="title"
              placeholder="e.g. ສະບາຍດີ, {{firstname}}!"
              className="border-gray-200"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="message" className="text-xs text-gray-500">
                Message *
              </label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400 mr-1">Insert:</span>
                {templateVars.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => insertVariable("message", v.value)}
                    className="px-1.5 py-0.5 text-[10px] rounded bg-pink-50 text-pink-600 hover:bg-pink-100 border border-pink-200 font-mono"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              ref={messageRef}
              required
              id="message"
              name="message"
              rows={4}
              placeholder="e.g. ສະບາຍດີ, {{firstname}} ເຈົ້າໄດ້ເປີດບໍລິການແລ້ວບໍ?"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-300"
            />
          </div>
        </div>

        {/* Section 2: Target Audience */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Target Audience
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-gray-500">User Type *</label>
              <select
                name="targetUserType"
                value={targetUserType}
                onChange={(e) => setTargetUserType(e.target.value)}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                required
              >
                <option value="all">All Users</option>
                <option value="customer">Customers Only</option>
                <option value="model">Models Only</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-500">Gender</label>
              <select
                name="targetGender"
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
              >
                <option value="">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-gray-500">Min Age</label>
              <Input
                type="number"
                name="targetAgeMin"
                placeholder="e.g. 18"
                min={0}
                max={100}
                className="border-gray-200"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-500">Max Age</label>
              <Input
                type="number"
                name="targetAgeMax"
                placeholder="e.g. 35"
                min={0}
                max={100}
                className="border-gray-200"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-500">Country</label>
              <Input
                type="text"
                name="targetCountry"
                placeholder="e.g. Laos"
                className="border-gray-200"
              />
            </div>
          </div>

          {/* Advanced Filters */}
          <div className="grid grid-cols-3 gap-4">
            {/* Package filter - customers only */}
            {(targetUserType === "customer" || targetUserType === "all") && (
              <div className="space-y-2">
                <label className="text-xs text-gray-500">Package</label>
                <select
                  name="targetPackage"
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                >
                  <option value="">All Packages</option>
                  <option value="free">Free (No Package)</option>
                  <option value="24h">24 Hours</option>
                  <option value="1w">1 Week</option>
                  <option value="1m">1 Month</option>
                  <option value="3m">3 Months</option>
                </select>
              </div>
            )}

            {/* Service filter - models only */}
            {(targetUserType === "model" || targetUserType === "all") && (
              <div className="space-y-2">
                <label className="text-xs text-gray-500">Service</label>
                <select
                  name="targetService"
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                >
                  <option value="">All Services</option>
                  <option value="no_service">No Service Opened</option>
                  <option value="drinking_only">Drinking Only</option>
                </select>
              </div>
            )}

            {/* Booking filter */}
            <div className="space-y-2">
              <label className="text-xs text-gray-500">Booking</label>
              <select
                name="targetBooking"
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
              >
                <option value="">All Bookings</option>
                {(targetUserType === "customer" || targetUserType === "all") && (
                  <option value="never_booked">Never Booked</option>
                )}
                {(targetUserType === "model" || targetUserType === "all") && (
                  <option value="never_got_booked">Never Got Booked</option>
                )}
              </select>
            </div>

            {/* Images filter - both customer and model */}
            <div className="space-y-2">
              <label className="text-xs text-gray-500">Profile Images</label>
              <select
                name="targetImages"
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
              >
                <option value="">All</option>
                <option value="incomplete">Less Than 6 Images</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Delivery Channels */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Delivery Channels
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <label className="flex items-center space-x-2 p-3 border rounded-md hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                name="channelInApp"
                value="true"
                defaultChecked
                className="rounded border-gray-300 text-rose-500 focus:ring-rose-500"
              />
              <span className="text-sm text-gray-700">In-App</span>
            </label>
            <label className="flex items-center space-x-2 p-3 border rounded-md hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                name="channelSMS"
                value="true"
                className="rounded border-gray-300 text-rose-500 focus:ring-rose-500"
              />
              <span className="text-sm text-gray-700">SMS</span>
            </label>
            <label className="flex items-center space-x-2 p-3 border rounded-md hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                name="channelPush"
                value="true"
                className="rounded border-gray-300 text-rose-500 focus:ring-rose-500"
              />
              <span className="text-sm text-gray-700">Push</span>
            </label>
            <label className="flex items-center space-x-2 p-3 border rounded-md hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                name="channelWhatsApp"
                value="true"
                className="rounded border-gray-300 text-rose-500 focus:ring-rose-500"
              />
              <span className="text-sm text-gray-700">WhatsApp</span>
            </label>
          </div>
        </div>

        {/* Section 4: Schedule */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Schedule</h3>
          <div className="flex items-center gap-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="scheduleType"
                value="immediate"
                checked={scheduleType === "immediate"}
                onChange={() => setScheduleType("immediate")}
                className="text-rose-500 focus:ring-rose-500"
              />
              <span className="text-sm text-gray-700">Send Now</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="scheduleType"
                value="scheduled"
                checked={scheduleType === "scheduled"}
                onChange={() => setScheduleType("scheduled")}
                className="text-rose-500 focus:ring-rose-500"
              />
              <span className="text-sm text-gray-700">Schedule</span>
            </label>
          </div>

          {scheduleType === "scheduled" && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-md">
              <div className="space-y-2">
                <label className="text-xs text-gray-500">Recurrence</label>
                <select
                  name="recurrence"
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value)}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                >
                  <option value="once">One Time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              {recurrence === "once" && (
                <div className="space-y-2">
                  <label className="text-xs text-gray-500">
                    Scheduled Date & Time *
                  </label>
                  <Input
                    type="datetime-local"
                    name="scheduledAt"
                    className="border-gray-200"
                    required
                  />
                  <p className="text-xs text-gray-400">
                    Sends once at the specified date and time.
                  </p>
                </div>
              )}

              {recurrence === "daily" && (
                <div className="space-y-2">
                  <label className="text-xs text-gray-500">
                    Send Time (every day) *
                  </label>
                  <Input
                    type="time"
                    name="recurrenceTime"
                    className="border-gray-200"
                    required
                  />
                  <p className="text-xs text-gray-400">
                    Sends once per day at this time. 1 message per user per day.
                  </p>
                </div>
              )}

              {recurrence === "weekly" && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs text-gray-500">
                      Day of Week *
                    </label>
                    <select
                      name="recurrenceDay"
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                      required
                    >
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
                      <option value="0">Sunday</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-gray-500">
                      Send Time *
                    </label>
                    <Input
                      type="time"
                      name="recurrenceTime"
                      className="border-gray-200"
                      required
                    />
                    <p className="text-xs text-gray-400">
                      Sends once per week on the selected day at this time. 1 message per user per week.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Errors */}
        {actionData?.error && (
          <div className="p-3 text-sm text-red-800 border border-red-300 rounded-lg bg-red-50">
            {actionData.error}
          </div>
        )}
        {actionData?.fieldErrors &&
          Object.values(actionData.fieldErrors).map((error, i) => (
            <div
              key={i}
              className="p-3 text-sm text-red-800 border border-red-300 rounded-lg bg-red-50"
            >
              {error}
            </div>
          ))}

        {/* Actions */}
        <div className="flex items-center justify-start space-x-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={closeHandler}>
            Cancel
          </Button>
          <Button
            type="submit"
            name="action"
            value="draft"
            variant="outline"
            disabled={isSubmitting}
          >
            Save as Draft
          </Button>
          <Button
            type="submit"
            name="action"
            value="send"
            className="bg-dark-pink hover:opacity-90 text-white"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <LoaderCircle className="w-4 h-4 animate-spin mr-2" />
            ) : scheduleType === "immediate" ? (
              <Send className="w-4 h-4 mr-2" />
            ) : (
              <Bell className="w-4 h-4 mr-2" />
            )}
            {isSubmitting
              ? "Processing..."
              : scheduleType === "immediate"
              ? "Send Now"
              : "Schedule"}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}

export async function loader({ request }: { request: Request }) {
  const userId = await requireUserSession(request);
  await requireUserPermission({
    userId,
    group: "notification",
    action: "create",
  });
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserSession(request);
  await requireUserPermission({
    userId,
    group: "notification",
    action: "create",
  });

  const formData = await request.formData();
  const action = formData.get("action") as string;

  const title = formData.get("title") as string;
  const message = formData.get("message") as string;
  const targetUserType = formData.get("targetUserType") as string;
  const targetGender = (formData.get("targetGender") as string) || null;
  const targetAgeMin = formData.get("targetAgeMin")
    ? Number(formData.get("targetAgeMin"))
    : null;
  const targetAgeMax = formData.get("targetAgeMax")
    ? Number(formData.get("targetAgeMax"))
    : null;
  const targetCountry = (formData.get("targetCountry") as string) || null;
  const targetPackage = (formData.get("targetPackage") as string) || null;
  const targetService = (formData.get("targetService") as string) || null;
  const targetBooking = (formData.get("targetBooking") as string) || null;
  const targetImages = (formData.get("targetImages") as string) || null;

  const channelInApp = formData.get("channelInApp") === "true";
  const channelSMS = formData.get("channelSMS") === "true";
  const channelPush = formData.get("channelPush") === "true";
  const channelWhatsApp = formData.get("channelWhatsApp") === "true";

  const scheduleType = formData.get("scheduleType") as string;
  const scheduledAtRaw = formData.get("scheduledAt") as string;
  const recurrence = (formData.get("recurrence") as string) || "once";
  const recurrenceTime = (formData.get("recurrenceTime") as string) || null;
  const recurrenceDay = formData.get("recurrenceDay") as string | null;

  // Validation
  if (!title || !message) {
    return json({ error: "Title and message are required" });
  }

  if (!channelInApp && !channelSMS && !channelPush && !channelWhatsApp) {
    return json({ error: "At least one delivery channel must be selected" });
  }

  // Calculate scheduledAt based on recurrence type
  let scheduledAt: Date | null = null;

  if (recurrence === "once") {
    scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;
  } else if (recurrence === "weekly" && recurrenceDay && recurrenceTime) {
    // Calculate the first occurrence on the selected day-of-week
    const [hours, minutes] = recurrenceTime.split(":").map(Number);
    const targetDay = Number(recurrenceDay); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const now = new Date();
    const first = new Date();
    first.setHours(hours, minutes, 0, 0);
    // Find the next occurrence of the target day
    const currentDay = now.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0) daysUntil += 7;
    if (daysUntil === 0 && first <= now) daysUntil = 7;
    first.setDate(first.getDate() + daysUntil);
    scheduledAt = first;
  } else if (recurrence === "daily" && recurrenceTime) {
    // Calculate the first daily run
    const [hours, minutes] = recurrenceTime.split(":").map(Number);
    const first = new Date();
    first.setHours(hours, minutes, 0, 0);
    if (first <= new Date()) first.setDate(first.getDate() + 1);
    scheduledAt = first;
  }

  // Determine status
  let status = "draft";
  if (action === "send") {
    status = "scheduled";
  }

  try {
    const notification = await createBroadcastNotification({
      title,
      message,
      targetUserType,
      targetGender,
      targetAgeMin,
      targetAgeMax,
      targetCountry,
      targetPackage,
      targetService,
      targetBooking,
      targetImages,
      channelSMS,
      channelPush,
      channelInApp,
      channelWhatsApp,
      scheduleType,
      scheduledAt,
      recurrence,
      recurrenceTime,
      status,
      createdBy: userId as string,
    });

    // If immediate and action is "send", trigger the broadcast now
    if (action === "send" && scheduleType === "immediate") {
      // Send in background (don't await)
      sendBroadcast(notification.id).catch((err) =>
        console.error("[CreateNotification] Background send failed:", err)
      );
    }

    return redirect("/dashboard/notifications");
  } catch (error: any) {
    console.error("CREATE_NOTIFICATION_FAILED", error);
    return json({ error: error.message || "Failed to create notification" });
  }
}
