"use client";
import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import styles from "./about.module.css";

/**
 * 赞赏码是维护者的私有资产，不进公开仓库（.gitignore 拦截），部署时独立注入
 * frontend/public/support/。本地或部署缺图时降级为一行提示，不出现破图。
 */
export function SupportCode({
  src,
  alt,
  label,
}: {
  src: string;
  alt: string;
  label: string;
}) {
  const [missing, setMissing] = useState(false);
  if (missing) {
    return (
      <div className={styles.codeMissing}>
        <span>
          {label}赞赏码暂未配置（此图片由部署方独立提供，不随开源仓库分发）
        </span>
      </div>
    );
  }
  return (
    <a href={src} target="_blank" rel="noopener noreferrer">
      <Image
        src={src}
        alt={alt}
        width={1440}
        height={2160}
        unoptimized
        onError={() => setMissing(true)}
      />
      <span>
        {label} · 查看原图 <ArrowUpRight size={13} aria-hidden="true" />
      </span>
    </a>
  );
}
