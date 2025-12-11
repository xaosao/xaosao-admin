import React, { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

interface TextfieldProps extends InputHTMLAttributes<HTMLInputElement> {
    helperText?: string;
    multiline?: boolean;
    rows?: number;
    color?: string;
    readOnly?: boolean;
}

export default function Textfield(props: TextfieldProps) {
    const {
        multiline,
        helperText,
        color,
        title,
        required,
        id,
        rows,
        readOnly,
        ...otherProps
    } = props;

    return (
        <div className="flex items-start justify-start flex-col select-none gap-2 w-full">
            <label
                className={`text-sm ${color ? color : "text-gray-500"}`}
                htmlFor={id}
            >
                {title}
                {required && <span className="text-red-500">&nbsp;*</span>}
            </label>

            {multiline ? (
                <textarea
                    id={id}
                    className={`-mt-1 text-sm p-2 rounded w-full border border focus:border-b_text focus:bg-white focus:ring-1 focus:ring-base ${color ? color : "text-gray-500"
                        } outline-none py-1 px-3 leading-8 transition-colors duration-200 ease-in-out font-rubik`}
                    rows={rows || 4}
                    readOnly={readOnly}
                    required={required}
                    {...(otherProps as TextareaHTMLAttributes<HTMLTextAreaElement>)}
                />
            ) : (
                <input
                    type="text"
                    id={id}
                    className={`-mt-1 text-sm p-2 rounded w-full border border focus:border-b_text focus:bg-white focus:ring-1 focus:ring-base ${color ? color : "text-gray-500"
                        } outline-none py-1 leading-8 transition-colors duration-200 ease-in-out font-rubik h-9`}
                    readOnly={readOnly}
                    required={required}
                    {...otherProps}
                />
            )}

            <div className="flex items-center justify-end w-full">
                <i className="text-xs text-b_text">{helperText}</i>
            </div>
        </div>
    );
}
