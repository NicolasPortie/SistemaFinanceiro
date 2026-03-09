"use client";

import { useEffect, useState } from "react";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";

interface GoogleLoginButtonProps {
  text?: "signin_with" | "signup_with" | "continue_with";
  onSuccess: (credential: string) => void | Promise<void>;
  onError: () => void;
}

export function GoogleLoginButton({
  text = "signin_with",
  onSuccess,
  onError,
}: GoogleLoginButtonProps) {
  const [mounted, setMounted] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="google-auth-button-placeholder" aria-hidden="true" />;
  }

  if (!clientId) {
    return (
      <button
        type="button"
        disabled
        className="google-auth-button-fallback"
        title="NEXT_PUBLIC_GOOGLE_CLIENT_ID não configurado"
      >
        <span className="google-auth-button-fallback__icon" aria-hidden="true">G</span>
        <span>{text === "signup_with" ? "Cadastrar com Google" : "Entrar com Google"}</span>
      </button>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <div className="google-auth-button-shell">
        <GoogleLogin
          onSuccess={async (credentialResponse) => {
            if (credentialResponse.credential) {
              await onSuccess(credentialResponse.credential);
              return;
            }

            onError();
          }}
          onError={onError}
          text={text}
          size="large"
          theme="outline"
          shape="rectangular"
          logo_alignment="left"
          width="360"
        />
      </div>
    </GoogleOAuthProvider>
  );
}