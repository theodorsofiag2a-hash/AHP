"use client";

import { useEffect } from "react";
import "./screen-guard.css";

const ATTR = "data-screen-guard";
const HOLD_MS = 2000;

/**
 * Dificulta impressão e capturas de tela. Nenhum navegador consegue bloquear captura de
 * forma absoluta (câmera externa, gravação do SO), então isto é dissuasão em camadas:
 *  - @media print em branco, Ctrl/Cmd+P bloqueado;
 *  - PrintScreen, Win+Shift+S e Cmd+Shift+3/4/5 cobrem a tela e limpam a área de transferência;
 *  - perder o foco da janela (ferramentas de recorte) cobre a tela até o foco voltar.
 */
export function ScreenGuard() {
  useEffect(() => {
    const root = document.documentElement;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;

    const cover = () => root.setAttribute(ATTR, "on");
    const uncover = () => {
      if (document.hasFocus() && !document.hidden) root.removeAttribute(ATTR);
    };
    const coverTemporarily = () => {
      cover();
      clearTimeout(holdTimer);
      holdTimer = setTimeout(uncover, HOLD_MS);
    };
    const clearClipboard = () => {
      navigator.clipboard?.writeText(" ").catch(() => {});
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;

      if (mod && (key === "p" || key === "s")) {
        e.preventDefault();
        coverTemporarily();
      } else if (key === "printscreen" || key === "snapshot") {
        coverTemporarily();
        clearClipboard();
      } else if (e.metaKey && e.shiftKey && (key === "s" || ["3", "4", "5", "#", "$", "%"].includes(key))) {
        // Win+Shift+S (recorte) e Cmd+Shift+3/4/5 (macOS).
        coverTemporarily();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      // No Windows, PrintScreen só dispara keyup.
      if (e.key === "PrintScreen") {
        coverTemporarily();
        clearClipboard();
      }
    };
    const onVisibility = () => (document.hidden ? cover() : uncover());
    const onContextMenu = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest("input, textarea, [contenteditable='true']")) e.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", cover);
    window.addEventListener("focus", uncover);
    window.addEventListener("beforeprint", cover);
    window.addEventListener("afterprint", uncover);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("contextmenu", onContextMenu);

    return () => {
      clearTimeout(holdTimer);
      root.removeAttribute(ATTR);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", cover);
      window.removeEventListener("focus", uncover);
      window.removeEventListener("beforeprint", cover);
      window.removeEventListener("afterprint", uncover);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("contextmenu", onContextMenu);
    };
  }, []);

  return null;
}
