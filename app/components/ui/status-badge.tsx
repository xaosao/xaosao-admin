import React from "react";
import { capitalizeFirstLetter } from "~/utils";

interface StatusBadgeProps {
    status: string;
}

const useStatus = {
    ACTIVE: "active",
    SUCCESS: "success",
    INACTIVE: "inactive",
    DELETED: "deleted",
    FAILED: "failed",
    PENDING: "pending",
    VERIFIED: "verified",
    SUSPENDED: "suspended",
    APPROVED: "approved",
    REJECTED: "rejected",
    BANNED: "banned",
    COMPLETED: "Completed",
    CANCELED: "cancelled",
    EXPIRED: "expired",
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {

    const getStatusStyles = (status: string) => {
        switch (status) {
            case useStatus.ACTIVE:
                return {
                    className: "bg-green-100 text-green-800",
                    weight: "bg-green-500",
                };
            case useStatus.APPROVED:
                return {
                    className: "bg-green-100 text-green-800",
                    weight: "bg-green-500",
                };
            case useStatus.SUCCESS:
                return {
                    className: "bg-green-100 text-green-800",
                    weight: "bg-green-500",
                };
            case useStatus.INACTIVE:
                return {
                    className: "bg-red-100 text-red-800",
                    weight: "bg-red-500",
                };
            case useStatus.COMPLETED:
                return {
                    className: "bg-green-100 text-green-800",
                    weight: "bg-green-500",
                };
            case useStatus.DELETED:
                return {
                    className: "bg-red-100 text-red-800",
                    weight: "bg-red-500",
                };
            case useStatus.CANCELED:
                return {
                    className: "bg-gray-100 text-gray-800",
                    weight: "bg-gray-500",
                };
            case useStatus.REJECTED:
                return {
                    className: "bg-red-100 text-red-800",
                    weight: "bg-red-500",
                };
            case useStatus.FAILED:
                return {
                    className: "bg-red-100 text-red-800",
                    weight: "bg-red-500",
                };
            case useStatus.PENDING:
                return {
                    className: "bg-orange-100 text-orange-800",
                    weight: "bg-orange-500",
                };
            case useStatus.VERIFIED:
                return {
                    className: "bg-blue-100 text-blue-800",
                    weight: "bg-blue-500",
                };
            case useStatus.SUSPENDED:
                return {
                    className: "bg-yellow-100 text-yellow-800",
                    weight: "bg-yellow-500",
                };
            case useStatus.EXPIRED:
                return {
                    className: "bg-gray-100 text-gray-800",
                    weight: "bg-gray-500",
                };
            default:
                return {
                    className: "bg-gray-200 text-gray-800",
                    weight: "bg-gray-500",
                };
        }
    };

    const { className, weight } = getStatusStyles(status);

    return (
        <span
            className={`${className} inline-flex items-center text-xs font-medium whitespace-nowrap px-2.5 py-1 rounded-lg`}
        >
            <span className={`w-2 h-2 me-1 rounded-full ${weight}`}></span>
            {capitalizeFirstLetter(status)}
        </span>
    );
};

export default StatusBadge;
