import { LoaderCircle, LogIn } from "lucide-react";
import { ActionFunctionArgs } from "@remix-run/node";
import { Form, json, useActionData, useNavigation } from "@remix-run/react";

// components
import { Button } from "~/components/ui/button";
import Textfield from "~/components/ui/text-field";
import Password from "~/components/ui/password-textfield";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

// service and interfaces
import { login } from "~/services/auth.server";
import { ISigninCredentials } from "~/interfaces";
import { validateSignInInputs } from "~/services/validation.server";

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData();
    const signInData: ISigninCredentials = {
        email: formData.get("email") as string,
        password: formData.get("password") as string,
    };

    if (!signInData.email || !signInData.password) {
        return { error: "Invalide email or password!" }
    }

    if (request.method === "POST") {
        try {
            validateSignInInputs(signInData);
            return await login(signInData);
        } catch (error: any) {
            console.log("LOGIN_FAILED:::::", error)
            if (error.status === 401) {
                return { error: "Username or password incorrect!" };
            }
            return { error: "An unexpected error occurred." };
        }
    }
    return json({ error: "Invalid request method." });
}

export default function SignIn() {
    const navigation = useNavigation();
    const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "POST";

    const validationErrors = useActionData<Partial<Record<keyof ISigninCredentials, string>>>();


    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-pink-100 p-4">
            <div className="absolute inset-0 bg-dark-pink opacity-5"></div>
            <Card className="w-full max-w-md relative z-10 shadow-2xl border-0 bg-white/80 backdrop-blur-sm rounded-md">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex items-center justify-center mb-4">
                        <img src="/images/logo-pink.png" className="w-35 h-12" />
                    </div>
                    <CardTitle className="text-xl font-bold text-rose-500">Welcome Back to Xaosao</CardTitle>
                    <CardDescription className="text-gray-600">Sign in to xaosao admin dashboard</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form method="post" className="space-y-4">
                        <div className="space-y-2">
                            <Textfield
                                required
                                type="email"
                                id="email"
                                name="email"
                                title="Email or username"
                                color="text-gray-500"
                                placeholder="Enter email...."
                            />
                        </div>
                        <div className="space-y-2">
                            <Password
                                required
                                id="password"
                                name="password"
                                title="Password"
                                color="text-gray-500"
                                placeholder="Enter your password..."
                            />
                        </div>
                        <div>
                            {validationErrors && Object.keys(validationErrors).length > 0 && (
                                <div>
                                    {Object.values(validationErrors).map((error, index) => (
                                        <div key={index} className="flex items-center p-4 mb-4 text-sm text-red-800 border border-red-300 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400 dark:border-red-800" role="alert">
                                            <svg className="shrink-0 inline w-4 h-4 me-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z" />
                                            </svg>
                                            <span className="sr-only">Info</span>
                                            <div>
                                                {error}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <Button
                            type="submit"
                            className="w-full bg-rose-500 hover:bg-rose-600 text-white font-medium py-2.5"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? <LoaderCircle className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4" />}
                            {isSubmitting ? "Signing in..." : "Sign In"}
                        </Button>
                    </Form>
                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-500">Forgot password? Contact your administrator.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
