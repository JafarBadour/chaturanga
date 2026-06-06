import React from "react";
import { BRAND_TITLE } from "../constants/brand";
import "./BrandMark.css";

/**
 * chesstrikes.com — Che + artistic doubled s + trikes
 */
export default function BrandMark({ className = "", size = "md" }) {
  return (
    <span
      className={`brand-mark brand-mark-${size}${className ? ` ${className}` : ""}`}
      aria-label={BRAND_TITLE}
    >
      <span className="brand-che">Che</span>
      <span className="brand-ss" aria-hidden="true">
        <span className="brand-s brand-s-back">s</span>
        <span className="brand-s brand-s-front">s</span>
      </span>
      <span className="brand-strikes">strikes</span>
    </span>
  );
}
