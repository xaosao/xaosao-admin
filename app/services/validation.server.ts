import { z } from "zod";
import { ISettingInputs, ISigninCredentials } from "~/interfaces";
import { IModelInput, IModelUpdateInput } from "~/interfaces/model";
import { IServicesInput } from "~/interfaces/service";
import { IWalletInputs } from "~/interfaces/wallet";

// Basic SQLi blocker
const blockInjection = (value: string) => {
  return !/('|--|\/\/|\/\*|\*\/|;|\b(select|insert|update|delete|drop|alter|create|exec|execute|union|grant|revoke|truncate|xp_cmdshell|call|declare)\b|\b(or|and)\b\s+\d+=\d+|\bOR\b\s+['"]?\d+['"]?\s*=\s*['"]?|<script.*?>.*?<\/script>|javascript:|on\w+=["'].*?["'])/gis.test(
    value
  );
};

const refineSafe = (schema: z.ZodString) =>
  schema
    .refine((val) => val.trim().length > 0, {
      message: "Field cannot be empty.",
    })
    .refine(blockInjection, { message: "Potentially unsafe input detected." });

// ====================== Customer input validate
const customerSchema = z.object({
  firstName: refineSafe(
    z
      .string()
      .max(20, "Invalid first name. Must be at most 20 characters long.")
  ),
  username: refineSafe(
    z.string().max(20, "Invalid username. Must be at most 20 characters long.")
  ),
  password: refineSafe(
    z.string().min(7, "Invalid password. Must be at least 7 characters long.")
  ),
  whatsapp: z
    .number()
    .min(1000000000, "Whatsapp number must be exactly 10 digits.")
    .max(9999999999, "Whastapp number must be exactly 10 digits."),
  tier: z
    .string()
    .refine((val) => ["basic", "vip"].includes(val), {
      message: "Invalid tier. Must be one of: basic, vip.",
    })
    .refine(blockInjection, {
      message: "Tier is Potentially unsafe input detected in status.",
    }),
  status: z
    .string()
    .refine((val) => ["active", "inactive", "suspended", "verified"].includes(val), {
      message: "Invalid status. Must be one of: active, inactive, suspended, verified.",
    })
    .refine(blockInjection, {
      message: "Status is Potentially unsafe input detected in status.",
    }),
  profile: z
    .string()
    .optional()
    .refine((val) => !val || val.trim().length > 10, {
      message: "Invalid profile!",
    }),
});

export function validateCustomerInput(input: unknown) {
  const result = customerSchema.safeParse(input);

  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }

  return result.data;
}

// ====================== Customer input validate
const customerUpdateSchema = z.object({
  firstName: refineSafe(
    z
      .string()
      .max(20, "Invalid first name. Must be at most 20 characters long.")
  ),
  whatsapp: z
    .number()
    .min(1000000000, "Whatsapp number must be exactly 10 digits.")
    .max(9999999999, "Whastapp number must be exactly 10 digits."),
  tier: z
    .string()
    .refine((val) => ["basic", "vip"].includes(val), {
      message: "Invalid tier. Must be one of: basic, vip.",
    })
    .refine(blockInjection, {
      message: "Tier is Potentially unsafe input detected in status.",
    }),
  status: z
    .string()
    .refine((val) => ["active", "inactive", "suspended", "verified"].includes(val), {
      message: "Invalid status. Must be one of: active, inactive, suspended, verified.",
    })
    .refine(blockInjection, {
      message: "Status is Potentially unsafe input detected in status.",
    }),
  profile: z
    .string()
    .optional()
    .refine((val) => !val || val.trim().length > 10, {
      message: "Invalid profile!",
    }),
});

export function validateCustomerUpdateInput(input: unknown) {
  const result = customerUpdateSchema.safeParse(input);

  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }

  return result.data;
}

// ====================== Role input validate:
const roleSchema = z.object({
  name: refineSafe(
    z
      .string()
      .min(3, "Invalid role name. Must be at least 3 characters.")
      .max(15, "Invalid role name. Must be at most 20 characters long.")
  ),
  permissions: z
    .array(z.string())
    .min(1, "You must select at least one permission."),
});

export function validateRoleInput(input: unknown) {
  const result = roleSchema.safeParse(input);

  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }
  return result.data;
}

