import { Eye, EyeOff } from "lucide-react";
import { InputHTMLAttributes, useState } from "react";

interface TextfieldProps extends InputHTMLAttributes<HTMLInputElement> {
    helperText?: string;
}

export default function Password(props: TextfieldProps) {
    const [ispassword, setIspassword] = useState(true);
    return (
        <div className="block select-none ">
            <label className={`text-sm text-gray-500 block`} htmlFor={props?.id}>
                {props?.title}{" "}
                {props?.required && <span className="text-red-500">&nbsp;*</span>}
            </label>
            <div className="flex items-center relative mt-1">
                <input
                    id={props?.id}
                    type={ispassword ? "password" : "text"}
                    className={`text-sm text-gray-500 p-4 mt-0 rounded w-full border pr-[50px] focus:bg-white focus:ring-1 focus:ring-secondary outline-none py-2 px-3 leading-8 transition-colors duration-200 ease-in-out font-sans h-9`}
                    {...props}
                />
                <button
                    type="button"
                    className="absolute right-0 w-[40px] text-gray-500 p-3"
                    onClick={() => setIspassword((res) => !res)}
                >
                    {ispassword ? <Eye height={16} width={16} /> : <EyeOff height={16} width={16} />}
                </button>
            </div>
        </div>
    );
}