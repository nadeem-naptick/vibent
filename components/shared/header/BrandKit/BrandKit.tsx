"use client";

import copy from "copy-to-clipboard";
import { animate, cubicBezier } from "motion";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import FirecrawlIcon from "@/components/shared/firecrawl-icon/firecrawl-icon";
import Logo from "@/components/shared/header/_svg/Logo";
import { useHeaderContext } from "@/components/shared/header/HeaderContext";
import { cn } from "@/utils/cn";

import Download from "./_svg/Download";
import Guidelines from "./_svg/Guidelines";
import Icon from "./_svg/Icon";

export default function HeaderBrandKit() {
  const [open, setOpen] = useState(false);
  const { dropdownContent, clearDropdown } = useHeaderContext();

  useEffect(() => {
    document.addEventListener("click", () => {
      setOpen(false);
    });
  }, [open]);

  useEffect(() => {
    if (dropdownContent) {
      setOpen(false);
    }
  }, [dropdownContent]);

  return (
    <div className="relative">
      <Link
        className="flex items-center gap-2 relative brand-kit-menu"
        href="/"
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen(!open);

          if (!open) {
            clearDropdown(true);
          }
        }}
      >
        <FirecrawlIcon className="size-28 -top-2 relative" />
        <Logo />
      </Link>

      <AnimatePresence initial={false} mode="popLayout">
        {open && <Menu setOpen={setOpen} />}
      </AnimatePresence>
    </div>
  );
}

const Menu = ({ setOpen }: { setOpen: (open: boolean) => void }) => {
  const backgroundRef = useRef<HTMLDivElement>(null);

  const timeoutRef = useRef<number | null>(null);

  const onMouseEnter = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const t = e.target as HTMLElement;

    const target =
      t instanceof HTMLButtonElement
        ? t
        : (t.closest("button") as HTMLButtonElement);

    if (backgroundRef.current) {
      animate(backgroundRef.current, { scale: 0.98, opacity: 1 }).then(() => {
        if (backgroundRef.current) {
          animate(backgroundRef.current!, { scale: 1 });
        }
      });

      animate(
        backgroundRef.current,
        {
          y: target.offsetTop - 4,
        },
        {
          ease: cubicBezier(0.1, 0.1, 0.25, 1),
          duration: 0.2,
        },
      );
    }
  }, []);

  const onMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      if (backgroundRef.current) {
        animate(backgroundRef.current, { scale: 1, opacity: 0 });
      }
    }, 100);
  }, []);

  return (
    <motion.div
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      className="absolute w-220 whitespace-nowrap rounded-16 p-4 bg-white left-0 top-[calc(100%+8px)] z-[2000] border border-border-faint"
      exit={{ opacity: 0, y: 8, scale: 0.98, filter: "blur(1px)" }}
      initial={{ opacity: 0, y: -6, filter: "blur(1px)" }}
      style={{
        boxShadow:
          "0px 12px 24px rgba(0, 0, 0, 0.08), 0px 4px 8px rgba(0, 0, 0, 0.04)",
      }}
      transition={{
        ease: cubicBezier(0.1, 0.1, 0.25, 1),
        duration: 0.2,
      }}
    >
      <div
        className="absolute top-4 opacity-0 z-[2] pointer-events-none inset-x-4 bg-black-alpha-4 rounded-8 h-32"
        ref={backgroundRef}
      />

      <Button
        onClick={() => {
          window.location.href = "/demo";
          setOpen(false);
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <svg
          className="w-16 h-16"
          fill="none"
          viewBox="0 0 16 16"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v9a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12.5v-9z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.25"
          />
          <path
            d="M5.5 6.5l2 2 3-3"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.25"
          />
        </svg>
        Try Demo
      </Button>

      <div className="px-8 py-4">
        <div className="h-1 w-full bg-black-alpha-5" />
      </div>

      <Button
        onClick={() => {
          copy("https://vibeenterprise.com");
          setOpen(false);
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <svg
          className="w-16 h-16"
          fill="none"
          viewBox="0 0 16 16"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8 3V1M8 15V13M13 8H15M1 8H3M12.25 3.75L13.5 2.5M2.5 13.5L3.75 12.25M12.25 12.25L13.5 13.5M2.5 2.5L3.75 3.75"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.25"
          />
          <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.25"/>
        </svg>
        Copy website URL
      </Button>

      <Button
        onClick={() => {
          window.location.href = "/contact";
          setOpen(false);
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <svg
          className="w-16 h-16"
          fill="none"
          viewBox="0 0 16 16"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8 8C9.65685 8 11 6.65685 11 5C11 3.34315 9.65685 2 8 2C6.34315 2 5 3.34315 5 5C5 6.65685 6.34315 8 8 8Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.25"
          />
          <path
            d="M2 14C2 11.7909 4.68629 10 8 10C11.3137 10 14 11.7909 14 14"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.25"
          />
        </svg>
        Contact Sales
      </Button>

      <div className="px-8 py-4">
        <div className="h-1 w-full bg-black-alpha-5" />
      </div>

      <Button
        onClick={() => {
          window.location.href = "/enterprise";
          setOpen(false);
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <svg
          className="w-16 h-16"
          fill="none"
          viewBox="0 0 16 16"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2 10C2 10 2 6 8 6C14 6 14 10 14 10"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.25"
          />
          <path
            d="M2 14C2 14 2 10 8 10C14 10 14 14 14 14"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.25"
          />
          <path
            d="M8 2V6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.25"
          />
        </svg>
        Enterprise Features
      </Button>
    </motion.div>
  );
};

const Button = (attributes: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  return (
    <button
      {...attributes}
      className={cn(
        "flex gap-8 w-full items-center text-label-small group text-accent-black p-6",
        attributes.className,
      )}
    >
      {attributes.children}
    </button>
  );
};