// ====================== Admin insert input validate:
const adminSchema = z.object({
  firstName: refineSafe(
    z
      .string()
      .min(3, "Invalid first name. Must be at least 3 characters.")
      .max(20, "Invalid first name. Must be at most 20 characters long.")
  ),
  lastName: refineSafe(
    z
      .string()
      .min(3, "Invalid last name. Must be at least 3 characters.")
      .max(20, "Invalid last name. Must be at most 20 characters long.")
  ),
  username: refineSafe(
    z
      .string()
      .min(3, "Invalid username. Must be at least 3 characters.")
      .max(20, "Invalid username. Must be at most 20 characters long.")
  ),
  password: refineSafe(
    z
      .string()
      .min(7, "Password must be at least 7 characters long.")
      .regex(
        /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{7,}$/,
        "Password must contain at least one uppercase letter, one number, and one special character."
      )
  ),
  gender: z
    .string()
    .refine((val) => ["male", "female", "other"].includes(val), {
      message: "Invalid gender. Must be one of: male, female, other.",
    })
    .refine(blockInjection, {
      message: "Status is Potentially unsafe input detected in status.",
    }),
  tel: z
    .number()
    .min(1000000000, "Phone number must be exactly 10 digits.")
    .max(9999999999, "Phone number must be exactly 10 digits."),
  email: refineSafe(
    z
      .string()
      .min(1, "Email is required.")
      .refine((val) => val.includes("@"), "Email must contain @ symbol.")
  ),
  // role: refineSafe(z.string().uuid("Role must be a valid UUID.")),
  address: refineSafe(
    z
      .string()
      .min(10, "Invalid username. Must be at least 10 characters.")
      .max(100, "Invalid username. Must be at most 100 characters long.")
  ),
});

export function validateAdminInput(input: unknown) {
  const result = adminSchema.safeParse(input);

  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }
  return result.data;
}

// ====================== Admin update input validate:
const adminUpdateSchema = z.object({
  firstName: refineSafe(
    z
      .string()
      .min(3, "Invalid first name. Must be at least 3 characters.")
      .max(20, "Invalid first name. Must be at most 20 characters long.")
  ),
  lastName: refineSafe(
    z
      .string()
      .min(3, "Invalid last name. Must be at least 3 characters.")
      .max(20, "Invalid last name. Must be at most 20 characters long.")
  ),
  gender: z
    .string()
    .refine((val) => ["male", "female", "other"].includes(val), {
      message: "Invalid gender. Must be one of: male, female, other.",
    })
    .refine(blockInjection, {
      message: "Status is Potentially unsafe input detected in status.",
    }),
  tel: z
    .number()
    .min(1000000000, "Phone number must be exactly 10 digits.")
    .max(9999999999, "Phone number must be exactly 10 digits."),
  status: z
    .string()
    .refine((val) => ["active", "inactive", "suspended"].includes(val), {
      message: "Invalid status. Must be one of: active, inactive, suspended.",
    }),
  email: refineSafe(
    z
      .string()
      .min(1, "Email is required.")
      .refine((val) => val.includes("@"), "Email must contain @ symbol.")
  ),
  // role: refineSafe(z.string().uuid("Role must be a valid UUID.")),
  address: refineSafe(
    z
      .string()
      .min(10, "Invalid username. Must be at least 10 characters.")
      .max(100, "Invalid username. Must be at most 100 characters long.")
  ),
});

export function validateUpdateAdminInputs(input: unknown) {
  const result = adminUpdateSchema.safeParse(input);

  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }
  return result.data;
}

// ====================== Admin sign input validate:
const signInSchema = z.object({
  password: refineSafe(z.string()),
  email: refineSafe(
    z
      .string()
      .min(1, "Email is required.")
      .refine((val) => val.includes("@"), "Email must contain @ symbol.")
  ),
});

export function validateSignInInputs(input: ISigninCredentials) {
  const result = signInSchema.safeParse(input);

  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }
  return result.data;
}

// ====================== Service insert input validate
const serviceSchema = z.object({
  name: refineSafe(
    z
      .string()
      .min(5, "Invalid service name. Must be at least 3 characters.")
      .max(50, "Invalid service name. Must be at most 50 characters long.")
  ),
  description: refineSafe(
    z
      .string()
      .min(5, "Invalid description. Must be at least 3 characters.")
      .max(255, "Invalid description. Must be at most 255 characters long.")
  ),
  status: z
    .string()
    .refine((val) => ["active", "inactive", "suspended"].includes(val), {
      message: "Invalid status. Must be one of: active, inactive, suspended.",
    }),
  baseRate: z.number().min(7, "Base rate should be at least 7 digits."),
  commission: z
    .number()
    .min(2, "Commission percent should be at least 2 digits."),
});

export function validateServiceInputs(input: IServicesInput) {
  const result = serviceSchema.safeParse(input);

  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }
  return result.data;
}

