"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { ASSEMBLY_TIMING, type AssemblyPhase } from "./tessera-assembly-timing";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onStoreChange: () => void) {
  const motionQuery = window.matchMedia?.(REDUCED_MOTION_QUERY);
  motionQuery?.addEventListener("change", onStoreChange);

  return () => motionQuery?.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false;
}

function getReducedMotionServerSnapshot() {
  return false;
}

function subscribeToPageVisibility(onStoreChange: () => void) {
  document.addEventListener("visibilitychange", onStoreChange);

  return () => document.removeEventListener("visibilitychange", onStoreChange);
}

function getPageVisibilitySnapshot() {
  return document.visibilityState !== "hidden";
}

function getPageVisibilityServerSnapshot() {
  return true;
}

const nextPhase: Record<AssemblyPhase, AssemblyPhase> = {
  entering: "assembled",
  assembled: "resetting",
  resetting: "preparing",
  preparing: "entering",
};

const pieceNames = [
  "profile",
  "experience",
  "projects",
  "skills",
  "education",
] as const;

function AssemblyPieces() {
  return (
    <div className="assembly-grid" aria-hidden="true">
      <section
        className="assembly-piece assembly-profile"
        data-assembly-piece={pieceNames[0]}
      >
        <div className="assembly-profile-mark">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="assembly-profile-copy">
          <p className="assembly-label">Profile</p>
          <span className="mini-rule mini-rule-strong" />
          <span className="mini-rule mini-rule-medium" />
          <span className="mini-rule mini-rule-short" />
        </div>
      </section>

      <section
        className="assembly-piece assembly-experience"
        data-assembly-piece={pieceNames[1]}
      >
        <p className="assembly-label">Experience</p>
        <div className="assembly-experience-row">
          <span className="mini-date">’25</span>
          <span className="mini-copy-group">
            <span className="mini-rule mini-rule-strong" />
            <span className="mini-rule mini-rule-medium" />
          </span>
        </div>
        <div className="assembly-experience-row">
          <span className="mini-date">’24</span>
          <span className="mini-copy-group">
            <span className="mini-rule mini-rule-medium" />
            <span className="mini-rule mini-rule-short" />
          </span>
        </div>
      </section>

      <section
        className="assembly-piece assembly-projects"
        data-assembly-piece={pieceNames[2]}
      >
        <div className="assembly-piece-heading">
          <p className="assembly-label">Selected project</p>
          <span className="assembly-index">01</span>
        </div>
        <div className="assembly-project-field">
          <div className="assembly-project-topline">
            <span />
            <span />
            <span />
          </div>
          <span className="project-code-line project-code-long" />
          <span className="project-code-line project-code-medium" />
          <span className="project-code-line project-code-short" />
          <span className="assembly-project-accent" />
        </div>
        <span className="mini-rule mini-rule-strong" />
        <span className="mini-rule mini-rule-medium" />
      </section>

      <section
        className="assembly-piece assembly-skills"
        data-assembly-piece={pieceNames[3]}
      >
        <p className="assembly-label">Skills</p>
        <p className="assembly-skill-line">
          TypeScript <span>/</span> React <span>/</span> Node <span>/</span> SQL
        </p>
      </section>

      <section
        className="assembly-piece assembly-education"
        data-assembly-piece={pieceNames[4]}
      >
        <p className="assembly-label">Education</p>
        <span className="mini-rule mini-rule-strong" />
        <span className="mini-rule mini-rule-short" />
      </section>
    </div>
  );
}

export function TesseraAssembly() {
  const pathname = usePathname();
  const routeIsActive = pathname === "/";
  const wasRouteActive = useRef(routeIsActive);
  const [phase, setPhase] = useState<AssemblyPhase>("entering");
  const [cycle, setCycle] = useState(0);
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
  const pageIsVisible = useSyncExternalStore(
    subscribeToPageVisibility,
    getPageVisibilitySnapshot,
    getPageVisibilityServerSnapshot,
  );

  useEffect(() => {
    const motionQuery = window.matchMedia?.(REDUCED_MOTION_QUERY);
    let wasVisible = document.visibilityState !== "hidden";

    const handleMotionPreferenceChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setPhase("assembled");
        return;
      }

      if (document.visibilityState !== "hidden") {
        setCycle((current) => current + 1);
        setPhase("preparing");
      }
    };

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState !== "hidden";

      if (isVisible && !wasVisible && !motionQuery?.matches) {
        setCycle((current) => current + 1);
        setPhase("preparing");
      }

      wasVisible = isVisible;
    };

    motionQuery?.addEventListener("change", handleMotionPreferenceChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      motionQuery?.removeEventListener("change", handleMotionPreferenceChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const shouldRestart = routeIsActive && !wasRouteActive.current;
    wasRouteActive.current = routeIsActive;

    if (!shouldRestart) {
      return;
    }

    const restartId = window.setTimeout(() => {
      setCycle((current) => current + 1);
      setPhase("preparing");
    }, 0);

    return () => window.clearTimeout(restartId);
  }, [routeIsActive]);

  useEffect(() => {
    if (reducedMotion || !pageIsVisible || !routeIsActive) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (phase === "resetting") {
        setCycle((current) => current + 1);
      }
      setPhase(nextPhase[phase]);
    }, ASSEMBLY_TIMING[phase]);

    return () => window.clearTimeout(timeoutId);
  }, [pageIsVisible, phase, reducedMotion, routeIsActive]);

  const visiblePhase = reducedMotion ? "assembled" : phase;

  return (
    <figure
      className="assembly-figure"
      data-assembly-cycle={cycle}
      data-assembly-phase={visiblePhase}
    >
      <div
        key={cycle}
        className="assembly-document"
        role="img"
        aria-label="Five experience pieces assembling into a miniature portfolio."
      >
        <span className="assembly-surface" aria-hidden="true" />
        <AssemblyPieces />
        <span className="assembly-structure-line" aria-hidden="true" />
        <span className="assembly-frame" aria-hidden="true" />
        <span className="assembly-completion-cue" aria-hidden="true" />
      </div>
      <figcaption>
        Structured from your experience. Editable by you. Exported as code.
      </figcaption>
    </figure>
  );
}
