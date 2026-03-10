"use client";

import { useEffect, useRef, useState } from "react";
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
  const [buttonWidth, setButtonWidth] = useState(0);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !shellRef.current) return;

    const updateWidth = () => {
      const nextWidth = Math.floor(shellRef.current?.clientWidth ?? 0);
      if (nextWidth > 0) {
        setButtonWidth(nextWidth);
      }
    };

    updateWidth();

    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => updateWidth());
    observer?.observe(shellRef.current);
    window.addEventListener("resize", updateWidth);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, [mounted]);

  return (
    <div ref={shellRef} className="google-auth-button-shell">
      {!mounted || buttonWidth <= 0 ? (
        <div className="google-auth-button-placeholder" aria-hidden="true" />
      ) : !clientId ? (
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="google-auth-button-fallback"
          title="NEXT_PUBLIC_GOOGLE_CLIENT_ID não configurado"
        >
          <span className="google-auth-button-fallback__icon" aria-hidden="true">
            G
          </span>
          <span>{text === "signup_with" ? "Cadastrar com Google" : "Entrar com Google"}</span>
        </button>
      ) : (
        <GoogleOAuthProvider clientId={clientId}>
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
            width={buttonWidth.toString()}
          />
        </GoogleOAuthProvider>
      )}
    </div>
  );
}