// ====================== Models insert input validate
const modelSchema = z.object({
  firstName: refineSafe(
    z
      .string()
      .max(20, "Invalid first name. Must be at most 20 characters long.")
  ),
  username: refineSafe(
    z.string().max(20, "Invalid username. Must be at most 20 characters long.")
  ),
  password: refineSafe(
    z.string().min(7, "Invalid password. Must be at least 7 characters long.")
  ),
  gender: z
    .string()
    .refine((val) => ["male", "female", "other"].includes(val), {
      message: "Invalid gender. Must be one of: male, female, other.",
    }),
  dob: z.coerce.date().refine((date) => !isNaN(date.getTime()), {
    message: "Invalid date format. Please enter a valid date.",
  }),
  bio: refineSafe(
    z
      .string()
      .min(5, "Invalid description. Must be at least 3 characters.")
      .max(255, "Invalid description. Must be at most 255 characters long.")
  ),
  whatsapp: z
    .number()
    .min(1000000000, "Phone number must be exactly 10 digits.")
    .max(9999999999, "Phone number must be exactly 10 digits."),
  status: z
    .string()
    .refine((val) => ["active", "inactive", "suspended"].includes(val), {
      message: "Invalid status. Must be one of: active, inactive, suspended.",
    }),
  available_status: z
    .string()
    .refine((val) => ["online", "offline", "busy", "away"].includes(val), {
      message:
        "Invalid availble status. Must be one of: online, offline, busy and away.",
    }),
});

export function validateModelInputs(input: IModelInput) {
  const result = modelSchema.safeParse(input);

  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }
  return result.data;
}

// ====================== Models update input validate
const modelUpdateSchema = z.object({
  firstName: refineSafe(
    z
      .string()
      .max(20, "Invalid first name. Must be at most 20 characters long.")
  ),
  gender: z
    .string()
    .refine((val) => ["male", "female", "other"].includes(val), {
      message: "Invalid gender. Must be one of: male, female, other.",
    }),
  dob: z.coerce.date().refine((date) => !isNaN(date.getTime()), {
    message: "Invalid date format. Please enter a valid date.",
  }),
  bio: refineSafe(
    z
      .string()
      .min(5, "Invalid description. Must be at least 3 characters.")
      .max(255, "Invalid description. Must be at most 255 characters long.")
  ),
  whatsapp: z
    .number()
    .min(1000000000, "Phone number must be exactly 10 digits.")
    .max(9999999999, "Phone number must be exactly 10 digits."),
  status: z
    .string()
    .refine((val) => ["active", "inactive", "suspended"].includes(val), {
      message: "Invalid status. Must be one of: active, inactive, suspended.",
    }),
  available_status: z
    .string()
    .refine((val) => ["online", "offline", "busy", "away"].includes(val), {
      message:
        "Invalid availble status. Must be one of: online, offline, busy and away.",
    }),
});

export function validateUpdateModelInputs(input: IModelUpdateInput) {
  const result = modelUpdateSchema.safeParse(input);

  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }
  return result.data;
}

// ====================== Wallet
const walletSchema = z.object({
  status: z
    .string()
    .refine((val) => ["active", "inactive", "suspended"].includes(val), {
      message: "Invalid status. Must be one of: active, inactive, suspended.",
    }),
  totalBalance: z
    .number()
    .refine((val) => String(Math.floor(val)).length <= 8, {
      message: "Total balances must be at most 8 digits",
    }),
  totalRecharge: z
    .number()
    .refine((val) => String(Math.floor(val)).length <= 8, {
      message: "Total recharges must be at most 8 digits",
    }),
  totalDeposit: z
    .number()
    .refine((val) => String(Math.floor(val)).length <= 8, {
      message: "Total deposits must be at most 8 digits",
    }),
});

export function validateWalletInputs(input: IWalletInputs) {
  const result = walletSchema.safeParse(input);

  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }
  return result.data;
}

// ======================== Setting Validation
const settingSchema = z.object({
  platform_fee_percent: z
    .number()
    .max(100, "Platform fee percent must be exactly 3 digits."),
  min_payout: z
    .number()
    .max(99999999, "Minimum payout must be exactly 8 digits."),
  max_withdrawal_day: z
    .number()
    .max(99999999, "Withdrawal per day must be exactly 8 digits."),
  max_withdrawal_week: z
    .number()
    .max(999999999, "Withdrawal per week must be exactly 9 digits."),
  max_withdrawal_month: z
    .number()
    .max(999999999, "Withdrawal per month must be exactly 9 digits."),
  exchange_rate: z.number().max(99999, "Exchange must be exactly 3 digits."),
  bank_account_name: refineSafe(
    z
      .string()
      .min(5, "Invalid description. Must be at least 3 characters.")
      .max(50, "Invalid description. Must be at most 50 characters long.")
  ),
  bank_account_number: refineSafe(
    z
      .string()
      .max(20, "Invalid description. Must be at most 20 characters long.")
  ),
  require_2fa_admin: z.boolean(),
  auto_approve_models: z.boolean(),
  require_email_verification: z.boolean(),
  require_phone_verification: z.boolean(),
  min_age: z
    .number()
    .min(18, "Minimum age must be at least 18 years old")
    .max(70, "Minimum age must be less than 70 years old"),
});

export function validateSettingInputs(input: ISettingInputs) {
  const result = settingSchema.safeParse(input);

  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }
  return result.data;
}
