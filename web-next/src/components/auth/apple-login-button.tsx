"use client";

import AppleSignin from "react-apple-signin-auth";

interface AppleLoginButtonProps {
  onSuccess: (idToken: string, nome?: string) => void;
  onError: () => void;
  text?: "signin" | "signup";
}

export function AppleLoginButton({ onSuccess, onError, text = "signin" }: AppleLoginButtonProps) {
  return (
    <AppleSignin
      authOptions={{
        clientId: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || "YOUR_APPLE_SERVICE_ID",
        scope: "email name",
        redirectURI: typeof window !== "undefined" ? window.location.origin : "",
        usePopup: true,
      }}
      onSuccess={(response: { authorization?: { id_token?: string }; user?: { name?: { firstName?: string; lastName?: string } } }) => {
        const idToken = response?.authorization?.id_token;
        if (!idToken) {
          onError();
          return;
        }
        const firstName = response?.user?.name?.firstName ?? "";
        const lastName = response?.user?.name?.lastName ?? "";
        const nome = [firstName, lastName].filter(Boolean).join(" ") || undefined;
        onSuccess(idToken, nome);
      }}
      onError={() => onError()}
      uiType="dark"
      className="w-full flex items-center justify-center gap-3 h-10 px-4 rounded-md border border-stone-300 bg-black text-white text-sm font-medium hover:bg-stone-900 transition-colors cursor-pointer"
      render={(props: Record<string, unknown>) => (
        <button
          {...props}
          type="button"
          className="w-full flex items-center justify-center gap-3 h-10 px-4 rounded-md border border-stone-300 bg-black text-white text-sm font-medium hover:bg-stone-900 transition-colors cursor-pointer"
        >
          <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          {text === "signup" ? "Cadastrar com Apple" : "Entrar com Apple"}
        </button>
      )}
    />
  );
}
